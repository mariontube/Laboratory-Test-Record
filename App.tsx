import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Plus, History, Activity, FileSpreadsheet, AlertTriangle, ExternalLink, MessageSquareText } from 'lucide-react';
import { LogItem } from './components/LogItem';
import { Visualizer } from './components/Visualizer';
import { HistoryModal } from './components/HistoryModal';
import { GeminiLiveService } from './services/geminiService';
import { Experiment, LogEntry, Measurement } from './types';

// Utility to detect WeChat browser
const isWeChatBrowser = () => {
  return /MicroMessenger/i.test(navigator.userAgent);
};

const App: React.FC = () => {
  // State for the current active experiment
  const [experiment, setExperiment] = useState<Experiment>(() => {
    const saved = localStorage.getItem('current_experiment');
    if (saved) return JSON.parse(saved);
    return {
      id: crypto.randomUUID(),
      title: '实验记录 ' + new Date().toLocaleDateString('zh-CN'),
      startTime: new Date().toISOString(),
      logs: [],
      status: 'active'
    };
  });

  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Real-time transcription state
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const transcriptionTimeoutRef = useRef<number | null>(null);

  // History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<Experiment[]>([]);

  const geminiServiceRef = useRef<GeminiLiveService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-save current experiment to 'current_experiment' storage
  useEffect(() => {
    localStorage.setItem('current_experiment', JSON.stringify(experiment));
  }, [experiment]);

  // Auto-scroll to bottom when logs change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [experiment.logs.length]);

  // Clear error messages automatically
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Load history list from localStorage
  const loadHistoryList = () => {
    try {
      const history = JSON.parse(localStorage.getItem('experiment_history') || '[]');
      setHistoryList(history);
    } catch (e) {
      console.error("Failed to load history", e);
      setHistoryList([]);
    }
  };

  // Helper to save an experiment to the history list
  const saveToHistory = (exp: Experiment) => {
    // Only save if it has logs or a custom title
    if (exp.logs.length === 0 && exp.title.startsWith('实验记录')) return;

    try {
      const history: Experiment[] = JSON.parse(localStorage.getItem('experiment_history') || '[]');
      const index = history.findIndex(h => h.id === exp.id);
      
      if (index >= 0) {
        history[index] = exp;
      } else {
        history.unshift(exp);
      }
      
      localStorage.setItem('experiment_history', JSON.stringify(history));
      setHistoryList(history);
    } catch (e) {
      console.error("Failed to save to history", e);
    }
  };

  // Updated to support measurements array
  const handleNewLog = useCallback((data: { description: string; measurements: Omit<Measurement, 'id'>[]; type: string }) => {
    setExperiment(prev => {
      // Convert incoming measurements to have IDs
      const measurementsWithIds: Measurement[] = data.measurements.map(m => ({
        ...m,
        id: crypto.randomUUID()
      }));

      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        stepNumber: prev.logs.length + 1,
        description: data.description,
        measurements: measurementsWithIds,
        type: data.type as any,
      };
      return {
        ...prev,
        logs: [...prev.logs, newLog]
      };
    });
    // Clear transcription when a log is finalized/created
    setLiveTranscription('');
  }, []);

  const handleTranscription = useCallback((text: string) => {
    setLiveTranscription(prev => prev + text);
    if (transcriptionTimeoutRef.current) {
      window.clearTimeout(transcriptionTimeoutRef.current);
    }
    transcriptionTimeoutRef.current = window.setTimeout(() => {
      setLiveTranscription('');
    }, 5000);
  }, []);

  const handleUpdateLog = (id: string, updates: Partial<LogEntry>) => {
    setExperiment(prev => ({
      ...prev,
      logs: prev.logs.map(log => log.id === id ? { ...log, ...updates } : log)
    }));
  };

  const handleDeleteLog = (id: string) => {
    setExperiment(prev => ({
      ...prev,
      logs: prev.logs.filter(log => log.id !== id)
    }));
  };

  const handleConnectionStatus = useCallback((status: boolean) => {
    setIsRecording(status);
    setIsConnecting(false);
  }, []);

  const toggleRecording = async () => {
    setErrorMessage(null);
    
    if (isRecording) {
      if (geminiServiceRef.current) {
        await geminiServiceRef.current.disconnect();
        geminiServiceRef.current = null;
      }
    } else {
      if (isWeChatBrowser()) {
        setErrorMessage("微信浏览器通常不支持麦克风权限。请点击右上角 ... 选择「在浏览器打开」以获得最佳体验。");
      }

      setIsConnecting(true);
      const service = new GeminiLiveService(handleNewLog, handleConnectionStatus, handleTranscription);
      geminiServiceRef.current = service;
      try {
        await service.connect();
      } catch (e) {
        console.error("Error starting session", e);
        setIsConnecting(false);
        if (isWeChatBrowser()) {
           setErrorMessage("连接失败：微信浏览器无法访问麦克风。请点击右上角选择「在浏览器打开」。");
        } else {
           setErrorMessage("无法连接麦克风或服务，请检查权限设置。");
        }
      }
    }
  };

  const handleNewExperiment = () => {
    if (experiment.logs.length > 0) {
       if (!confirm("开始新实验？当前记录将自动归档到历史记录中。")) return;
       saveToHistory(experiment);
    }

    const newExp: Experiment = {
      id: crypto.randomUUID(),
      title: '实验记录 ' + new Date().toLocaleString('zh-CN'),
      startTime: new Date().toISOString(),
      logs: [],
      status: 'active'
    };
    setExperiment(newExp);
  };

  const handleOpenHistory = () => {
    if (experiment.logs.length > 0) {
      saveToHistory(experiment);
    }
    loadHistoryList();
    setIsHistoryOpen(true);
  };

  const handleSelectHistory = (exp: Experiment) => {
    if (experiment.id !== exp.id) {
       saveToHistory(experiment);
    }
    setExperiment(exp);
    setIsHistoryOpen(false);
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这条历史记录吗？")) return;

    const newHistory = historyList.filter(h => h.id !== id);
    localStorage.setItem('experiment_history', JSON.stringify(newHistory));
    setHistoryList(newHistory);
  };

  const handleExportCSV = () => {
    const bom = '\uFEFF';
    const headers = "步骤序号,时间,类型,描述,数据标签,数值,单位\n";
    
    // Flatten logs because one log can have multiple measurements
    let rows = "";
    experiment.logs.forEach(log => {
      // Clean text for CSV
      const desc = log.description.replace(/"/g, '""');
      
      if (log.measurements && log.measurements.length > 0) {
         log.measurements.forEach(m => {
            rows += `${log.stepNumber},${log.timestamp},${log.type},"${desc}","${m.label}","${m.value}","${m.unit || ''}"\n`;
         });
      } else {
         rows += `${log.stepNumber},${log.timestamp},${log.type},"${desc}","","",""\n`;
      }
    });
    
    const csvContent = bom + headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${experiment.title}.csv`;
    a.click();
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-slate-50 flex flex-col font-sans text-slate-900">
      
      <HistoryModal 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={historyList}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
      />

      {/* Header */}
      <header className="flex-none bg-white border-b border-slate-200 px-4 py-3 shadow-sm z-10 flex justify-between items-center safe-area-pt">
        <div className="flex items-center gap-3">
          <div className="bg-science-100 p-2 rounded-lg">
            <Activity className="w-5 h-5 text-science-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-science-900 leading-tight">LabVoice</h1>
            <p className="text-[10px] text-slate-500 font-mono">{experiment.startTime.split('T')[0]}</p>
          </div>
        </div>
        <div className="flex gap-1">
           <button 
            onClick={handleOpenHistory}
            className="p-2 text-slate-600 hover:bg-slate-100 hover:text-science-600 rounded-full transition relative"
            title="历史记录"
          >
            <History className="w-5 h-5" />
          </button>
           <button 
            onClick={handleExportCSV}
            className="p-2 text-slate-600 hover:bg-slate-100 hover:text-science-600 rounded-full transition"
            title="导出 Excel/CSV"
          >
            <FileSpreadsheet className="w-5 h-5" />
          </button>
          <button 
            onClick={handleNewExperiment} 
            className="p-2 text-slate-600 hover:bg-slate-100 hover:text-science-600 rounded-full transition"
            title="新实验"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main List Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-48" ref={scrollRef}>
        
        {/* Error Banner */}
        {errorMessage && (
          <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-start gap-3 animate-fade-in mb-2 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-orange-800 leading-snug">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="text-center mb-4">
          <input 
            value={experiment.title}
            onChange={(e) => setExperiment(prev => ({...prev, title: e.target.value}))}
            onBlur={() => saveToHistory(experiment)} 
            className="text-center bg-transparent text-slate-500 font-medium text-sm focus:outline-none border-b border-transparent focus:border-slate-300 transition-colors w-full"
            placeholder="点击输入实验标题"
          />
        </div>

        {experiment.logs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 opacity-60 animate-pulse-fast">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Mic className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-medium">点击下方麦克风开始</p>
            <p className="text-xs mt-2 text-slate-300 max-w-[200px] text-center">
              语音识别已升级。我会自动提取如 "50ml", "37°C" 等关键数据并归类。
            </p>
            {isWeChatBrowser() && (
               <div className="mt-8 flex items-center gap-1 text-orange-400 bg-orange-50 px-3 py-1 rounded-full text-[10px]">
                 <ExternalLink className="w-3 h-3" />
                 <span>建议在系统浏览器打开</span>
               </div>
            )}
          </div>
        ) : (
          experiment.logs.map(log => (
            <LogItem 
              key={log.id} 
              entry={log} 
              onUpdate={handleUpdateLog}
              onDelete={handleDeleteLog}
            />
          ))
        )}
      </main>

      {/* Footer / Control Bar */}
      <div className="flex-none absolute bottom-0 w-full bg-gradient-to-t from-white via-white to-transparent pt-12 pb-6 px-4 safe-area-pb pointer-events-none">
        
        {/* Live Transcription Bubble */}
        {liveTranscription && (
          <div className="max-w-md mx-auto mb-4 pointer-events-auto animate-fade-in">
             <div className="bg-slate-800/90 backdrop-blur text-white text-sm p-3 rounded-xl shadow-lg border border-slate-700 flex items-start gap-2">
                <MessageSquareText className="w-4 h-4 text-science-400 mt-0.5 flex-shrink-0" />
                <p className="leading-snug opacity-90">{liveTranscription}</p>
             </div>
          </div>
        )}

        <div className="pointer-events-auto bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl rounded-2xl p-2 max-w-md mx-auto flex items-center justify-between">
           
           {/* Stats (Left) */}
           <div className="w-20 flex flex-col items-center justify-center border-r border-slate-100 pr-2">
             <span className="text-2xl font-bold text-slate-700 leading-none">{experiment.logs.length}</span>
             <span className="text-[10px] text-slate-400 font-medium uppercase mt-1">记录项</span>
           </div>

           {/* Main Record Button */}
           <div className="-mt-12 relative z-20">
             <button
               onClick={toggleRecording}
               disabled={isConnecting}
               className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 transform active:scale-95 ${
                 isRecording 
                   ? 'bg-science-500 shadow-science-500/50 scale-110 ring-4 ring-science-100' 
                   : 'bg-slate-800 shadow-slate-800/40 hover:bg-slate-700'
               } ${isConnecting ? 'opacity-75 cursor-not-allowed' : ''}`}
             >
               {isConnecting ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
               ) : isRecording ? (
                  <Visualizer isActive={true} />
               ) : (
                  <Mic className="w-8 h-8 text-white" />
               )}
             </button>
             {isRecording && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[10px] font-bold text-science-600 bg-science-50 px-2 py-0.5 rounded-full animate-pulse">
                    正在收听...
                  </span>
                </div>
             )}
           </div>

           {/* Connection Status (Right) */}
           <div className="w-20 flex flex-col items-center justify-center pl-2 border-l border-slate-100">
             <div className={`w-2 h-2 rounded-full mb-1 ${isRecording ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
             <span className="text-[10px] font-medium text-slate-400">
               {isConnecting ? '连接中' : isRecording ? '在线' : '就绪'}
             </span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;