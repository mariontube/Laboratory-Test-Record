import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";
import { createBlob, decode, decodeAudioData } from "../utils/audioUtils";
import { Measurement } from "../types";

const API_KEY = process.env.API_KEY || '';

// Define the tool to log experiment steps with structured data
const logStepFunctionDeclaration: FunctionDeclaration = {
  name: 'log_experiment_step',
  parameters: {
    type: Type.OBJECT,
    description: 'Log a specific step. Extract key data points (temp, volume, time) into the measurements array.',
    properties: {
      description: {
        type: Type.STRING,
        description: 'A comprehensive narrative description of the step or observation.',
      },
      measurements: {
        type: Type.ARRAY,
        description: 'List of specific data points extracted from the speech.',
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING, description: 'Name of the metric (e.g., "Temperature", "Speed", "Color")' },
            value: { type: Type.STRING, description: 'The value (e.g., "50", "Red")' },
            unit: { type: Type.STRING, description: 'The unit if applicable (e.g., "ml", "rpm", "°C")' }
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
    required: ['description', 'type'],
  },
};

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private sessionPromise: Promise<any> | null = null;
  
  // Callback to update UI with new logs
  private onLogEntry: (entry: { description: string; measurements: Omit<Measurement, 'id'>[]; type: string }) => void;
  private onStatusChange: (isConnected: boolean) => void;
  private onTranscription: (text: string) => void;

  constructor(
    onLogEntry: (entry: { description: string; measurements: Omit<Measurement, 'id'>[]; type: string }) => void,
    onStatusChange: (isConnected: boolean) => void,
    onTranscription: (text: string) => void
  ) {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
    this.onLogEntry = onLogEntry;
    this.onStatusChange = onStatusChange;
    this.onTranscription = onTranscription;
  }

  async connect() {
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          systemInstruction: `你是一个专业的实验记录助手。
          
          **任务**：
          1. 倾听语音，生成详细的实验记录。
          2. **提取关键数据**：非常重要！如果用户提到数字、单位、特定的化学物质名称或状态变化，请将其提取到 'measurements' 数组中。
             例如：“加入50毫升的HCL” -> measurements: [{label: "HCL", value: "50", unit: "ml"}]
             例如：“溶液变成了深蓝色” -> measurements: [{label: "颜色", value: "深蓝色", unit: ""}]
          
          **原则**：
          - 保持中文记录。
          - 描述要完整，不要遗漏细节。
          - 回复要极其简短（例如“已记录”），不要废话。
          `,
          tools: [{ functionDeclarations: [logStepFunctionDeclaration] }],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
        },
        callbacks: {
          onopen: this.handleOpen.bind(this),
          onmessage: this.handleMessage.bind(this),
          onclose: () => this.onStatusChange(false),
          onerror: (e) => {
            console.error("Session error:", e);
            this.onStatusChange(false);
          },
        },
      });

    } catch (error) {
      console.error("Failed to connect:", error);
      this.onStatusChange(false);
      throw error;
    }
  }

  private handleOpen() {
    this.onStatusChange(true);
    if (!this.inputAudioContext || !this.mediaStream) return;

    this.source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);
      
      if (this.sessionPromise) {
        this.sessionPromise.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleMessage(message: LiveServerMessage) {
    if (message.serverContent?.inputTranscription) {
      this.onTranscription(message.serverContent.inputTranscription.text);
    }

    if (message.toolCall) {
      for (const fc of message.toolCall.functionCalls) {
        if (fc.name === 'log_experiment_step') {
          const args = fc.args as any;
          this.onLogEntry({
            description: args.description,
            measurements: args.measurements || [],
            type: args.type,
          });

          if (this.sessionPromise) {
            this.sessionPromise.then((session) => {
              session.sendToolResponse({
                functionResponses: {
                  id: fc.id,
                  name: fc.name,
                  response: { result: "Logged successfully" },
                }
              });
            });
          }
        }
      }
    }

    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      try {
        this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
        const audioBuffer = await decodeAudioData(
          decode(base64Audio),
          this.outputAudioContext,
          24000,
          1
        );
        
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputAudioContext.destination);
        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;
      } catch (err) {
        console.error("Audio playback error", err);
      }
    }
  }

  async disconnect() {
    if (this.source) this.source.disconnect();
    if (this.processor) this.processor.disconnect();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (this.inputAudioContext) await this.inputAudioContext.close();
    if (this.outputAudioContext) await this.outputAudioContext.close();
    
    this.onStatusChange(false);
  }
}