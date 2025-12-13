import React, { useState, useRef, useEffect } from 'react';
import { LogEntry, Measurement } from '../types';
import { FlaskConical, Eye, FileText, Clock, Trash2, Edit2, Check, X, ChevronDown, Plus, GripVertical } from 'lucide-react';

interface LogItemProps {
  entry: LogEntry;
  onUpdate: (id: string, updates: Partial<LogEntry>) => void;
  onDelete: (id: string) => void;
}

export const LogItem: React.FC<LogItemProps> = ({ entry, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(entry.description);
  const [editMeasurements, setEditMeasurements] = useState<Measurement[]>(entry.measurements || []);
  const [editType, setEditType] = useState(entry.type);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editDesc, isEditing]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'action': return <FlaskConical className="w-5 h-5 text-science-600" />;
      case 'observation': return <Eye className="w-5 h-5 text-purple-600" />;
      case 'note': return <FileText className="w-5 h-5 text-slate-500" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'action': return 'border-l-science-500';
      case 'observation': return 'border-l-purple-500';
      default: return 'border-l-slate-300';
    }
  };

  const handleSave = () => {
    onUpdate(entry.id, {
      description: editDesc,
      measurements: editMeasurements.filter(m => m.label.trim() !== ''), // Filter empty
      type: editType
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditDesc(entry.description);
    setEditMeasurements(entry.measurements || []);
    setEditType(entry.type);
    setIsEditing(false);
  };

  const addMeasurement = () => {
    setEditMeasurements([
      ...editMeasurements,
      { id: crypto.randomUUID(), label: '', value: '', unit: '' }
    ]);
  };

  const updateMeasurement = (id: string, field: keyof Measurement, value: string) => {
    setEditMeasurements(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const removeMeasurement = (id: string) => {
    setEditMeasurements(prev => prev.filter(m => m.id !== id));
  };

  if (isEditing) {
    return (
      <div className={`bg-white p-4 rounded-xl shadow-lg border-l-4 ${getBorderColor(editType)} mb-4 animate-fade-in ring-1 ring-slate-200`}>
        <div className="flex flex-col gap-4">
          
          {/* Header Edit Controls */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
             <div className="relative">
                <select 
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as any)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold uppercase py-1 px-3 pr-8 rounded-lg focus:outline-none focus:border-science-500 focus:ring-1 focus:ring-science-200 transition-all"
                >
                  <option value="action">Action (操作)</option>
                  <option value="observation">Observation (观察)</option>
                  <option value="note">Note (备注)</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
             </div>
             <div className="text-xs text-slate-400 font-mono">#{entry.stepNumber}</div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">详细描述</label>
            <textarea
              ref={textareaRef}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-science-100 focus:border-science-400 resize-none min-h-[80px]"
              placeholder="输入实验步骤描述..."
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">数据与指标</label>
              <button 
                onClick={addMeasurement}
                type="button"
                className="text-xs flex items-center gap-1 text-science-600 hover:text-science-700 font-medium px-2 py-1 hover:bg-science-50 rounded transition-colors"
              >
                <Plus className="w-3 h-3" /> 添加数据
              </button>
            </div>
            
            {editMeasurements.length > 0 && (
              <div className="flex gap-2 px-1 mb-1">
                <div className="flex-1 text-[10px] text-slate-400 font-medium pl-1">名称</div>
                <div className="w-20 text-[10px] text-slate-400 font-medium text-right pr-1">数值</div>
                <div className="w-16 text-[10px] text-slate-400 font-medium pl-1">单位</div>
                <div className="w-8"></div>
              </div>
            )}

            {editMeasurements.map((m) => (
              <div key={m.id} className="flex gap-2 items-center animate-fade-in">
                 <input 
                   placeholder="温度/pH"
                   value={m.label || ''}
                   onChange={(e) => updateMeasurement(m.id, 'label', e.target.value)}
                   className="flex-1 min-w-0 p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-science-400 focus:ring-2 focus:ring-science-100 outline-none placeholder:text-slate-300"
                 />
                 <input 
                   placeholder="0"
                   value={m.value || ''}
                   onChange={(e) => updateMeasurement(m.id, 'value', e.target.value)}
                   className="w-20 p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-science-400 focus:ring-2 focus:ring-science-100 outline-none text-right placeholder:text-slate-300 font-mono"
                 />
                 <input 
                   placeholder="°C"
                   value={m.unit || ''}
                   onChange={(e) => updateMeasurement(m.id, 'unit', e.target.value)}
                   className="w-16 p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-science-400 focus:ring-2 focus:ring-science-100 outline-none placeholder:text-slate-300"
                 />
                 <button 
                   onClick={() => removeMeasurement(m.id)}
                   className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                   title="移除"
                 >
                   <Trash2 className="w-4 h-4" />
                 </button>
              </div>
            ))}
            {editMeasurements.length === 0 && (
              <div className="text-center py-2 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                暂无数据记录
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100 mt-2">
             <button 
               onClick={handleCancel} 
               className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
             >
               取消
             </button>
             <button 
               onClick={handleSave} 
               className="px-4 py-2 text-sm font-medium bg-science-600 text-white hover:bg-science-700 rounded-lg shadow-sm flex items-center gap-1 transition-colors"
             >
               <Check className="w-4 h-4" />
               保存修改
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group bg-white p-4 rounded-xl shadow-sm border-l-4 ${getBorderColor(entry.type)} mb-3 animate-fade-in relative transition-all hover:shadow-md border border-slate-100`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {getIcon(entry.type)}
          <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
             {entry.type === 'action' ? '操作' : entry.type === 'observation' ? '观察' : '备注'}
          </span>
          <span className="text-xs font-mono text-slate-300 flex items-center gap-1 ml-2">
            <Clock className="w-3 h-3" /> {entry.timestamp}
          </span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-xs font-bold text-slate-300">#{entry.stepNumber}</span>
           <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setIsEditing(true)} className="p-1.5 text-slate-400 hover:text-science-600 hover:bg-science-50 rounded transition-all" title="编辑">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(entry.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all" title="删除">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
           </div>
        </div>
      </div>
      
      <p className="text-slate-800 font-medium text-base leading-relaxed whitespace-pre-wrap mb-3">
        {entry.description}
      </p>
      
      {entry.measurements && entry.measurements.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {entry.measurements.map((m) => (
            <div key={m.id} className="inline-flex items-center bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium mr-2">{m.label}</span>
              <span className="text-sm text-slate-900 font-bold font-mono">
                {m.value}
                {m.unit && <span className="ml-1 text-slate-500 text-xs font-normal">{m.unit}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};