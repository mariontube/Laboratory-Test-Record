import { GoogleGenAI, Type } from "@google/genai";
import { Measurement } from "../types";

const API_KEY = process.env.API_KEY || '';

// Initialize AI instance only if key exists to prevent immediate crash on load, 
// but check before usage.
const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

// Define the schema for structured output
const logSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: 'A comprehensive narrative description of the step or observation in Chinese.',
    },
    measurements: {
      type: Type.ARRAY,
      description: 'List of specific data points extracted from the text.',
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: 'Name of the metric (e.g., "Temperature", "Speed", "pH")' },
          value: { type: Type.STRING, description: 'The value (e.g., "50", "Red")' },
          unit: { type: Type.STRING, description: 'The unit if applicable (e.g., "ml", "°C")' }
        },
        required: ['label', 'value']
      }
    },
    type: {
      type: Type.STRING,
      enum: ['action', 'observation', 'note'],
      description: 'The category of the log entry.',
    },
  },
  required: ['description', 'type', 'measurements'],
};

export interface ProcessedLog {
  description: string;
  measurements: Omit<Measurement, 'id'>[];
  type: string;
}

/**
 * Processes raw text input into a structured experiment log using Gemini 2.5 Flash.
 */
export const processTextLog = async (text: string): Promise<ProcessedLog> => {
  if (!API_KEY || !ai) {
    throw new Error("API Key 未配置。请在 Vercel 项目设置的环境变量中添加 'API_KEY'。");
  }

  if (!text.trim()) throw new Error("输入内容不能为空");

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: `你是一个专业的实验记录助手。
        你的任务是将用户输入的非结构化文本转换为结构化的实验记录。
        
        **要求**：
        1. **中文记录**：description 必须使用中文，语言要专业、简洁。
        2. **数据提取**：准确提取文本中的所有数值、单位、化学物质名称等作为 measurements。
        3. **类型判断**：
           - Action (操作): 主动进行的实验步骤。
           - Observation (观察): 看到的现象、颜色变化、沉淀等。
           - Note (备注): 其他想法或补充。
        `,
        responseMimeType: 'application/json',
        responseSchema: logSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("AI 未返回任何内容");
    
    // Clean up potential Markdown formatting (```json ... ```) which can break JSON.parse
    const cleanJson = jsonText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    
    return JSON.parse(cleanJson) as ProcessedLog;
  } catch (error: any) {
    console.error("Gemini processing error:", error);
    
    // Check for common fetch errors (often caused by network blocks in some regions)
    if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
       throw new Error("网络连接失败。请检查你的网络设置（国内需确保能访问 Google API）。");
    }
    
    throw error;
  }
};