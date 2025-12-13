export interface Measurement {
  id: string;
  label: string; // e.g., "Temperature", "pH", "Volume"
  value: string; // e.g., "37", "7.0", "50"
  unit?: string; // e.g., "°C", "ml"
}

export interface LogEntry {
  id: string;
  timestamp: string;
  stepNumber: number;
  description: string;
  measurements: Measurement[]; // Structured data points instead of a single string
  type: 'action' | 'observation' | 'note';
}

export interface Experiment {
  id: string;
  title: string;
  startTime: string;
  logs: LogEntry[];
  status: 'active' | 'completed';
}

// Helper types for Audio processing
export interface AudioConfig {
  sampleRate: number;
}