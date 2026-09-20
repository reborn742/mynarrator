import React, { useState } from 'react';
import { Bookmark, MessageSquare, Target, SplitSquareHorizontal, FileQuestion, ShieldCheck } from 'lucide-react';
import { Highlight, TOCItem, Bookmark as BookmarkType, GoalHighlightResult, MergedConnection, QuestionTOCItem, ClaimVerification } from '../types';

interface SidebarProps {
  pages: string[];
  currentPage: number;
  onNavigate: (page: number) => void;
  pageListRef: React.RefObject<HTMLDivElement>;
  toc: TOCItem[];
  questionToc?: QuestionTOCItem[];
  claimVerifications?: ClaimVerification[];
  bookmarks: BookmarkType[];
  highlights: Highlight[];
  goalHighlights?: GoalHighlightResult[];
  isGoalMode?: boolean;
  mergedSummary?: string | null;
  mergedConnections?: MergedConnection[];
  onAddBookmark: (page: number) => void;
  onRemoveBookmark: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  pages, currentPage, onNavigate, pageListRef,
  toc, questionToc, claimVerifications, bookmarks, highlights, goalHighlights, isGoalMode, mergedSummary, mergedConnections, onAddBookmark, onRemoveBookmark
}) => {
  const [activeTab, setActiveTab] = useState<'pages' | 'toc' | 'notes' | 'goal' | 'merge' | 'qtoc' | 'claims'>('pages');

  return (
    <div className="hidden sm:flex w-64 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex-col shrink-0 transition-all duration-300">
      
      {/* Tabs */}
      <div className="flex items-center p-2 border-b border-slate-200 dark:border-slate-800 gap-1 bg-white dark:bg-slate-950 flex-wrap">
        <button 
          onClick={() => setActiveTab('pages')}
          className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'pages' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Pages
        </button>
        <button 
          onClick={() => setActiveTab('toc')}
          className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'toc' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          TOC
        </button>
        <button 
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'notes' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
        >
          Notes
        </button>
        {questionToc && questionToc.length > 0 && (
          <button 
            onClick={() => setActiveTab('qtoc')}
            className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'qtoc' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Question TOC"
          >
            <FileQuestion size={14} className="mx-auto" />
          </button>
        )}
        {claimVerifications && claimVerifications.length > 0 && (
          <button 
            onClick={() => setActiveTab('claims')}
            className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'claims' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Claim Verifications"
          >
            <ShieldCheck size={14} className="mx-auto" />
          </button>
        )}
        {goalHighlights && goalHighlights.length > 0 && (
          <button 
            onClick={() => setActiveTab('goal')}
            className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'goal' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Goal Matches"
          >
            <Target size={14} className="mx-auto" />
          </button>
        )}
        {mergedConnections && mergedConnections.length > 0 && (
          <button 
            onClick={() => setActiveTab('merge')}
            className={`flex-1 py-1 px-2 text-xs font-medium rounded-md transition-colors ${activeTab === 'merge' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            title="Merged Analysis"
          >
            <SplitSquareHorizontal size={14} className="mx-auto" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar" ref={pageListRef}>
        
        {activeTab === 'pages' && (
          <div className="flex flex-col gap-3">
            {pages.map((pageContent, index) => {
                const pageNum = index + 1;
                const isActive = pageNum === currentPage;
                const isBookmarked = bookmarks.some(b => b.pageIndex === index);

                return (
                  <div key={index} className="relative group">
                    <button 
                      onClick={() => onNavigate(pageNum)}
                      className={`
                        w-full flex flex-col text-left p-3 rounded-xl transition-all duration-200 
                        ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'}
                      `}
                    >
                      <span className={`text-xs font-bold mb-1 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        Page {pageNum}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-5 leading-relaxed">
                        {pageContent || "Blank page"}
                      </span>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); isBookmarked ? onRemoveBookmark(bookmarks.find(b => b.pageIndex === index)!.id) : onAddBookmark(index); }}
                      className={`absolute top-2 right-2 p-1 rounded-full ${isBookmarked ? 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-400' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-500 bg-white/80 dark:bg-slate-800/80'} transition-all`}
                    >
                      <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
                    </button>
                  </div>
                );
            })}
          </div>
        )}

        {activeTab === 'toc' && (
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Table of Contents</h4>
            {toc.length === 0 ? (
              <div className="text-xs text-slate-400 px-2 italic">No headings found in document.</div>
            ) : (
              toc.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(item.pageIndex + 1)}
                  className={`text-left py-1.5 px-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center gap-2 ${currentPage === item.pageIndex + 1 ? 'text-indigo-600 font-medium' : 'text-slate-600 dark:text-slate-300'}`}
                  style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
                >
                  <span className="truncate">{item.title}</span>
                  <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">P.{item.pageIndex + 1}</span>
                </button>
              ))
            )}
            
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-2 flex items-center gap-1"><Bookmark size={12}/> Bookmarks</h4>
            {bookmarks.length === 0 ? (
              <div className="text-xs text-slate-400 px-2 italic">No bookmarks added yet.</div>
            ) : (
              bookmarks.map(b => (
                <button
                  key={b.id}
                  onClick={() => onNavigate(b.pageIndex + 1)}
                  className="text-left py-1.5 px-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center justify-between text-slate-700 dark:text-slate-300"
                >
                  <span className="truncate">{b.title}</span>
                  <span className="text-[10px] text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">Pg {b.pageIndex + 1}</span>
                </button>
              ))
            )}
          </div>
        )}
        
        {activeTab === 'qtoc' && questionToc && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Question Index</h4>
            {questionToc.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onNavigate(item.pageIndex + 1)}
                  className={`text-left p-3 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors border border-slate-200 dark:border-slate-800 flex flex-col gap-2 ${currentPage === item.pageIndex + 1 ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-800'}`}
                >
                  <span className="text-slate-700 dark:text-slate-300 leading-snug">{item.question}</span>
                  <span className="text-[10px] font-medium text-indigo-500 bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 rounded w-fit">Page {item.pageIndex + 1}</span>
                </button>
              ))
            }
          </div>
        )}
        
        {activeTab === 'claims' && claimVerifications && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-2">Verified Claims</h4>
            {claimVerifications.map((item, i) => (
                <div key={i} className={`bg-white dark:bg-slate-800 border rounded-lg p-3 shadow-sm ${item.isSupported ? 'border-blue-200 dark:border-blue-900' : 'border-red-200 dark:border-red-900'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${item.isSupported ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
                      {item.isSupported ? 'Supported' : 'Unsupported / Missing'}
                    </span>
                    {!item.hasSource && (
                      <span className="text-[10px] text-slate-500 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">No In-Doc Source</span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 italic">
                    "{item.claim}"
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                    {item.explanation}
                  </div>
                </div>
            ))}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-2">Highlights & Notes</h4>
            {highlights.length === 0 ? (
              <div className="text-xs text-slate-400 px-2 italic">Highlight text to add notes.</div>
            ) : (
              highlights.sort((a, b) => a.pageIndex - b.pageIndex).map(h => (
                <div key={h.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onClick={() => onNavigate(h.pageIndex + 1)}>
                      Page {h.pageIndex + 1}
                    </span>
                  </div>
                  <div className={`text-xs p-1.5 rounded mb-2 line-clamp-3 ${h.color}`}>
                    {h.text}
                  </div>
                  {h.note && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5 mt-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                      <MessageSquare size={12} className="shrink-0 mt-0.5 text-slate-400" />
                      <span>{h.note}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'goal' && goalHighlights && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 uppercase tracking-wider mb-1 px-2 flex items-center gap-1">
              <Target size={12} /> Goal Matches
            </h4>
            {goalHighlights.map((h, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-3 shadow-sm hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors cursor-pointer" onClick={() => onNavigate(h.pageIndex + 1)}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50 px-1.5 py-0.5 rounded">
                      Page {h.pageIndex + 1}
                    </span>
                  </div>
                  <div className="text-xs p-1.5 rounded mb-2 line-clamp-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-100 border border-yellow-100 dark:border-yellow-800">
                    {h.text}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-start gap-1.5">
                    <span className="font-medium">Why:</span> <span>{h.reason}</span>
                  </div>
                </div>
            ))}
          </div>
        )}

        {activeTab === 'merge' && mergedConnections && (
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mb-1 px-2 flex items-center gap-1">
              <SplitSquareHorizontal size={12} /> Merged Connections
            </h4>
            {mergedSummary && (
              <div className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800 mb-2">
                <span className="font-semibold block mb-1">Summary</span>
                {mergedSummary}
              </div>
            )}
            {mergedConnections.map((conn, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900/50 rounded-lg p-3 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors cursor-pointer" onClick={() => onNavigate(conn.pageIndex + 1)}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded capitalize">
                      {conn.type} - Pg {conn.pageIndex + 1}
                    </span>
                  </div>
                  <div className="text-xs p-1.5 rounded mb-2 line-clamp-3 bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    {conn.text}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-start gap-1.5">
                    <span>{conn.explanation}</span>
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
