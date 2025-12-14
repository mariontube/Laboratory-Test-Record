import { Blob } from '@google/genai';

export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Simple clipping to prevent overflow
    let s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Resamples audio data from the source sample rate to a target sample rate (default 16kHz).
 * Uses linear interpolation for performance.
 */
export function resampleTo16k(audioData: Float32Array, originalSampleRate: number): Float32Array {
  if (originalSampleRate === 16000) return audioData;
  
  const targetSampleRate = 16000;
  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const originalIndex = i * ratio;
    
    // Linear interpolation indices
    const index1 = Math.floor(originalIndex);
    const index2 = Math.min(Math.ceil(originalIndex), audioData.length - 1);
    const t = originalIndex - index1;
    
    // Check bounds
    if (index1 >= audioData.length) break;
    
    const v1 = audioData[index1];
    const v2 = audioData[index2];
    
    // Interpolate
    result[i] = v1 * (1 - t) + v2 * t;
  }
  
  return result;
}