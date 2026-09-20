import React, { useState, useEffect, useRef, useMemo } from 'react';
import Header from './components/Header';
import FileUploader from './components/FileUploader';
import VoiceSelector from './components/VoiceSelector';
import AudioPlayer from './components/AudioPlayer';
import IntroAnimation from './components/IntroAnimation';
import ChatWidget from './components/ChatWidget';
import LibraryModal from './components/LibraryModal';
import SettingsModal from './components/SettingsModal';
import DocumentViewer from './components/DocumentViewer';
import Sidebar from './components/Sidebar';
import GoalPromptModal from './components/GoalPromptModal';
import VersionComparisonModal from './components/VersionComparisonModal';
import { ProcessingState, Highlight, Bookmark, TOCItem, GoalHighlightResult, MergedConnection, DocumentVersionComparison, QuestionTOCItem, ClaimVerification } from './types';
import { AI_VOICES, SYSTEM_VOICES, ALL_VOICES, MAX_TEXT_LENGTH } from './constants';
import { resolveOfflineVoice } from './services/voiceHelper';
import { parseDocxFile, parsePdfFile, parseTextFile, splitIntoSentences, detectLanguage, LANG_TO_BCP47 } from './services/parsers';
import { 
  streamGenerateSpeech, 
  prefetchSpeech,
  generateSpeech,
  getCachedSegmentAudio,
  base64ToUint8Array,
  pcmUint8ToWavBlob,
  pcmUint8ToMp3Blob,
  downloadBlob,
  pcmUint8ToWavBlobUrl, 
  GeminiTTSError, 
  analyzeReadingGoal, 
  analyzeMergedDocuments, 
  compareDocumentVersions, 
  analyzeTopic, 
  argueCounterposition, 
  verifyClaims, 
  generateQuestionTOC, 
  flagDenseSections 
} from './services/geminiService';
import { saveDocument, SavedDocument, updateReadingSpeed, getSlowTopics } from './services/storageService';
import { Loader2, AlertCircle, Wand2, FileText, ChevronLeft, ChevronRight, Edit3, Type, ArrowDownToLine, Download, CheckCircle2, Target, FileQuestion, FileSearch } from 'lucide-react';

// Scheduler Item for sync
interface AudioScheduleItem {
  segmentIndex: number;
  startTime: number;
  endTime: number;
}

const App: React.FC = () => {
  const [showIntro, setShowIntro] = useState(true);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontClass, setFontClass] = useState<string>('font-sans');
  const [fontSize, setFontSize] = useState<number>(24);
  const [lineSpacing, setLineSpacing] = useState<number>(1.8);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(SYSTEM_VOICES[0].id);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');

  // Automatically detect primary language of the uploaded document
  const detectedDocLanguage = useMemo(() => {
    if (pages.length === 0) return 'en';
    const sample = pages.slice(0, 3).join(' \n ');
    return detectLanguage(sample, 'en');
  }, [pages]);
  
  // Library State
  const [showLibrary, setShowLibrary] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);

  // Highlighting & Playback State
  const [segments, setSegments] = useState<string[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null);
  const [isReadMode, setIsReadMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [toc, setToc] = useState<TOCItem[]>([]);
  
  const [mergedSummary, setMergedSummary] = useState<string | null>(null);
  const [mergedConnections, setMergedConnections] = useState<MergedConnection[]>([]);
  
  const [topic, setTopic] = useState<string>('');
  const [questionToc, setQuestionToc] = useState<QuestionTOCItem[]>([]);
  const [claimVerifications, setClaimVerifications] = useState<ClaimVerification[]>([]);
  const pageStartTimeRef = useRef<number>(Date.now());
  const [isVerifyingClaims, setIsVerifyingClaims] = useState(false);
  const [isGeneratingQTOC, setIsGeneratingQTOC] = useState(false);

  const [showDensePrompt, setShowDensePrompt] = useState(false);
  const [isFlaggingDense, setIsFlaggingDense] = useState(false);

  const [versionComparison, setVersionComparison] = useState<DocumentVersionComparison | null>(null);
  const [isAnalyzingMerged, setIsAnalyzingMerged] = useState(false);
  const [isComparingVersions, setIsComparingVersions] = useState(false);
  
  // Goal State
  const [isGoalPromptOpen, setIsGoalPromptOpen] = useState(false);
  const [isAnalyzingGoal, setIsAnalyzingGoal] = useState(false);
  const [goal, setGoal] = useState<string>('');
  const [goalHighlights, setGoalHighlights] = useState<GoalHighlightResult[]>([]);
  const [isGoalModeActive, setIsGoalModeActive] = useState(false);

  const [loadedPage, setLoadedPage] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Streaming Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isLongBuffering, setIsLongBuffering] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [volume, setVolume] = useState<number>(1.0);
  
  // Audio Data State (Current Page)
  const [audioDownloadUrl, setAudioDownloadUrl] = useState<string | null>(null); // Wav URL for playback/quick download
  const [audioPcmData, setAudioPcmData] = useState<Uint8Array | null>(null); // Raw data for MP3 conversion
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);

  // Full Document Audio State
  const [fullAudioState, setFullAudioState] = useState<{
    isGenerating: boolean;
    progress: number;
    url: string | null;
  }>({ isGenerating: false, progress: 0, url: null });

  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [audioEngine, setAudioEngine] = useState<'gemini' | 'native'>('gemini');
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  
  const [state, setState] = useState<ProcessingState>({
    isParsing: false,
    isGeneratingAudio: false,
    error: null,
  });

  const pageListRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLSpanElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs for Web Audio API & Native Speech Fallback
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const isStreamingRef = useRef<boolean>(false);
  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const scheduleRef = useRef<AudioScheduleItem[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const playbackRateRef = useRef<number>(1.0);
  const isNativeReadingRef = useRef<boolean>(false);
  const nativeSegmentIndexRef = useRef<number>(0);
  const textSegmentsRef = useRef<string[]>([]);

  // Background idle prefetch for current page to make reading start instantly with zero latency
  useEffect(() => {
    if (isPlaying || !pages[currentPage - 1] || selectedVoiceId.startsWith('native:') || !process.env.API_KEY) return;
    const currentPageText = pages[currentPage - 1];
    const timer = setTimeout(() => {
      const textSegments = splitIntoSentences(currentPageText);
      if (textSegments.length > 0) {
        prefetchSpeech(textSegments.slice(0, 3), selectedVoiceId, 3);
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [currentPage, pages, selectedVoiceId, isPlaying]);

  // Load Settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('typographySettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.fontClass) setFontClass(parsed.fontClass);
        if (parsed.fontSize) setFontSize(parsed.fontSize);
        if (parsed.lineSpacing) setLineSpacing(parsed.lineSpacing);
      } catch (e) {}
    }
  }, []);

  // Save Settings
  useEffect(() => {
    localStorage.setItem('typographySettings', JSON.stringify({
      theme, fontClass, fontSize, lineSpacing
    }));
  }, [theme, fontClass, fontSize, lineSpacing]);


  useEffect(() => {
    // When currentPage changes, calculate time spent and update stats if topic is known
    const timeSpent = Date.now() - pageStartTimeRef.current;
    if (topic && pages[currentPage - 1] && timeSpent > 2000) { // minimum 2 seconds to count as reading
      const wordCount = pages[currentPage - 1].split(/\s+/).length;
      updateReadingSpeed(topic, wordCount, timeSpent);
    }
    pageStartTimeRef.current = Date.now();
  }, [currentPage, topic, pages]);


  useEffect(() => {
    // Analyze topic if it's missing
    if (pages.length > 0 && !topic) {
      analyzeTopic(pages).then(detectedTopic => {
        if (detectedTopic) {
          setTopic(detectedTopic);
          // Don't auto-save immediately, just keep it in state until user saves or we can auto-save
        }
      }).catch(err => {
        console.warn("Topic detection fallback:", err);
        setTopic("General Reading");
      });
    }
  }, [pages, topic]);


  useEffect(() => {
    if (topic && pages.length > 0) {
      const slowTopics = getSlowTopics();
      if (slowTopics.includes(topic)) {
        // Only show if not already analyzed? Actually let's just show a banner once
        setShowDensePrompt(true);
      }
    }
  }, [topic, pages]);

  const handleFlagDense = async () => {
    setIsFlaggingDense(true);
    setShowDensePrompt(false);
    try {
      const sections = await flagDenseSections(pages.join('\n'));
      const newHighlights = sections.map((sec, idx) => ({
        id: crypto.randomUUID(),
        pageIndex: pages.findIndex(p => p.includes(sec.text)) >= 0 ? pages.findIndex(p => p.includes(sec.text)) : 0,
        text: sec.text,
        color: 'bg-red-200 dark:bg-red-900/50',
        note: `Dense Section: ${sec.reason}`,
        type: 'user',
        createdAt: Date.now()
      }));
      setHighlights(prev => [...prev, ...newHighlights]);
      alert("Flagged dense sections with red highlights!");
    } catch (err) {
      console.error(err);
      alert("Failed to flag dense sections.");
    } finally {
      setIsFlaggingDense(false);
    }
  };

  // Handle Theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  // Sync playback rate ref
  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (isNativeReadingRef.current && isPlaying) {
      speakNativeSegment(nativeSegmentIndexRef.current);
    }
  }, [playbackRate]);

  // Sync volume ref
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  // Native Browser Speech Synthesizer fallback
  const speakNativeSegment = (index: number) => {
    if (!isStreamingRef.current) return;
    const currentSegments = textSegmentsRef.current;
    if (!currentSegments || index >= currentSegments.length) {
      setIsPlaying(false);
      setActiveSegmentIndex(null);
      setIsBuffering(false);
      isNativeReadingRef.current = false;
      return;
    }

    nativeSegmentIndexRef.current = index;
    setActiveSegmentIndex(index);
    setIsPlaying(true);
    setIsBuffering(false);
    isNativeReadingRef.current = true;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const raw = currentSegments[index] || '';
    const clean = raw.replace(/[#*_`~]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) {
      speakNativeSegment(index + 1);
      return;
    }

    const effectiveFallback = selectedLanguage !== 'auto' ? selectedLanguage : (detectedDocLanguage || 'en');
    const detectedLang = detectLanguage(clean, effectiveFallback);
    const bcp47 = LANG_TO_BCP47[detectedLang] || detectedLang;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = bcp47;
    utterance.rate = playbackRateRef.current || 1.0;
    utterance.volume = Math.min(1.0, Math.max(0.1, volume));

    // Profile-specific voice mapping, pitch, and rate tuning for offline voices
    const voices = window.speechSynthesis.getVoices();
    const resolution = resolveOfflineVoice(selectedVoiceId, detectedLang, voices);

    if (resolution.voice) {
      utterance.voice = resolution.voice;
      utterance.lang = resolution.voice.lang || bcp47;
    }
    utterance.pitch = resolution.pitch;
    utterance.rate = (playbackRateRef.current || 1.0) * resolution.rate;

    utterance.onend = () => {
      if (isStreamingRef.current && isNativeReadingRef.current) {
        speakNativeSegment(index + 1);
      }
    };

    utterance.onerror = (e) => {
      console.warn("Native speech utterance error at segment", index, e);
      if (isStreamingRef.current && isNativeReadingRef.current) {
        speakNativeSegment(index + 1);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Sync Loop for Highlighting
  const syncHighlighting = () => {
    if (!audioContextRef.current || audioContextRef.current.state !== 'running') {
      animationFrameRef.current = requestAnimationFrame(syncHighlighting);
      return;
    }

    const currentTime = audioContextRef.current.currentTime;
    const currentItem = scheduleRef.current.find(
      item => currentTime >= item.startTime && currentTime < item.endTime
    );

    if (currentItem) {
      setActiveSegmentIndex(currentItem.segmentIndex);
    } else if (scheduleRef.current.length > 0 && currentTime >= scheduleRef.current[scheduleRef.current.length - 1].endTime) {
      // If we are waiting to transition to native speech after AudioContext finished playing
      if (isStreamingRef.current && audioEngine === 'native' && !isNativeReadingRef.current) {
        const lastItem = scheduleRef.current[scheduleRef.current.length - 1];
        speakNativeSegment(lastItem.segmentIndex + 1);
      } else if (!isNativeReadingRef.current) {
        setActiveSegmentIndex(null);
      }
    }

    animationFrameRef.current = requestAnimationFrame(syncHighlighting);
  };

  // Auto-scroll Effect
  useEffect(() => {
    if (autoScroll && activeSegmentIndex !== null && activeSegmentRef.current && isReadMode) {
      // Use requestAnimationFrame to ensure rendering is complete before scrolling
      requestAnimationFrame(() => {
        activeSegmentRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    }
  }, [activeSegmentIndex, autoScroll, isReadMode]);

  const stopAudio = () => {
    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
      audioAbortControllerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    gainNodeRef.current = null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isNativeReadingRef.current = false;
    setIsPlaying(false);
    setIsBuffering(false);
    setIsLongBuffering(false);
    setIsSessionActive(false);
    setLoadedPage(null);
    isStreamingRef.current = false;
    setActiveSegmentIndex(null);
    scheduleRef.current = [];
    setAudioNotice(null);
  };

  const generateTOC = (pages: string[]): TOCItem[] => {
    const newToc: TOCItem[] = [];
    pages.forEach((page, index) => {
      const lines = page.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length > 0) {
        const firstLine = lines[0];
        if (firstLine.length < 60 && !firstLine.endsWith('.')) {
          newToc.push({ title: firstLine, pageIndex: index, level: 1 });
        }
      }
    });
    return newToc;
  };

  const handleFileSelect = async (file: File) => {
    stopAudio();
    setIsReadMode(false);
    setIsEditMode(false);
    setSelectedFile(file);
    setAudioDownloadUrl(null);
    setAudioPcmData(null);
    setFullAudioState({ isGenerating: false, progress: 0, url: null });
    setState(prev => ({ ...prev, isParsing: true, error: null }));
    setPages([]);
    setCurrentPage(1);
    setSegments([]);
    setHighlights([]);
    setBookmarks([]);
    setToc([]);
    setIsSaved(false);
    setDocumentId(crypto.randomUUID());

    try {
      let result;
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        result = await parsePdfFile(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.name.endsWith('.docx')
      ) {
        result = await parseDocxFile(file);
      } else {
        result = await parseTextFile(file);
      }

      if (result.pages.length === 0 || result.pages.every(p => !p.trim())) {
        throw new Error("The file appears to be empty or text could not be extracted.");
      }

      setPages(result.pages);
      setToc(generateTOC(result.pages));
      // Don't override user's setting, but if we wanted to we could do setFontClass(result.detectedFont);
      setState(prev => ({ ...prev, isParsing: false }));
      setIsGoalPromptOpen(true);
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ 
        ...prev, 
        isParsing: false, 
        error: err.message || "Failed to parse file." 
      }));
      setSelectedFile(null);
    }
  };

  const handleClearFile = () => {
    stopAudio();
    setIsReadMode(false);
    setSelectedFile(null);
    setPages([]);
    setCurrentPage(1);
    setAudioDownloadUrl(null);
    setAudioPcmData(null);
    setFullAudioState({ isGenerating: false, progress: 0, url: null });
    setState(prev => ({ ...prev, error: null }));
    setIsSaved(false);
    setDocumentId(null);
  };


  const handleArgueCounterposition = async (text: string) => {
    if (!text.trim()) return;
    try {
      const argument = await argueCounterposition(text);
      alert(`Counter-argument:\n\n${argument}`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate counter-argument.");
    }
  };

  const handleVerifyClaim = async (text: string) => {
    if (!text.trim()) return;
    setIsVerifyingClaims(true);
    try {
      const verifications = await verifyClaims(text, pages.join('\n'));
      setClaimVerifications(prev => [...prev, ...verifications]);
      alert(`Verified ${verifications.length} claims. Check the Sidebar.`);
    } catch (err) {
      console.error(err);
      alert("Failed to verify claims.");
    } finally {
      setIsVerifyingClaims(false);
    }
  };

  const handleGenerateQTOC = async () => {
    setIsGeneratingQTOC(true);
    try {
      const qtoc = await generateQuestionTOC(pages);
      setQuestionToc(qtoc);
      alert("Question TOC generated! Check the Sidebar.");
    } catch (err) {
      console.error(err);
      alert("Failed to generate Question TOC.");
    } finally {
      setIsGeneratingQTOC(false);
    }
  };

  const handleSaveDocument = async () => {
    if (!selectedFile || pages.length === 0) return;
    
    try {
        const id = documentId || crypto.randomUUID();
        const doc: SavedDocument = {
            id,
            name: selectedFile.name,
            type: selectedFile.type,
            pages,
            createdAt: Date.now(),
            lastReadPage: currentPage,
            highlights,
            bookmarks,
            toc,
            goal,
            goalHighlights,
            mergedSummary,
            mergedConnections,
            topic,
            questionToc,
            claimVerifications
        };
        await saveDocument(doc);
        setIsSaved(true);
        setDocumentId(id);
    } catch (error) {
        console.error("Failed to save", error);
        alert("Failed to save document.");
    }
  };

  const handleMergeDocuments = async (selectedDocs: SavedDocument[]) => {
    setIsReadMode(false);
    setIsEditMode(false);
    
    const combinedPages: string[] = [];
    const documentBoundaries: {name: string, startPage: number, endPage: number}[] = [];
    
    let currentStart = 1;
    for (const doc of selectedDocs) {
      combinedPages.push(...doc.pages);
      documentBoundaries.push({
        name: doc.name,
        startPage: currentStart,
        endPage: currentStart + doc.pages.length - 1
      });
      currentStart += doc.pages.length;
    }
    
    const mergedName = `Merged: ${selectedDocs.map(d => d.name).join(', ')}`;
    
    setPages(combinedPages);
    setCurrentPage(1);
    setHighlights([]);
    setBookmarks([]);
    setToc(generateTOC(combinedPages));
    setGoal('');
    setGoalHighlights([]);
    setIsGoalModeActive(false);
    setSegments([]);
    setAudioDownloadUrl(null);
    setAudioPcmData(null);
    setFullAudioState({ isGenerating: false, progress: 0, url: null });
    setState({ isParsing: false, isGeneratingAudio: false, error: null });
    
    const realMockFile = new File([""], mergedName, { type: 'merged' });
    setSelectedFile(realMockFile);
    setDocumentId(Date.now().toString());
    setIsSaved(false);
    setShowLibrary(false);
    
    setMergedSummary(null);
    setMergedConnections([]);
    setVersionComparison(null);

    setIsAnalyzingMerged(true);
    try {
      const analysis = await analyzeMergedDocuments(combinedPages, documentBoundaries);
      setMergedSummary(analysis.summary);
      setMergedConnections(analysis.connections || []);
      
      const newHighlights = (analysis.connections || []).map((conn, idx) => ({
        id: `merge-conn-${idx}`,
        pageIndex: conn.pageIndex,
        text: conn.text,
        color: conn.type === 'contradict' ? 'bg-red-200 dark:bg-red-900/50' : 'bg-emerald-200 dark:bg-emerald-900/50',
        note: `${conn.type.toUpperCase()}: ${conn.explanation}`,
        createdAt: Date.now()
      }));
      setHighlights(newHighlights);
      
      const doc = {
        id: Date.now().toString(),
        name: mergedName,
        type: 'merged',
        pages: combinedPages,
        createdAt: Date.now(),
        lastReadPage: 1,
        highlights: [],
        bookmarks: [],
        toc: generateTOC(combinedPages),
        mergedSummary: analysis.summary,
        mergedConnections: analysis.connections || []
      };
      await saveDocument(doc);
      setIsSaved(true);
      setDocumentId(doc.id);
    } catch(e) {
      console.error(e);
      alert("Failed to analyze merged documents.");
    } finally {
      setIsAnalyzingMerged(false);
    }
  };

  const handleCompareDocument = async (oldDoc: SavedDocument) => {
    // We will ask the user to select the new version file
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.pdf,.docx';
    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      
      setShowLibrary(false);
      setIsComparingVersions(true);
      setState({ isParsing: true, isGeneratingAudio: false, error: null });
      
      try {
        let newPages: string[] = [];
        if (file.name.endsWith('.pdf')) {
            const res = await parsePdfFile(file);
            newPages = res.pages;
        } else if (file.name.endsWith('.docx')) {
            const res = await parseDocxFile(file);
            newPages = res.pages;
        } else {
            const res = await parseTextFile(file);
            newPages = res.pages;
        }
        
        const comparison = await compareDocumentVersions(oldDoc.pages, newPages, oldDoc.highlights);
        setVersionComparison(comparison);
        
        // Also load the old doc so they can see it alongside the comparison modal
        handleLoadFromLibrary(oldDoc);
      } catch (err) {
        console.error(err);
        alert("Failed to compare versions.");
      } finally {
        setIsComparingVersions(false);
        setState({ isParsing: false, isGeneratingAudio: false, error: null });
      }
    };
    input.click();
  };
  const handleLoadFromLibrary = (doc: SavedDocument) => {
    stopAudio();
    setIsReadMode(false);
    setIsEditMode(false);
    setPages(doc.pages);
    setCurrentPage(doc.lastReadPage || 1);
    setHighlights(doc.highlights || []);
    setBookmarks(doc.bookmarks || []);
    setToc(doc.toc || generateTOC(doc.pages));
    setGoal(doc.goal || '');
    setGoalHighlights(doc.goalHighlights || []);
    setIsGoalModeActive(!!doc.goal && (doc.goalHighlights?.length || 0) > 0);
    setMergedSummary(doc.mergedSummary || null);
    setMergedConnections(doc.mergedConnections || []);
    setTopic(doc.topic || '');
    setQuestionToc(doc.questionToc || []);
    setClaimVerifications(doc.claimVerifications || []);
    setSegments([]);
    setAudioDownloadUrl(null);
    setAudioPcmData(null);
    setFullAudioState({ isGenerating: false, progress: 0, url: null });
    setState({ isParsing: false, isGeneratingAudio: false, error: null });
    
    const realMockFile = new File([""], doc.name, { type: doc.type });
    
    setSelectedFile(realMockFile);
    setDocumentId(doc.id);
    setIsSaved(true);
    setShowLibrary(false);
  };

  const handlePageContentChange = (newContent: string) => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[currentPage - 1] = newContent;
      return newPages;
    });
    setIsSaved(false); // Modified
  };

  const handleGoalSubmit = async (submittedGoal: string) => {
    setIsAnalyzingGoal(true);
    setGoal(submittedGoal);
    try {
      const results = await analyzeReadingGoal(pages, submittedGoal);
      
      const enrichedResults = results.map(r => {
        const pageText = pages[r.pageIndex] || '';
        const startOffset = pageText.indexOf(r.text);
        if (startOffset !== -1) {
          return { ...r, startOffset, endOffset: startOffset + r.text.length };
        }
        return r;
      });

      setGoalHighlights(enrichedResults);
      setIsGoalModeActive(enrichedResults.length > 0);
      setIsGoalPromptOpen(false);
      
      syncDocumentState({ goal: submittedGoal, goalHighlights: enrichedResults });
      
      if (enrichedResults.length > 0) {
        setCurrentPage(enrichedResults[0].pageIndex + 1);
      }
    } catch (e) {
      console.error(e);
      setIsGoalPromptOpen(false);
    } finally {
      setIsAnalyzingGoal(false);
    }
  };

  const handleGoalSkip = () => {
    setIsGoalPromptOpen(false);
    setGoal('');
    setGoalHighlights([]);
    setIsGoalModeActive(false);
  };

  const handlePageNavigation = (page: number) => {
    if (page >= 1 && page <= pages.length) {
      setCurrentPage(page);
      
      // Update lastReadPage in DB
      if (isSaved && documentId && selectedFile) {
        saveDocument({
          id: documentId,
          name: selectedFile.name,
          type: selectedFile.type,
          pages: pages,
          createdAt: Date.now(),
          lastReadPage: page,
          highlights: highlights
        }).catch(console.error);
      }

      if (pageListRef.current) {
        const button = pageListRef.current.children[page - 1] as HTMLElement;
        if (button) {
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      
      // If we navigate while reading, pause instead of stopping completely so the player stays visible
      if (isPlaying && audioContextRef.current?.state === 'running') {
          audioContextRef.current.suspend();
          setIsPlaying(false);
      }
      
      setIsReadMode(false);
    }
  };

  const syncDocumentState = (overrides?: Partial<SavedDocument>) => {
    if (isSaved && documentId && selectedFile) {
        saveDocument({
            id: documentId,
            name: selectedFile.name,
            type: selectedFile.type,
            pages: pages,
            createdAt: Date.now(),
            lastReadPage: currentPage,
            highlights: highlights,
            bookmarks: bookmarks,
            toc: toc,
            ...overrides
        }).catch(console.error);
    }
  };

  const handleAddHighlight = (highlightData: Omit<Highlight, 'id' | 'createdAt'>) => {
      const newHighlight: Highlight = {
          ...highlightData,
          id: crypto.randomUUID(),
          createdAt: Date.now()
      };
      const updated = [...highlights, newHighlight];
      setHighlights(updated);
      syncDocumentState({ highlights: updated });
  };

  const handleUpdateHighlight = (id: string, note: string) => {
      const updated = highlights.map(h => h.id === id ? { ...h, note } : h);
      setHighlights(updated);
      syncDocumentState({ highlights: updated });
  };

  const handleDeleteHighlight = (id: string) => {
      const updated = highlights.filter(h => h.id !== id);
      setHighlights(updated);
      syncDocumentState({ highlights: updated });
  };

  const handleAddBookmark = (pageIndex: number) => {
      const newBookmark: Bookmark = {
          id: crypto.randomUUID(),
          pageIndex,
          title: `Page ${pageIndex + 1}`,
          createdAt: Date.now()
      };
      const updated = [...bookmarks, newBookmark];
      setBookmarks(updated);
      syncDocumentState({ bookmarks: updated });
  };

  const handleRemoveBookmark = (id: string) => {
      const updated = bookmarks.filter(b => b.id !== id);
      setBookmarks(updated);
      syncDocumentState({ bookmarks: updated });
  };

  const handlePageInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val)) {
        handlePageNavigation(val);
    }
  };

  const convertInt16ToFloat32 = (int16Data: Uint8Array): Float32Array => {
      const int16 = new Int16Array(int16Data.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / 32768.0;
      }
      return float32;
  };

  // Generate Audio for Current Page
  const handleGenerateAudio = async () => {
    const currentPageText = pages[currentPage - 1];
    if (!currentPageText.trim()) return;

    // 1. Prepare UI
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    gainNodeRef.current = null;
    isStreamingRef.current = false;
    
    setAudioDownloadUrl(null);
    setAudioPcmData(null);
    setState(prev => ({ ...prev, isGeneratingAudio: true, error: null }));
    setIsLongBuffering(false);
    setIsPlaying(true);
    setIsSessionActive(true); 
    setLoadedPage(currentPage); 
    
    // 2. Split Text
    let textSegments = splitIntoSentences(currentPageText);
    if (textSegments.length === 0 && currentPageText.trim().length > 0) {
      textSegments = [currentPageText.trim()];
    }
    setSegments(textSegments);
    textSegmentsRef.current = textSegments;
    setIsReadMode(true); 
    setAutoScroll(true);

    // If user explicitly selected a system voice OR running offline / on localhost without an API key:
    if (selectedVoiceId.startsWith('native:') || !process.env.API_KEY) {
      setAudioEngine('native');
      setAudioNotice(selectedVoiceId.startsWith('native:') ? "Using system voice" : "Local browser speech enabled");
      isNativeReadingRef.current = true;
      isStreamingRef.current = true;
      setIsBuffering(false);
      setIsLongBuffering(false);
      setState(prev => ({ ...prev, isGeneratingAudio: false }));
      speakNativeSegment(0);
      return;
    }

    // Check if initial audio segment is already in memory cache -> ZERO buffering!
    const firstChunkClean = textSegments[0] ? textSegments[0].replace(/[#*_`~]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const hasInitialChunk = firstChunkClean && !!getCachedSegmentAudio(firstChunkClean, selectedVoiceId);
    setIsBuffering(!hasInitialChunk);

    setAudioEngine('gemini');
    setAudioNotice(null);
    isNativeReadingRef.current = false;

    audioChunksRef.current = [];
    isStreamingRef.current = true;
    scheduleRef.current = [];
    setActiveSegmentIndex(null);

    // 3. Initialize Audio
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext({ sampleRate: 24000 });
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    audioContextRef.current = ctx;

    if (audioAbortControllerRef.current) {
      audioAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    audioAbortControllerRef.current = abortController;
    
    // Audio Graph: Source -> Gain -> Compressor -> Destination
    const gainNode = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    
    // Compressor settings to prevent clipping at high volumes
    compressor.threshold.value = -10;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;

    gainNode.gain.value = volume;
    
    // Connect chain
    gainNode.connect(compressor);
    compressor.connect(ctx.destination);
    
    gainNodeRef.current = gainNode;

    nextStartTimeRef.current = ctx.currentTime + 0.05; 

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    syncHighlighting();

    const feedbackTimer = setTimeout(() => {
        setIsLongBuffering(true);
    }, 4500); 

    try {
      let isFirstChunk = true;
      // 5. Stream Audio for Segments with parallel lookahead
      for await (const { data, segmentIndex } of streamGenerateSpeech(textSegments, selectedVoiceId, abortController.signal)) {
        if (!isStreamingRef.current || abortController.signal.aborted) break; 

        if (isFirstChunk) {
            clearTimeout(feedbackTimer);
            setIsLongBuffering(false);
            setIsBuffering(false);
            isFirstChunk = false;
        }

        audioChunksRef.current.push(data);

        // Make audio downloadable immediately from the first chunk
        if (audioChunksRef.current.length === 1) {
          setAudioPcmData(data);
          setAudioDownloadUrl(pcmUint8ToWavBlobUrl(data));
        }

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            const float32Data = convertInt16ToFloat32(data);
            const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
            buffer.getChannelData(0).set(float32Data);

            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = playbackRateRef.current;
            
            // Connect to gain node for volume control
            if (gainNodeRef.current) {
                source.connect(gainNodeRef.current);
            } else {
                source.connect(audioContextRef.current.destination);
            }
            
            const startTime = Math.max(audioContextRef.current.currentTime, nextStartTimeRef.current);
            source.start(startTime);
            
            const duration = buffer.duration / playbackRateRef.current;
            const GAP = 0.05; 
            nextStartTimeRef.current = startTime + duration + GAP;
            
            scheduleRef.current.push({
                segmentIndex: segmentIndex,
                startTime: startTime,
                endTime: startTime + duration
            });
            
            setIsBuffering(false);
        }
      }
      
      // 6. Create Download Data
      if (audioChunksRef.current.length > 0) {
          const totalLength = audioChunksRef.current.reduce((acc, c) => acc + c.length, 0);
          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const c of audioChunksRef.current) {
              combined.set(c, offset);
              offset += c.length;
          }
          setAudioPcmData(combined);
          
          const url = pcmUint8ToWavBlobUrl(combined);
          setAudioDownloadUrl(url);
      }

    } catch (err: any) {
      console.warn("Gemini TTS stream interrupted, continuing with browser speech:", err);
      clearTimeout(feedbackTimer);
      setIsLongBuffering(false);

      if (audioChunksRef.current.length > 0) {
        const totalLength = audioChunksRef.current.reduce((acc, c) => acc + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of audioChunksRef.current) {
          combined.set(c, offset);
          offset += c.length;
        }
        setAudioPcmData(combined);
        setAudioDownloadUrl(pcmUint8ToWavBlobUrl(combined));
      }

      const isQuota = err?.isQuotaExceeded || err?.statusCode === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED') || err?.message?.includes('Quota') || err?.message?.includes('quota');

      setAudioEngine('native');
      setAudioNotice(isQuota 
        ? "Gemini API rate limit reached. Continuing seamlessly with browser speech." 
        : "Gemini speech paused. Continuing with browser speech.");

      // Check where audio has scheduled so far
      const lastScheduled = scheduleRef.current[scheduleRef.current.length - 1];
      const nextIndex = lastScheduled ? lastScheduled.segmentIndex + 1 : (err.segmentIndex >= 0 ? err.segmentIndex : 0);

      // If AudioContext already has buffered audio scheduled in the future, let it finish and hand over
      if (scheduleRef.current.length > 0 && audioContextRef.current && audioContextRef.current.state === 'running') {
        const remainingTimeSec = Math.max(0, lastScheduled.endTime - audioContextRef.current.currentTime);
        console.log(`AudioContext has buffered chunks up to segment ${lastScheduled.segmentIndex}. Handing over to native speech in ${remainingTimeSec.toFixed(2)}s at segment ${nextIndex}`);
        setTimeout(() => {
          if (isStreamingRef.current && !isNativeReadingRef.current) {
            speakNativeSegment(nextIndex);
          }
        }, Math.max(50, remainingTimeSec * 1000));
      } else {
        // No buffered chunks in AudioContext, immediately start native speech from nextIndex
        speakNativeSegment(nextIndex);
      }
    } finally {
      clearTimeout(feedbackTimer);
      setIsLongBuffering(false);
      setState(prev => ({ ...prev, isGeneratingAudio: false }));
      setIsBuffering(false);
    }
  };

  // Generate Audio for Full Document
  const handleGenerateFullDocument = async () => {
    if (pages.length === 0) return;
    const fullText = pages.join('\n\n');
    if (!fullText.trim()) return;

    if (fullAudioState.url) {
        URL.revokeObjectURL(fullAudioState.url);
    }
    setFullAudioState({ isGenerating: true, progress: 0, url: null });

    try {
        let allSegments = splitIntoSentences(fullText);
        if (allSegments.length === 0 && fullText.trim().length > 0) {
          allSegments = [fullText.trim()];
        }
        const totalSegments = allSegments.length;
        
        if (totalSegments === 0) {
            throw new Error("No readable text found in document.");
        }

        const chunks: Uint8Array[] = [];
        let completed = 0;

        for await (const { data } of streamGenerateSpeech(allSegments, selectedVoiceId)) {
             chunks.push(data);
             completed++;
             // Update progress
             setFullAudioState(prev => ({ 
                 ...prev, 
                 progress: Math.min(99, Math.round((completed / totalSegments) * 100)) 
             }));
        }

        // Combine
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
            combined.set(c, offset);
            offset += c.length;
        }

        const url = pcmUint8ToWavBlobUrl(combined);
        setFullAudioState({ isGenerating: false, progress: 100, url });

    } catch (err: any) {
        console.warn("Full document generation error:", err);
        setFullAudioState({ isGenerating: false, progress: 0, url: null });
        setState(prev => ({ 
          ...prev, 
          error: "Document audio generation reached API rate limits. Please use 'Read Page Aloud' for continuous listening with browser fallback." 
        }));
    }
  };

  const togglePlayPause = () => {
      if (currentPage !== loadedPage) {
          handleGenerateAudio();
          return;
      }

      if (isNativeReadingRef.current) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          if (isPlaying) {
            window.speechSynthesis.pause();
            setIsPlaying(false);
          } else {
            if (window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
              setIsPlaying(true);
            } else {
              speakNativeSegment(nativeSegmentIndexRef.current);
            }
          }
        }
        return;
      }

      if (audioContextRef.current) {
          if (audioContextRef.current.state === 'running') {
              audioContextRef.current.suspend();
              setIsPlaying(false);
          } else if (audioContextRef.current.state === 'suspended') {
              audioContextRef.current.resume();
              setIsPlaying(true);
          }
      } else {
        handleGenerateAudio();
      }
  };

  const handleRestart = () => {
      handleGenerateAudio(); 
  };

  const handleStop = () => {
      stopAudio();
      setIsReadMode(false); 
  };

  const handleDownloadAudio = async (format: 'wav' | 'mp3') => {
    let pcm = audioPcmData;

    // If we don't have PCM data yet (e.g. read with browser speech or not yet played), generate full audio for current page
    if (!pcm || pcm.length === 0) {
      const currentPageText = pages[currentPage - 1];
      if (!currentPageText || !currentPageText.trim()) {
        setState(prev => ({ ...prev, error: "No text found on current page to download." }));
        return;
      }
      setIsPreparingAudio(true);
      try {
        const base64Audio = await generateSpeech(currentPageText, selectedVoiceId);
        pcm = base64ToUint8Array(base64Audio);
        setAudioPcmData(pcm);
        setAudioDownloadUrl(pcmUint8ToWavBlobUrl(pcm));
      } catch (err: any) {
        console.error("Failed to generate audio for download:", err);
        setState(prev => ({ 
          ...prev, 
          error: "Could not generate audio for download: " + (err?.message || String(err)) 
        }));
        setIsPreparingAudio(false);
        return;
      } finally {
        setIsPreparingAudio(false);
      }
    }

    if (!pcm || pcm.length === 0) {
      setState(prev => ({ ...prev, error: "No audio data available to download." }));
      return;
    }

    const docBaseName = (selectedFile?.name || 'document')
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .trim() || 'document';
    const filename = `${docBaseName}-page-${currentPage}.${format}`;

    try {
      if (format === 'wav') {
        const wavBlob = pcmUint8ToWavBlob(pcm);
        downloadBlob(wavBlob, filename);
      } else {
        const mp3Blob = pcmUint8ToMp3Blob(pcm);
        downloadBlob(mp3Blob, filename);
      }
    } catch (e: any) {
      console.error("Download failed:", e);
      setState(prev => ({ ...prev, error: `Failed to download ${format.toUpperCase()}: ${e?.message || String(e)}` }));
    }
  };

  const totalCharacters = pages.reduce((acc, page) => acc + page.length, 0);

  return (
    <>
      {showIntro && <IntroAnimation onComplete={() => setShowIntro(false)} />}
      
      <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans pb-24 transition-opacity duration-1000 ${showIntro ? 'opacity-0 fixed inset-0 overflow-hidden' : 'opacity-100'}`}>
        <Header 
          onOpenLibrary={() => setShowLibrary(true)} 
          isDarkMode={theme === 'dark'}
          onOpenSettings={() => setShowSettings(true)}
        />
        
        <main className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8">
          
          {state.error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3 text-red-700 dark:text-red-400 animate-fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>{state.error}</p>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 sm:p-8 space-y-8">
              
              {/* Step 1: Upload */}
              <section>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm border border-slate-200 dark:border-slate-700">1</span>
                  Upload Document
                </h2>
                <FileUploader 
                  onFileSelect={handleFileSelect} 
                  selectedFile={selectedFile}
                  onClearFile={handleClearFile}
                  isParsing={state.isParsing}
                  onSave={pages.length > 0 ? handleSaveDocument : undefined}
                  isSaved={isSaved}
                />
                {state.isParsing && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="animate-spin w-5 h-5" />
                    <span className="font-medium">
                      {isComparingVersions ? "Analyzing version differences..." : "Extracting text from document..."}
                    </span>
                  </div>
                )}
              </section>

              
          {/* Dense Prompt Banner */}
          {showDensePrompt && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-900 p-3 flex justify-between items-center text-sm">
              <span className="text-yellow-800 dark:text-yellow-200">
                You typically read <b>{topic}</b> slowly. Want me to pre-flag dense sections?
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowDensePrompt(false)}
                  className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
                >
                  Dismiss
                </button>
                <button 
                  onClick={handleFlagDense}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                >
                  Flag Sections
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Content & Voice */}
              {pages.length > 0 && !state.isParsing && (
                <section className="animate-fade-in-up">
                  <div className="my-6 border-t border-slate-100 dark:border-slate-800"></div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left Column: Voice Selection & Actions */}
                      <div className="lg:col-span-1 space-y-6">
                          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-sm border border-slate-200 dark:border-slate-700">2</span>
                            Customize Voice
                          </h2>
                          
                          <VoiceSelector 
                            selectedVoiceId={selectedVoiceId}
                            onSelectVoice={setSelectedVoiceId}
                            disabled={state.isGeneratingAudio || isPlaying || fullAudioState.isGenerating}
                            selectedLanguage={selectedLanguage}
                            onSelectLanguage={setSelectedLanguage}
                            detectedDocLanguage={detectedDocLanguage}
                          />

                          <div className="p-4 bg-indigo-50 dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-slate-700">
                              <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-2">Summary</h3>
                              <div className="space-y-2 text-sm text-indigo-700 dark:text-slate-400">
                                  <div className="flex justify-between">
                                      <span>Total Pages:</span>
                                      <span className="font-medium text-slate-800 dark:text-slate-200">{pages.length}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span>Characters:</span>
                                      <span className={`font-medium ${totalCharacters > MAX_TEXT_LENGTH ? 'text-amber-600 dark:text-amber-500' : 'text-slate-800 dark:text-slate-200'}`}>
                                          {totalCharacters.toLocaleString()}
                                      </span>
                                  </div>
                              </div>
                          </div>

                          {/* Primary Action: Read Current Page */}
                          <button
                              onClick={handleGenerateAudio}
                              disabled={(state.isGeneratingAudio && !isBuffering) || fullAudioState.isGenerating}
                              className={`
                              w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-white shadow-lg transition-all
                              ${(state.isGeneratingAudio && !isBuffering) || fullAudioState.isGenerating
                                  ? 'bg-indigo-400 cursor-not-allowed' 
                                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0'}
                              `}
                          >
                              {state.isGeneratingAudio || isPlaying ? (
                              <>
                                  <Wand2 className="w-5 h-5" />
                                  Restart Reading
                              </>
                              ) : (
                              <>
                                  <Wand2 className="w-5 h-5" />
                                  Read Page {currentPage} Aloud
                              </>
                              )}
                          </button>
                      </div>

                      {/* Right Column: Page Viewer */}
                      <div className="lg:col-span-2 flex flex-col h-[600px] border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm bg-slate-50 dark:bg-slate-900 transition-colors duration-500">
                          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 flex items-center justify-between sticky top-0 z-10">
                              <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      {isReadMode ? 'Reading Mode' : 'Document Viewer'}
                                  </span>
                              </div>
                              
                              {/* Pagination & Font Controls */}
                              <div className="flex items-center gap-2">
                                  <button 
                                      onClick={() => setAutoScroll(!autoScroll)}
                                      className={`
                                        p-1.5 rounded-md transition-colors mr-1 flex items-center gap-1.5
                                        ${autoScroll ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}
                                      `}
                                      title={autoScroll ? "Auto-scroll Enabled" : "Auto-scroll Disabled"}
                                  >
                                      <ArrowDownToLine size={16} />
                                      <span className="text-xs font-medium hidden xl:inline">Auto Scroll</span>
                                  </button>

                                  {goalHighlights.length > 0 ? (
                                    <>
                                      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                      <button 
                                          onClick={() => setIsGoalModeActive(!isGoalModeActive)}
                                          className={`
                                            p-1.5 rounded-md transition-colors flex items-center gap-1.5 mr-1
                                            ${isGoalModeActive ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 ring-1 ring-yellow-300 dark:ring-yellow-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}
                                          `}
                                          title={isGoalModeActive ? "Goal Mode Active" : "Goal Mode Disabled"}
                                      >
                                          <Target size={16} />
                                          <span className="text-xs font-medium hidden sm:inline">{isGoalModeActive ? 'Goal Mode' : 'Full Document'}</span>
                                      </button>
                                      
                                      <button 
                                          onClick={() => setIsGoalPromptOpen(true)}
                                          className="p-1.5 rounded-md transition-colors flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                                          title="Edit Reading Goal"
                                      >
                                          <Edit3 size={16} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                      <button 
                                          onClick={() => setIsGoalPromptOpen(true)}
                                          className="p-1.5 rounded-md transition-colors flex items-center gap-1.5 mr-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                                          title="Set Reading Goal"
                                      >
                                          <Target size={16} />
                                          <span className="text-xs font-medium hidden sm:inline">Set Goal</span>
                                      </button>
                                    </>
                                  )}

                                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                  
                                  <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg p-1 ml-2">
                                      <button 
                                          onClick={() => {
                                            if (isGoalModeActive) {
                                              const goalPages: number[] = Array.from(new Set(goalHighlights.map(h => h.pageIndex + 1))).sort((a, b) => a - b);
                                              const prevPage = [...goalPages].reverse().find(p => p < currentPage);
                                              if (prevPage) handlePageNavigation(prevPage);
                                            } else {
                                              handlePageNavigation(currentPage - 1);
                                            }
                                          }}
                                          disabled={isGoalModeActive ? Array.from(new Set(goalHighlights.map(h => h.pageIndex + 1))).sort((a, b) => a - b)[0] >= currentPage : currentPage <= 1}
                                          className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600 dark:text-slate-300"
                                      >
                                          <ChevronLeft size={16} />
                                      </button>
                                      
                                      <div className="flex items-center gap-1 px-2">
                                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Page</span>
                                          <input 
                                              type="number" 
                                              min={1} 
                                              max={pages.length}
                                              value={currentPage}
                                              onChange={handlePageInput}
                                              className="w-12 text-center text-sm font-semibold bg-white dark:bg-slate-600 dark:text-white border border-slate-300 dark:border-slate-500 rounded px-1 py-0.5 focus:border-indigo-500 outline-none"
                                          />
                                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">of {pages.length}</span>
                                      </div>

                                      <button 
                                          onClick={() => {
                                            if (isGoalModeActive) {
                                              const goalPages: number[] = Array.from(new Set(goalHighlights.map(h => h.pageIndex + 1))).sort((a, b) => a - b);
                                              const nextPage = goalPages.find(p => p > currentPage);
                                              if (nextPage) handlePageNavigation(nextPage);
                                            } else {
                                              handlePageNavigation(currentPage + 1);
                                            }
                                          }}
                                          disabled={isGoalModeActive ? Array.from(new Set(goalHighlights.map(h => h.pageIndex + 1))).sort((a, b) => b - a)[0] <= currentPage : currentPage >= pages.length}
                                          className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-slate-600 dark:text-slate-300"
                                      >
                                          <ChevronRight size={16} />
                                      </button>
                                  </div>
                              </div>
                          </div>

                          <div className="flex flex-1 overflow-hidden relative">
                              {/* Sidebar */}
                              <Sidebar 
                                pages={pages}
                                currentPage={currentPage}
                                onNavigate={handlePageNavigation}
                                pageListRef={pageListRef}
                                toc={toc}
                                bookmarks={bookmarks}
                                highlights={highlights}
                                goalHighlights={goalHighlights}
                                isGoalMode={isGoalModeActive}
                                mergedSummary={mergedSummary}
                                mergedConnections={mergedConnections}
                                onAddBookmark={handleAddBookmark}
                                onRemoveBookmark={handleRemoveBookmark}
                              />

                              {/* Main Text Area */}
                              <div 
                                ref={textContainerRef}
                                className={`flex-1 bg-white dark:bg-slate-900 relative overflow-y-auto custom-scrollbar ${fontClass}`}
                                style={{ fontSize: `${fontSize}px`, lineHeight: lineSpacing }}
                              >
                                  {isAnalyzingMerged ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-sm gap-4">
                                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                                      <p className="text-slate-600 dark:text-slate-300 font-medium animate-pulse">Analyzing and merging documents...</p>
                                    </div>
                                  ) : null}
                                  <DocumentViewer 
                                    content={pages[currentPage - 1]}
                                    pageIndex={currentPage - 1}
                                    fontClass={fontClass}
                                    fontSize={fontSize}
                                    lineSpacing={lineSpacing}
                                    isAudioMode={isReadMode}
                                    segments={segments}
                                    activeSegmentIndex={activeSegmentIndex}
                                    activeSegmentRef={activeSegmentRef}
                                    isEditMode={isEditMode}
                                    onContentChange={handlePageContentChange}
                                    setEditMode={setIsEditMode}
                                    highlights={highlights}
                                    goalHighlights={goalHighlights}
                                    isGoalMode={isGoalModeActive}
                                    onAddHighlight={handleAddHighlight}
                                    onUpdateHighlight={handleUpdateHighlight}
onDeleteHighlight={handleDeleteHighlight}
                                    onArgueCounterposition={handleArgueCounterposition}
                                    onVerifyClaim={handleVerifyClaim}
                                  />
                                  
                                  {isReadMode && (
                                      <button 
                                          onClick={() => {stopAudio(); setIsReadMode(false);}}
                                          className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-600 rounded-full shadow-sm hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all z-20"
                                          title="Stop Audio"
                                      >
                                          <Edit3 size={16} />
                                      </button>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
                </section>
              )}

            </div>
          </div>

          {/* Chat Widget (Bottom Right) */}
          <ChatWidget 
             documentText={pages.join('\n')} 
             currentPageText={pages[currentPage - 1] || ''}
             currentPage={currentPage}
             totalPages={pages.length || 1}
             documentTitle={selectedFile?.name || ''}
             selectedVoiceId={selectedVoiceId}
             hasBottomPlayer={isSessionActive}
          />

          {/* Floating Player (Fixed Bottom) */}
          {isSessionActive && (
            <AudioPlayer 
              audioUrl={audioDownloadUrl} 
              audioPcmData={audioPcmData}
              textSnippet={pages.join('\n\n')} 
              isPlaying={isPlaying}
              isBuffering={isBuffering}
              isLongBuffering={isLongBuffering}
              playbackRate={playbackRate}
              volume={volume}
              audioEngine={audioEngine}
              audioNotice={audioNotice}
              filename={`${(selectedFile?.name || 'document').replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim() || 'document'}-page-${currentPage}`}
              isPreparingAudio={isPreparingAudio}
              onDownloadAudio={handleDownloadAudio}
              onTogglePlay={togglePlayPause}
              onRestart={handleRestart}
              onStop={handleStop}
              onPlaybackRateChange={setPlaybackRate}
              onVolumeChange={setVolume}
            />
          )}

          {/* Library Modal */}
          <LibraryModal 
            isOpen={showLibrary} 
            onClose={() => setShowLibrary(false)}
            onLoad={handleLoadFromLibrary}
            onMerge={handleMergeDocuments}
            onCompare={handleCompareDocument}
          />

          <GoalPromptModal
            isOpen={isGoalPromptOpen}
            onSkip={handleGoalSkip}
            onSubmit={handleGoalSubmit}
            isAnalyzing={isAnalyzingGoal}
          />
          
          <VersionComparisonModal
             comparison={versionComparison}
             onClose={() => setVersionComparison(null)}
          />

          {/* Settings Modal */}
          <SettingsModal 
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            theme={theme} setTheme={setTheme}
            font={fontClass} setFont={setFontClass}
            fontSize={fontSize} setFontSize={setFontSize}
            lineSpacing={lineSpacing} setLineSpacing={setLineSpacing}
          />

        </main>
      </div>
    </>
  );
};

export default App;