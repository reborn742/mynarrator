import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Mic, 
  Volume2, 
  VolumeX, 
  Loader2, 
  Minimize2, 
  Maximize2, 
  Sparkles, 
  User, 
  Bot, 
  Copy, 
  Check, 
  Trash2, 
  Square, 
  ArrowDown, 
  FileText, 
  HelpCircle,
  RotateCcw
} from 'lucide-react';
import Markdown from 'react-markdown';
import { 
  ChatMessage, 
  streamChatResponse, 
  playSpeechWithFallback 
} from '../services/geminiService';
import { ALL_OFFLINE_VOICES } from '../constants';

interface ChatWidgetProps {
  documentText: string;
  selectedVoiceId: string;
  currentPageText?: string;
  currentPage?: number;
  totalPages?: number;
  documentTitle?: string;
  hasBottomPlayer?: boolean;
}

interface MessageItem {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
}

const markdownComponents = {
  p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold text-indigo-900 dark:text-indigo-200">{children}</strong>,
  code: ({ children, className }: any) => {
    const isInline = !className || !className.includes('language-');
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700/70 text-xs font-mono text-indigo-700 dark:text-indigo-300">
          {children}
        </code>
      );
    }
    return (
      <pre className="p-3 my-2 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto">
        <code>{children}</code>
      </pre>
    );
  },
  h1: ({ children }: any) => <h1 className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1.5">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-xs font-bold text-slate-900 dark:text-white mt-2.5 mb-1">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1">{children}</h3>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-2 border-indigo-500 pl-3 my-2 text-xs italic text-slate-600 dark:text-slate-400 bg-indigo-50/50 dark:bg-indigo-950/20 py-1 rounded-r">
      {children}
    </blockquote>
  ),
};

const ChatWidget: React.FC<ChatWidgetProps> = ({ 
  documentText, 
  selectedVoiceId,
  currentPageText = '',
  currentPage = 1,
  totalPages = 1,
  documentTitle = '',
  hasBottomPlayer = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([
    { 
      id: 'initial', 
      role: 'model', 
      text: documentText.trim() 
        ? `Hello! I'm your AI Reading Companion. I've analyzed your document${documentTitle ? ` **${documentTitle}**` : ''}. Ask me to summarize sections, clarify arguments, or answer any specific questions!`
        : "Hello! I'm your AI Reading Assistant. Upload or open any document to ask targeted questions, or feel free to ask general questions anytime!",
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentAudioStopRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedVoiceName = ALL_OFFLINE_VOICES.find(v => v.id === selectedVoiceId)?.name || 'System Natural';
  const hasDocument = documentText.trim().length > 0;

  // Scroll to bottom helper
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Auto-scroll when messages update if near bottom
  useEffect(() => {
    if (isOpen && !showScrollBottom) {
      scrollToBottom(true);
    }
  }, [messages, isOpen, showScrollBottom, scrollToBottom]);

  // Track scroll position to show/hide "Scroll to bottom" button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceToBottom > 80);
  };

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Cleanup audio on unmount or close
  useEffect(() => {
    return () => {
      if (currentAudioStopRef.current) {
        currentAudioStopRef.current();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Update initial welcome message if document state changes
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'initial') {
      setMessages([
        {
          id: 'initial',
          role: 'model',
          text: documentText.trim()
            ? `Hello! I'm your AI Reading Companion. I've analyzed your document${documentTitle ? ` **${documentTitle}**` : ''}. Ask me to summarize sections, clarify arguments, or answer any specific questions!`
            : "Hello! I'm your AI Reading Assistant. Upload or open any document to ask targeted questions, or feel free to ask general questions anytime!",
          timestamp: Date.now()
        }
      ]);
    }
  }, [hasDocument, documentTitle]);

  // Send message handler
  const handleSendMessage = async (textToSendArg?: string) => {
    const textToSend = (textToSendArg !== undefined ? textToSendArg : inputValue).trim();
    if (!textToSend || isProcessing) return;

    if (textToSendArg === undefined) {
      setInputValue('');
    }

    // Stop previous audio if playing
    if (currentAudioStopRef.current) {
      currentAudioStopRef.current();
      currentAudioStopRef.current = null;
      setPlayingMessageId(null);
    }

    const userMessageId = `user-${Date.now()}`;
    const modelMessageId = `model-${Date.now()}`;

    const userMsg: MessageItem = {
      id: userMessageId,
      role: 'user',
      text: textToSend,
      timestamp: Date.now()
    };

    const initialModelMsg: MessageItem = {
      id: modelMessageId,
      role: 'model',
      text: '',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg, initialModelMsg]);
    setIsProcessing(true);
    setShowScrollBottom(false);

    // Prepare abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Convert existing messages to ChatMessage history
    const historyForApi: ChatMessage[] = messages
      .filter(m => !m.isError && m.text.trim().length > 0)
      .map(m => ({ role: m.role, text: m.text }));

    try {
      let accumulatedText = '';

      await streamChatResponse(
        documentText,
        historyForApi,
        textToSend,
        (chunk) => {
          accumulatedText += chunk;
          setMessages(prev => 
            prev.map(m => m.id === modelMessageId ? { ...m, text: accumulatedText } : m)
          );
        },
        {
          documentTitle,
          currentPage,
          totalPages,
          currentPageText,
          signal: abortController.signal
        }
      );

      // If auto-speak enabled, read out the generated response
      if (autoSpeak && accumulatedText.trim()) {
        playMessageAudio(modelMessageId, accumulatedText);
      }
    } catch (error: any) {
      console.error("Chat generation error:", error);
      const isAborted = abortController.signal.aborted;
      const isQuota = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED') || error?.status === 429;
      
      const errorMessage = isAborted
        ? "Generation stopped."
        : isQuota
        ? "The AI rate limit was reached. Please wait a few moments and click Retry below."
        : "I ran into an issue connecting to the AI model. Please check your connection and try again.";

      setMessages(prev => 
        prev.map(m => m.id === modelMessageId ? { ...m, text: errorMessage, isError: !isAborted } : m)
      );
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  // Stop active generation
  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
  };

  // Play audio for a specific message
  const playMessageAudio = async (messageId: string, text: string) => {
    if (playingMessageId === messageId) {
      // Pause/Stop if currently playing
      if (currentAudioStopRef.current) {
        currentAudioStopRef.current();
        currentAudioStopRef.current = null;
      }
      setPlayingMessageId(null);
      return;
    }

    // Stop any previous speech
    if (currentAudioStopRef.current) {
      currentAudioStopRef.current();
      currentAudioStopRef.current = null;
    }

    setPlayingMessageId(messageId);

    const controller = await playSpeechWithFallback(
      text,
      selectedVoiceId || selectedVoiceName,
      () => setPlayingMessageId(messageId),
      () => {
        setPlayingMessageId(null);
        currentAudioStopRef.current = null;
      }
    );

    currentAudioStopRef.current = controller.stop;
  };

  // Copy message to clipboard
  const handleCopy = (messageId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Clear chat history
  const handleClearHistory = () => {
    if (currentAudioStopRef.current) {
      currentAudioStopRef.current();
      currentAudioStopRef.current = null;
      setPlayingMessageId(null);
    }
    setMessages([
      {
        id: 'initial',
        role: 'model',
        text: hasDocument
          ? `Conversation cleared. I'm ready to answer any new questions about **${documentTitle || 'your document'}**!`
          : "Conversation cleared. Feel free to ask anything or upload a document!",
        timestamp: Date.now()
      }
    ]);
  };

  // Speech Recognition (Microphone Voice Input)
  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');

        setInputValue(transcript);

        if (event.results[0].isFinal) {
          setIsListening(false);
          handleSendMessage(transcript);
        }
      };
      
      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error("Speech recognition start failed:", err);
      setIsListening(false);
    }
  };

  // Key Down handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Contextual Suggested Prompts
  const suggestedPrompts = hasDocument ? [
    ...(currentPageText ? [`Summarize page ${currentPage}`] : []),
    "What are the 3 main takeaways?",
    "Explain the core concept in simple terms",
    "Are there any counterarguments or flaws?",
    "Highlight key statistics or data"
  ].slice(0, 4) : [
    "What formats can I upload here?",
    "How does the AI audio reading work?",
    "What features are available in this app?",
    "Help me outline an essay or notes"
  ];

  // Dynamic bottom positioning based on bottom player state
  const bottomPositionClass = hasBottomPlayer 
    ? 'bottom-24 sm:bottom-24' 
    : 'bottom-6 sm:bottom-6';

  return (
    <>
      {/* Chat Window Panel */}
      {isOpen && (
        <div 
          className={`
            fixed right-4 sm:right-6 z-50 flex flex-col 
            bg-white dark:bg-slate-900 rounded-2xl shadow-2xl 
            border border-slate-200/90 dark:border-slate-800 
            overflow-hidden animate-slide-up origin-bottom-right transition-all duration-300
            ${hasBottomPlayer ? 'bottom-28 sm:bottom-28' : 'bottom-20 sm:bottom-20'}
            ${isExpanded 
              ? 'w-[calc(100vw-2rem)] max-w-2xl h-[80vh] sm:h-[680px]' 
              : 'w-[calc(100vw-2rem)] max-w-sm sm:w-[410px] h-[540px] sm:h-[580px]'}
          `}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 p-3.5 flex items-center justify-between text-white shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
                <Sparkles size={17} className="text-amber-300 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm leading-tight truncate">AI Reading Companion</h3>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/20 text-indigo-100 shrink-0">
                    {selectedVoiceName}
                  </span>
                </div>
                <p className="text-[11px] text-indigo-100/90 truncate flex items-center gap-1 mt-0.5">
                  {hasDocument ? (
                    <>
                      <FileText size={11} className="shrink-0" />
                      <span className="truncate">
                        {documentTitle || 'Document'} • Pg {currentPage}/{totalPages}
                      </span>
                    </>
                  ) : (
                    <span>General Knowledge Mode</span>
                  )}
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {/* Auto Speak Toggle */}
              <button
                onClick={() => setAutoSpeak(!autoSpeak)}
                className={`p-1.5 rounded-lg transition-colors text-xs flex items-center gap-1 ${
                  autoSpeak 
                    ? 'bg-amber-400/30 text-amber-200 ring-1 ring-amber-300/40' 
                    : 'text-indigo-200 hover:bg-white/15'
                }`}
                title={autoSpeak ? "Auto-speak replies: ON" : "Auto-speak replies: OFF"}
              >
                {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* Clear Chat */}
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                title="Clear conversation"
              >
                <Trash2 size={16} />
              </button>

              {/* Expand / Minimize Window */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/15 rounded-lg transition-colors hidden sm:block"
                title={isExpanded ? "Collapse view" : "Expand view"}
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              {/* Close Window */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                title="Close chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 space-y-4 custom-scrollbar relative"
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isPlayingThis = playingMessageId === msg.id;
              const isCopied = copiedMessageId === msg.id;

              return (
                <div 
                  key={msg.id} 
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div 
                    className={`
                      max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all
                      ${isUser 
                        ? 'bg-indigo-600 text-white rounded-br-sm' 
                        : msg.isError
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800/60 rounded-bl-sm'
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-bl-sm'}
                    `}
                  >
                    {/* Role Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5 opacity-75 text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        {isUser ? <User size={11} /> : <Bot size={11} />}
                        <span>{isUser ? 'You' : selectedVoiceName}</span>
                      </div>
                      <span className="font-normal opacity-60 lowercase">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Message Body */}
                    {msg.text ? (
                      <div className="text-sm">
                        <Markdown components={markdownComponents}>
                          {msg.text}
                        </Markdown>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 py-1 text-indigo-600 dark:text-indigo-400">
                        <Loader2 size={15} className="animate-spin" />
                        <span className="text-xs italic">Reading and thinking...</span>
                      </div>
                    )}

                    {/* Assistant Message Actions */}
                    {!isUser && msg.text && !msg.isError && (
                      <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400">
                        {/* Audio Read-Aloud Button */}
                        <button
                          onClick={() => playMessageAudio(msg.id, msg.text)}
                          className={`p-1 rounded-md transition-all flex items-center gap-1 text-[11px] ${
                            isPlayingThis 
                              ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-medium' 
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
                          }`}
                          title={isPlayingThis ? "Stop speaking" : "Read aloud"}
                        >
                          {isPlayingThis ? (
                            <>
                              <VolumeX size={13} className="text-indigo-600 animate-pulse" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={13} />
                              <span>Listen</span>
                            </>
                          )}
                        </button>

                        {/* Copy Button */}
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-all ml-auto flex items-center gap-1 text-[11px]"
                          title="Copy response"
                        >
                          {isCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                          {isCopied && <span className="text-green-500 font-medium">Copied</span>}
                        </button>
                      </div>
                    )}

                    {/* Retry Action on Error */}
                    {msg.isError && (
                      <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-900/50 flex justify-end">
                        <button
                          onClick={() => {
                            const lastUser = [...messages].reverse().find(m => m.role === 'user');
                            if (lastUser) {
                              handleSendMessage(lastUser.text);
                            }
                          }}
                          className="text-xs flex items-center gap-1 font-semibold text-red-700 dark:text-red-300 hover:underline"
                        >
                          <RotateCcw size={12} />
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating Scroll to Bottom Button */}
          {showScrollBottom && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-20 right-6 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all z-10 flex items-center gap-1 text-xs"
              title="Scroll to bottom"
            >
              <ArrowDown size={14} />
            </button>
          )}

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-1.5 bg-slate-100/90 dark:bg-slate-900/90 border-t border-slate-200/70 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles size={11} className="text-indigo-500" />
              Quick:
            </span>
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                disabled={isProcessing}
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-xs bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all shrink-0 shadow-2xs disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
            <div className="relative flex items-end gap-2">
              <textarea 
                ref={inputRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasDocument ? "Ask anything about this document..." : "Ask me anything..."}
                disabled={isProcessing}
                className="w-full pl-3.5 pr-20 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white transition-all disabled:opacity-60 resize-none max-h-32 custom-scrollbar leading-relaxed"
                style={{ minHeight: '44px' }}
              />

              {/* Action Buttons Inside Input */}
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                {/* Voice Input (Speech to Text) */}
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isProcessing}
                  className={`
                    p-1.5 rounded-lg transition-all
                    ${isListening 
                      ? 'text-red-500 bg-red-100 dark:bg-red-950/80 animate-pulse ring-2 ring-red-400/50' 
                      : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-700'}
                  `}
                  title={isListening ? "Listening... click to stop" : "Voice input (dictate)"}
                >
                  <Mic size={17} />
                </button>

                {/* Send or Stop Button */}
                {isProcessing ? (
                  <button
                    type="button"
                    onClick={handleStopGenerating}
                    className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                    title="Stop generating"
                  >
                    <Square size={16} className="fill-current" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendMessage()} 
                    disabled={!inputValue.trim()}
                    className={`
                      p-1.5 rounded-lg transition-all shadow-sm
                      ${!inputValue.trim()
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-indigo-500/25'}
                    `}
                    title="Send message"
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Listening Indicator */}
            {isListening && (
              <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-red-500 font-medium animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>Listening... speak now</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed right-6 z-50 p-3.5 rounded-full shadow-xl transition-all duration-300 group
          ${bottomPositionClass}
          ${isOpen 
            ? 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600 rotate-0 shadow-slate-900/30' 
            : 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white hover:from-indigo-700 hover:to-indigo-600 hover:shadow-indigo-500/50 hover:-translate-y-0.5'}
        `}
        title={isOpen ? "Close AI Chat" : "Chat with Document & AI"}
      >
        {isOpen ? (
          <X size={26} className="transition-transform duration-300" />
        ) : (
          <div className="relative">
            <MessageCircle size={26} className="group-hover:scale-110 transition-transform duration-200" />
            {/* Pulsing indicator when document is loaded */}
            {hasDocument && (
              <>
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-400 rounded-full animate-ping"></span>
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></span>
              </>
            )}
          </div>
        )}
      </button>
    </>
  );
};

export default ChatWidget;
