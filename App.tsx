import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, History, Activity, FileSpreadsheet, AlertTriangle, Send, Loader2, Keyboard } from 'lucide-react';
import { LogItem } from './components/LogItem';
import { HistoryModal } from './components/HistoryModal';
import { processTextLog } from './services/geminiService';
import { Experiment, LogEntry, Measurement } from './types';

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

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // History Modal State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<Experiment[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      const timer = setTimeout(() => setErrorMessage(null), 8000); // Increased duration for reading
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

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

  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await processTextLog(inputText);
      
      setExperiment(prev => {
        const measurementsWithIds: Measurement[] = result.measurements.map(m => ({
          ...m,
          id: crypto.randomUUID()
        }));

        const newLog: LogEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
          stepNumber: prev.logs.length + 1,
          description: result.description,
          measurements: measurementsWithIds,
          type: result.type as any,
        };
        return {
          ...prev,
          logs: [...prev.logs, newLog]
        };
      });
      
      setInputText('');
      // Reset height
      if (textareaRef.current) textareaRef.current.style.height = 'auto';

    } catch (e: any) {
      console.error(e);
      // Show the actual error message to help debugging (API key missing, network, etc.)
      setErrorMessage(e.message || "识别失败，请检查网络或重试");
    } finally {
      setIsProcessing(false);
    }
  };

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

  const handleNewExperiment = () => {
    if (experiment.logs.length > 0) {
       if (!confirm("开始新实验？当前记录将自动归档到历史记录中。")) return;
       saveToHistory(experiment);
    }

    const newExp: Experiment = {
      id: crypto.randomUUID(),
      title: '实验记录 ' + new Date().toLocaleString('zh-CN'),
      logs: [],
      startTime: new Date().toISOString(),
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
    let rows = "";
    experiment.logs.forEach(log => {
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
    <div className="fixed inset-0 w-full h-full bg-slate-50 flex flex-col font-sans text-slate-900 select-none">
      
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
      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-4" ref={scrollRef}>
        
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
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 opacity-60">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Keyboard className="w-8 h-8 text-slate-300" />
            </div>
            <p className="font-medium">请输入实验步骤</p>
            <p className="text-xs mt-2 text-slate-300 max-w-[200px] text-center">
              使用手机输入法自带的语音转文字功能输入，我会自动整理成结构化记录。
            </p>
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

      {/* Input Area */}
      <div className="flex-none bg-white border-t border-slate-200 p-4 safe-area-pb shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)]">
         <div className="max-w-2xl mx-auto flex items-end gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-science-100 focus-within:border-science-400 transition-all">
            <textarea
               ref={textareaRef}
               value={inputText}
               onChange={(e) => setInputText(e.target.value)}
               placeholder="输入实验操作，例如：量取 50ml 乙醇倒入烧杯..."
               className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 text-base max-h-32 min-h-[40px] py-2 px-1 resize-none placeholder:text-slate-400"
               rows={1}
            />
            <button
               onClick={handleSendMessage}
               disabled={!inputText.trim() || isProcessing}
               className={`p-2.5 rounded-xl flex-shrink-0 transition-all ${
                  inputText.trim() && !isProcessing
                   ? 'bg-science-600 text-white shadow-lg shadow-science-200 hover:bg-science-700 active:scale-95' 
                   : 'bg-slate-200 text-slate-400 cursor-not-allowed'
               }`}
            >
               {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
               ) : (
                  <Send className="w-5 h-5" />
               )}
            </button>
         </div>
      </div>
    </div>
  );
};

export default App;