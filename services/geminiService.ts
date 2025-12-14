import { GoogleGenAI, Type } from "@google/genai";
import { Measurement } from "../types";

const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

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
  if (!text.trim()) throw new Error("Input text is empty");

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
    if (!jsonText) throw new Error("AI response was empty");
    
    return JSON.parse(jsonText) as ProcessedLog;
  } catch (error) {
    console.error("Gemini processing error:", error);
    throw error;
  }
};