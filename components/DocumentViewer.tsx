import React, { useState, useRef, useEffect } from 'react';
import { Edit3, Check, X, Palette, MessageSquare, ShieldAlert, FileSearch } from 'lucide-react';
import { Highlight, GoalHighlightResult } from '../types';

interface DocumentViewerProps {
  content: string;
  pageIndex: number;
  fontClass: string;
  fontSize: number;
  lineSpacing: number;
  isAudioMode: boolean;
  segments: string[];
  activeSegmentIndex: number | null;
  activeSegmentRef: React.RefObject<HTMLSpanElement>;
  isEditMode: boolean;
  onContentChange: (newContent: string) => void;
  setEditMode: (edit: boolean) => void;
  highlights: Highlight[];
  goalHighlights?: GoalHighlightResult[];
  isGoalMode?: boolean;
  onAddHighlight: (highlight: Omit<Highlight, 'id' | 'createdAt'>) => void;
  onUpdateHighlight: (id: string, note: string) => void;
  onDeleteHighlight: (id: string) => void;
  onArgueCounterposition?: (text: string) => void;
  onVerifyClaim?: (text: string) => void;
}

const COLORS = ['bg-yellow-200 dark:bg-yellow-900/50', 'bg-green-200 dark:bg-green-900/50', 'bg-pink-200 dark:bg-pink-900/50', 'bg-blue-200 dark:bg-blue-900/50'];

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  content, pageIndex, fontClass, fontSize, lineSpacing,
  isAudioMode, segments, activeSegmentIndex, activeSegmentRef,
  isEditMode, onContentChange, setEditMode,
  highlights, goalHighlights, isGoalMode, onAddHighlight, onUpdateHighlight, onDeleteHighlight,
  onArgueCounterposition, onVerifyClaim
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number, end: number, text: string } | null>(null);
  const [activeNoteHighlight, setActiveNoteHighlight] = useState<Highlight | null>(null);

  useEffect(() => {
    const handleSelection = () => {
      if (isAudioMode || isEditMode) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !containerRef.current) {
        setSelectionRect(null);
        setSelectedRange(null);
        return;
      }
      
      if (!containerRef.current.contains(selection.anchorNode)) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const text = selection.toString();
      const containerRect = containerRef.current.getBoundingClientRect();
      
      setSelectionRect({
        ...rect,
        top: rect.top - containerRect.top,
        left: rect.left - containerRect.left
      } as DOMRect);

      // Simple indexOf for demonstration (in real app we'd need better mapping)
      const start = content.indexOf(text);
      if (start !== -1) {
        setSelectedRange({ start, end: start + text.length, text });
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => document.removeEventListener('selectionchange', handleSelection);
  }, [isAudioMode, isEditMode, content]);

  const handleApplyHighlight = (color: string) => {
    if (selectedRange) {
      onAddHighlight({
        pageIndex,
        text: selectedRange.text,
        color,
        type: 'user',
        startOffset: selectedRange.start,
        endOffset: selectedRange.end
      });
      window.getSelection()?.removeAllRanges();
      setSelectionRect(null);
      setSelectedRange(null);
    }
  };

  const renderHighlightedContent = () => {
    if (!content) return null;
    
    // Sort all highlights by start offset
    const pageHighlights = [...highlights, ...(goalHighlights || [])].sort((a, b) => 
      (a.startOffset || 0) - (b.startOffset || 0)
    );

    if (pageHighlights.length === 0) {
      return <span>{content}</span>;
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    pageHighlights.forEach((h, i) => {
      const start = h.startOffset || content.indexOf(h.text, lastIndex);
      if (start === -1) return;
      
      const end = h.endOffset || start + h.text.length;

      if (start > lastIndex) {
        elements.push(<span key={`text-${i}`}>{content.substring(lastIndex, start)}</span>);
      }

      elements.push(
        <span 
          key={`mark-${i}`} 
          className={`${h.color} cursor-pointer rounded px-0.5 transition-opacity hover:opacity-80`}
          onClick={() => h.type === 'user' && setActiveNoteHighlight(h as Highlight)}
          title={h.type === 'goal' ? (h as GoalHighlightResult).reason : (h as Highlight).note || 'Annotation'}
        >
          {content.substring(start, end)}
        </span>
      );

      lastIndex = end;
    });

    if (lastIndex < content.length) {
      elements.push(<span key="text-end">{content.substring(lastIndex)}</span>);
    }

    return elements;
  };

  return (
    <div className="relative h-full">
      <div 
        ref={containerRef}
        className="w-full h-full max-w-3xl mx-auto bg-white dark:bg-slate-900 shadow-sm sm:rounded-2xl overflow-hidden flex flex-col relative transition-colors duration-300"
      >
        {isEditMode ? (
          <textarea
            dir="auto"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className={`w-full h-full p-6 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-100 dark:focus:ring-indigo-900 text-slate-700 dark:text-slate-300 bg-transparent ${fontClass}`}
            style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
            placeholder="Type or paste your document text here..."
          />
        ) : (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar text-slate-800 dark:text-slate-200 bg-transparent" dir="auto">
            <div 
              dir="auto"
              className={`whitespace-pre-wrap ${fontClass} transition-all duration-300`}
              style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
            >
              {isAudioMode ? (
                segments.map((segment, index) => {
                  const isActive = index === activeSegmentIndex;
                  return (
                    <span 
                      key={index}
                      ref={isActive ? activeSegmentRef : null}
                      className={`
                        transition-all duration-300 rounded px-1 -ml-1
                        ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-900 dark:text-indigo-100 shadow-sm ring-2 ring-indigo-200 dark:ring-indigo-700 font-medium' : ''}
                      `}
                    >
                      {segment}{' '}
                    </span>
                  );
                })
              ) : (
                renderHighlightedContent()
              )}
            </div>
          </div>
        )}

        {isEditMode && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button 
              onClick={() => setEditMode(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <Check size={20} />
            </button>
          </div>
        )}

        {/* Selection Popover */}
        {selectionRect && selectedRange && !isAudioMode && (
          <div 
            className="absolute z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg p-2 flex gap-2 animate-fade-in-up items-center"
            style={{ top: selectionRect.top - 50, left: Math.max(0, selectionRect.left) }}
          >
            {COLORS.map(c => (
              <button 
                key={c} 
                className={`w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 ${c.split(' ')[0]} dark:${c.split(' ')[1]}`}
                onClick={() => handleApplyHighlight(c)}
                title="Highlight"
              />
            ))}
            {onArgueCounterposition && (
              <button
                onClick={() => {
                  onArgueCounterposition(selectedRange.text);
                  window.getSelection()?.removeAllRanges();
                  setSelectionRect(null);
                  setSelectedRange(null);
                }}
                className="ml-2 px-2 py-1 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded hover:bg-red-200 flex items-center gap-1"
                title="Argue against this"
              >
                <ShieldAlert size={12} /> Disagree
              </button>
            )}
            {onVerifyClaim && (
              <button
                onClick={() => {
                  onVerifyClaim(selectedRange.text);
                  window.getSelection()?.removeAllRanges();
                  setSelectionRect(null);
                  setSelectedRange(null);
                }}
                className="px-2 py-1 text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded hover:bg-blue-200 flex items-center gap-1"
                title="Verify this claim"
              >
                <FileSearch size={12} /> Verify
              </button>
            )}
          </div>
        )}

        {/* Note Modal */}
        {activeNoteHighlight && (
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-40 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up border border-slate-200 dark:border-slate-700">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                <h3 className="font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                  <MessageSquare size={16} className="text-indigo-500" /> Note
                </h3>
                <button onClick={() => setActiveNoteHighlight(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4">
                <div className={`text-sm p-3 rounded-lg mb-4 ${activeNoteHighlight.color}`}>
                  "{activeNoteHighlight.text}"
                </div>
                <textarea
                  autoFocus
                  placeholder="Add a note to this highlight..."
                  defaultValue={activeNoteHighlight.note || ''}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24 text-slate-700 dark:text-slate-300"
                  onBlur={(e) => onUpdateHighlight(activeNoteHighlight.id, e.target.value)}
                />
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => { onDeleteHighlight(activeNoteHighlight.id); setActiveNoteHighlight(null); }}
                    className="text-red-500 hover:text-red-600 text-sm font-medium"
                  >
                    Delete
                  </button>
                  <button 
                    onClick={() => setActiveNoteHighlight(null)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;
