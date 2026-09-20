import React, { useEffect, useState } from 'react';
import { X, FileText, Trash2, Calendar, BookOpen, Clock, Activity, GitCompare } from 'lucide-react';
import { getDocuments, deleteDocument, SavedDocument, saveDocument } from '../services/storageService';
import { analyzeReadingDebt } from '../services/geminiService';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (doc: SavedDocument) => void;
  onMerge: (docs: SavedDocument[]) => void;
  onCompare: (oldDoc: SavedDocument) => void;
}

const LibraryModal: React.FC<LibraryModalProps> = ({ isOpen, onClose, onLoad, onMerge, onCompare }) => {
  const [docs, setDocs] = useState<SavedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'debt'>('all');
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzingDebtId, setAnalyzingDebtId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDocs();
      setIsMultiSelect(false);
      setSelectedIds(new Set());
    }
  }, [isOpen]);

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const data = await getDocuments();
      setDocs(data);
    } catch (e) {
      console.error("Failed to load library", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const previousDocs = [...docs];
    setDocs(prevDocs => prevDocs.filter(doc => doc.id !== id));
    try {
      await deleteDocument(id);
    } catch (err) {
      alert("Failed to delete the document. Please try again.");
      setDocs(previousDocs);
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleMergeClick = () => {
    const selectedDocs = docs.filter(d => selectedIds.has(d.id));
    if (selectedDocs.length >= 2) {
      onMerge(selectedDocs);
      onClose();
    } else {
      alert("Please select at least 2 documents to merge.");
    }
  };
  
  const handleAnalyzeDebt = async (e: React.MouseEvent, doc: SavedDocument) => {
    e.stopPropagation();
    if (!doc.lastReadPage || !doc.pages || doc.pages.length === 0) return;
    
    setAnalyzingDebtId(doc.id);
    try {
      const timeSinceOpened = Date.now() - (doc.lastOpenedAt || doc.createdAt);
      const res = await analyzeReadingDebt(doc.pages, doc.lastReadPage, timeSinceOpened);
      
      const updatedDoc = {
        ...doc,
        abandonedReason: res.reason,
        condensedSummary: res.condensedSummary,
        isDebtAnalyzed: true
      };
      
      await saveDocument(updatedDoc);
      setDocs(docs.map(d => d.id === doc.id ? updatedDoc : d));
    } catch (error) {
      console.error(error);
      alert("Failed to analyze reading debt.");
    } finally {
      setAnalyzingDebtId(null);
    }
  };

  const filteredDocs = activeTab === 'all' 
    ? docs 
    : docs.filter(d => (d.lastReadPage && d.lastReadPage < d.pages.length) || (!d.lastReadPage));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-slide-up max-h-[85vh] flex flex-col">
        
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <BookOpen size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold">Your Library</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                All Documents
              </button>
              <button 
                onClick={() => setActiveTab('debt')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'debt' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                <div className="flex items-center gap-1.5">
                  <Clock size={14} />
                  Reading Debt
                </div>
              </button>
            </div>
            
            {activeTab === 'all' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsMultiSelect(!isMultiSelect);
                    setSelectedIds(new Set());
                  }}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${isMultiSelect ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {isMultiSelect ? 'Cancel Selection' : 'Merge Topics'}
                </button>
                {isMultiSelect && (
                  <button
                    onClick={handleMergeClick}
                    disabled={selectedIds.size < 2}
                    className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                  >
                    Merge ({selectedIds.size})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-2">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
               <p>Loading library...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-600 gap-3 py-10">
               <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                  {activeTab === 'debt' ? <Clock size={32} /> : <BookOpen size={32} />}
               </div>
               <p>{activeTab === 'debt' ? 'No reading debt found! You are caught up.' : 'No saved documents yet.'}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDocs.map((doc) => {
                const isSelected = selectedIds.has(doc.id);
                const percentRead = doc.lastReadPage ? Math.round((doc.lastReadPage / doc.pages.length) * 100) : 0;
                
                return (
                  <div 
                    key={doc.id}
                    onClick={() => {
                      if (isMultiSelect) {
                        toggleSelection({ stopPropagation: () => {} } as React.MouseEvent, doc.id);
                      } else {
                        onLoad(doc);
                      }
                    }}
                    className={`group bg-white dark:bg-slate-900 p-4 rounded-xl border hover:shadow-md transition-all cursor-pointer flex flex-col gap-3
                      ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/30' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500'}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 overflow-hidden">
                        {isMultiSelect && (
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                            {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                          </div>
                        )}
                        {!isMultiSelect && (
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                            <FileText size={24} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-4">{doc.name}</h3>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                            <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                            <span>{doc.pages.length} Pages</span>
                            {activeTab === 'debt' && (
                              <>
                                <span className="w-1 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></span>
                                <span className="text-amber-600 dark:text-amber-400">{percentRead}% Read</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isMultiSelect && activeTab === 'all' && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCompare(doc); }}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors"
                            title="Compare with newer version"
                          >
                            <GitCompare size={18} />
                          </button>
                        )}
                        {!isMultiSelect && (
                          <button 
                            type="button"
                            onClick={(e) => handleDelete(e, doc.id)}
                            className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors z-10"
                            title="Delete"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {activeTab === 'debt' && !isMultiSelect && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
                        {!doc.isDebtAnalyzed ? (
                           <div className="flex justify-between items-center">
                              <span className="text-sm text-slate-500">Unfinished. Want to know why you stopped?</span>
                              <button 
                                onClick={(e) => handleAnalyzeDebt(e, doc)}
                                disabled={analyzingDebtId === doc.id}
                                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded flex items-center gap-1"
                              >
                                {analyzingDebtId === doc.id ? 'Analyzing...' : <><Activity size={12}/> Analyze Debt</>}
                              </button>
                           </div>
                        ) : (
                          <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                             <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-500 mb-1">Likely reason: {doc.abandonedReason}</h4>
                             <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mb-3">{doc.condensedSummary}</p>
                             <div className="flex justify-end gap-2">
                               <button 
                                  onClick={(e) => handleDelete(e, doc.id)}
                                  className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded"
                               >
                                 Remove from Library
                               </button>
                               <button 
                                  onClick={(e) => { e.stopPropagation(); onLoad(doc); }}
                                  className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                               >
                                 Finish Reading
                               </button>
                             </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryModal;
