import React, { useState } from 'react';
import { Target, Loader2, X } from 'lucide-react';

interface GoalPromptModalProps {
  isOpen: boolean;
  onSkip: () => void;
  onSubmit: (goal: string) => void;
  isAnalyzing: boolean;
}

const GoalPromptModal: React.FC<GoalPromptModalProps> = ({ isOpen, onSkip, onSubmit, isAnalyzing }) => {
  const [goal, setGoal] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative p-6">
        <button 
          onClick={onSkip}
          disabled={isAnalyzing}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mb-6 mt-2">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
            <Target size={24} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Set a Reading Goal</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            What are you trying to get from this document? We'll highlight the most relevant sections for you.
          </p>
        </div>

        <div className="space-y-4">
          <textarea
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px] text-slate-800 dark:text-slate-200 resize-none"
            placeholder="e.g., Researching a topic, making a decision, learning a specific skill, or just skimming..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isAnalyzing}
          />

          <div className="flex gap-3 pt-2">
            <button
              onClick={onSkip}
              disabled={isAnalyzing}
              className="flex-1 py-2.5 px-4 rounded-xl font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={() => onSubmit(goal)}
              disabled={!goal.trim() || isAnalyzing}
              className="flex-1 py-2.5 px-4 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                'Find Sections'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalPromptModal;
