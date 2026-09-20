import React from 'react';
import { Mic, BookOpen, Settings2 } from 'lucide-react';
import Logo from './Logo';

interface HeaderProps {
  onOpenLibrary: () => void;
  isDarkMode?: boolean;
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenLibrary, isDarkMode, onOpenSettings }) => {
  return (
    <header className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 py-3 px-6 sticky top-0 z-40 transition-all">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        
        <div className="hover:opacity-80 transition-opacity cursor-pointer">
            <Logo size="sm" light={isDarkMode} />
        </div>

        <div className="flex items-center gap-3">
            <button
                onClick={onOpenSettings}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                title="Typography & Settings"
            >
                <Settings2 size={18} />
            </button>
            <button 
                onClick={onOpenLibrary}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1.5 rounded-full transition-colors"
            >
                <BookOpen size={16} />
                <span className="hidden sm:inline">My Library</span>
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                <Mic className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="hidden sm:inline">Powered by</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">Gemini 2.5</span>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;