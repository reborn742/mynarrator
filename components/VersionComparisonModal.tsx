import React from 'react';
import { X, GitCompare, CheckCircle, AlertCircle } from 'lucide-react';
import { DocumentVersionComparison } from '../types';

interface VersionComparisonModalProps {
  comparison: DocumentVersionComparison | null;
  onClose: () => void;
}

const VersionComparisonModal: React.FC<VersionComparisonModalProps> = ({ comparison, onClose }) => {
  if (!comparison) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[85vh] flex flex-col">
        
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <GitCompare size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold">Version Comparison</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Summary of Changes</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{comparison.summary}</p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-500 flex items-center gap-2 mb-3">
                <AlertCircle size={18} /> Important Changes
              </h3>
              <ul className="space-y-2">
                {comparison.importantChanges.length > 0 ? comparison.importantChanges.map((change, i) => (
                  <li key={i} className="text-sm bg-amber-50 dark:bg-amber-900/10 text-amber-900 dark:text-amber-200 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                    {change}
                  </li>
                )) : <li className="text-sm text-slate-500 italic">No major changes detected.</li>}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
                <CheckCircle size={18} /> Minor Edits
              </h3>
              <ul className="space-y-2">
                {comparison.minorChanges.length > 0 ? comparison.minorChanges.map((change, i) => (
                  <li key={i} className="text-sm bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    {change}
                  </li>
                )) : <li className="text-sm text-slate-500 italic">No minor changes detected.</li>}
              </ul>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default VersionComparisonModal;
