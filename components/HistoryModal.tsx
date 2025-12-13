import React from 'react';
import { Experiment } from '../types';
import { Clock, FileText, Trash2, X, ChevronRight, Calendar } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: Experiment[];
  onSelect: (experiment: Experiment) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onSelect, 
  onDelete 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col z-10 animate-fade-in relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-science-600" />
            历史记录
          </h2>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p>暂无历史记录</p>
            </div>
          ) : (
            history.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).map((exp) => (
              <div 
                key={exp.id}
                onClick={() => onSelect(exp)}
                className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-science-300 transition-all cursor-pointer flex justify-between items-center"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 truncate pr-4">{exp.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                      <Calendar className="w-3 h-3" />
                      {new Date(exp.startTime).toLocaleDateString('zh-CN')}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {exp.logs.length} 条记录
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pl-2">
                  <button 
                    onClick={(e) => onDelete(exp.id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-science-500 transition-colors" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};