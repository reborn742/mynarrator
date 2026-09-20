import React from 'react';
import { X } from 'lucide-react';
import TypographySettings from './TypographySettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  font: string;
  setFont: (f: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  lineSpacing: number;
  setLineSpacing: (s: number) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  if (!props.isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Reading & Typography Settings</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize font family, layout scale, and theme</p>
          </div>
          <button 
            onClick={props.onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto custom-scrollbar flex-1">
          <TypographySettings {...props} />
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
