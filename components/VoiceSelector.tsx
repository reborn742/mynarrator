import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AI_VOICES, SYSTEM_VOICES, ALL_VOICES } from '../constants';
import { VoiceOption } from '../types';
import { Laptop, Volume2, Globe, Sparkles, Wifi } from 'lucide-react';
import { POPULAR_LANGUAGES, LANG_TO_BCP47 } from '../services/parsers';
import { resolveOfflineVoice } from '../services/voiceHelper';
import { generateSpeech, pcmBase64ToWavBlobUrl } from '../services/geminiService';

interface VoiceSelectorProps {
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  disabled: boolean;
  selectedLanguage?: string;
  onSelectLanguage?: (langCode: string) => void;
  detectedDocLanguage?: string;
}

// Localized sample preview phrases (short, punchy phrases for instant ~200ms TTS generation)
const SAMPLE_PHRASES: Record<string, string> = {
  es: '¡Hola! Soy {name}.',
  fr: 'Bonjour! Je suis {name}.',
  de: 'Hallo! Ich bin {name}.',
  ar: 'مرحباً! أنا {name}.',
  zh: '你好！我是{name}。',
  ja: 'こんにちは！{name}です。',
  hi: 'नमस्ते! मैं {name} हूँ।',
  bn: 'নমস্কার! আমি {name}।',
  ru: 'Здравствуйте! Я {name}.',
  pt: 'Olá! Sou {name}.',
  it: 'Ciao! Sono {name}.',
  ko: '안녕하세요! {name}입니다.',
  tr: 'Merhaba! Ben {name}.',
  nl: 'Hallo! Ik ben {name}.',
  pl: 'Cześć! Jestem {name}.',
  vi: 'Xin chào! Tôi là {name}.',
  id: 'Halo! Saya {name}.',
  en: 'Hello! I am {name}.',
};

// Global memory cache for preview audio URLs so re-testing sound is 0ms instant
const previewBlobUrlCache = new Map<string, string>();
const inFlightPreviewPromises = new Map<string, Promise<string>>();

// Preload preview audio in background with zero UI impact
const preloadPreviewAudio = async (voice: VoiceOption, lang: string) => {
  const isOffline = voice.isNative || voice.id.startsWith('native:');
  if (isOffline || !process.env.API_KEY) return;

  const targetLang = lang || 'en';
  const template = SAMPLE_PHRASES[targetLang] || SAMPLE_PHRASES.en;
  const text = template.replace('{name}', voice.name);
  const cacheKey = `${voice.id}:::${targetLang}`;

  if (previewBlobUrlCache.has(cacheKey) || inFlightPreviewPromises.has(cacheKey)) return;

  try {
    const promise = (async () => {
      const base64 = await generateSpeech(text, voice.name);
      const url = pcmBase64ToWavBlobUrl(base64);
      previewBlobUrlCache.set(cacheKey, url);
      return url;
    })().finally(() => {
      inFlightPreviewPromises.delete(cacheKey);
    });

    inFlightPreviewPromises.set(cacheKey, promise);
    await promise;
  } catch {
    // Ignore preload background errors
  }
};

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ 
  selectedVoiceId, 
  onSelectVoice, 
  disabled,
  selectedLanguage = 'auto',
  onSelectLanguage,
  detectedDocLanguage = 'en'
}) => {
  const [previewState, setPreviewState] = useState<{voiceId: string, status: 'loading' | 'playing'} | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceCategory, setVoiceCategory] = useState<'online' | 'offline'>(() => 
    selectedVoiceId?.startsWith('native:') ? 'offline' : 'online'
  );
  const stopCallbackRef = useRef<(() => void) | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch installed browser speech voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setBrowserVoices(voices);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    const timer = setTimeout(loadVoices, 200);
    return () => {
      clearTimeout(timer);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Effective language: user selected or auto-detected
  const effectiveLang = selectedLanguage === 'auto' ? (detectedDocLanguage || 'en') : selectedLanguage;

  // Background warm-up / preload for selected voice and first few popular voices
  useEffect(() => {
    if (!process.env.API_KEY) return;
    const voicesToWarm = [
      AI_VOICES.find(v => v.id === selectedVoiceId) || AI_VOICES[0],
      ...AI_VOICES.slice(0, 4)
    ].filter(Boolean) as VoiceOption[];

    const timer = setTimeout(() => {
      voicesToWarm.forEach(voice => {
        preloadPreviewAudio(voice, effectiveLang);
      });
    }, 60);

    return () => clearTimeout(timer);
  }, [selectedVoiceId, effectiveLang]);

  // Cleanup audio preview on unmount
  useEffect(() => {
    return () => {
      handleStopPreview();
    };
  }, []);

  const handleStopPreview = () => {
    if (stopCallbackRef.current) {
      stopCallbackRef.current();
      stopCallbackRef.current = null;
    }
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPreviewState(null);
  };

  // 10 Distinct Offline System Voices (mapped to installed browser voices if available)
  const offlineVoices = useMemo(() => {
    if (browserVoices.length > 0) {
      const cleanLang = (effectiveLang || 'en').toLowerCase().split('-')[0];
      const langVoices = browserVoices.filter(v => 
        v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(cleanLang)
      );

      const voicePool: SpeechSynthesisVoice[] = [];
      const seen = new Set<string>();

      for (const v of langVoices) {
        if (!seen.has(v.name)) {
          seen.add(v.name);
          voicePool.push(v);
        }
      }
      for (const v of browserVoices) {
        if (!seen.has(v.name)) {
          seen.add(v.name);
          voicePool.push(v);
        }
      }

      // If browser has voices, map the 10 offline slots to 10 distinct voices with guaranteed unique IDs
      return SYSTEM_VOICES.map((sysVoice, idx) => {
        const assignedVoice = voicePool[idx % voicePool.length];
        if (!assignedVoice) return sysVoice;

        const isFemale = /female|zira|samantha|susan|hazel|victoria|karen|helena|elena|maria|laura|anna|catherine|clara|alice|monica|emma/i.test(assignedVoice.name);
        const isMale = /male|david|george|mark|alex|stefan|thomas|jorge|martin|daniel|fred|cosimo|juan|diego|paul|jean|oliver|arthur/i.test(assignedVoice.name);
        const gender: 'Male' | 'Female' = isFemale ? 'Female' : (isMale ? 'Male' : (idx % 2 === 0 ? 'Female' : 'Male'));

        const displayName = voicePool.length >= 10 
          ? assignedVoice.name 
          : `${assignedVoice.name} • ${sysVoice.name.replace('System ', '')}`;

        return {
          id: `native:offline-${idx + 1}:${assignedVoice.name}`,
          name: displayName,
          gender,
          description: `${assignedVoice.lang} • ${sysVoice.description}`,
          isNative: true,
          pitch: sysVoice.pitch,
          rate: sysVoice.rate,
        };
      });
    }
    return SYSTEM_VOICES;
  }, [browserVoices, effectiveLang]);

  // Filtered voices strictly according to category: exactly 20 Online AI or 10 Offline System
  const displayedVoices = useMemo(() => {
    if (voiceCategory === 'offline') {
      return offlineVoices; // Exactly 10 Distinct Offline System voices
    }
    return AI_VOICES; // Exactly 20 Online AI voices
  }, [voiceCategory, offlineVoices]);

  const fallbackSpeechSynthesis = (voice: VoiceOption, text: string, targetLang: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setPreviewState(null);
      return;
    }

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const bcp47 = LANG_TO_BCP47[targetLang] || targetLang;
      utterance.lang = bcp47;

      const voices = browserVoices.length > 0 ? browserVoices : window.speechSynthesis.getVoices();
      const resolution = resolveOfflineVoice(voice.id, targetLang, voices);

      if (resolution.voice) {
        utterance.voice = resolution.voice;
        utterance.lang = resolution.voice.lang || bcp47;
      }
      utterance.pitch = resolution.pitch;
      utterance.rate = resolution.rate;

      utterance.onstart = () => setPreviewState({ voiceId: voice.id, status: 'playing' });
      utterance.onend = () => {
        setPreviewState(null);
        stopCallbackRef.current = null;
      };
      utterance.onerror = () => {
        setPreviewState(null);
        stopCallbackRef.current = null;
      };

      stopCallbackRef.current = () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      };

      // Ensure immediate scheduling without lag
      setTimeout(() => {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      }, 0);
    } catch (err) {
      console.warn("Speech synthesis preview error:", err);
      setPreviewState(null);
    }
  };

  const handlePreview = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation();

    if (previewState?.voiceId === voice.id) {
      handleStopPreview();
      return;
    }

    handleStopPreview();

    const targetLang = effectiveLang || 'en';
    const template = SAMPLE_PHRASES[targetLang] || SAMPLE_PHRASES.en;
    const text = template.replace('{name}', voice.name);
    const isOffline = voice.isNative || voice.id.startsWith('native:');
    const cacheKey = `${voice.id}:::${targetLang}`;

    // 1. Check if audio is already cached in memory -> INSTANT 0ms playback!
    if (previewBlobUrlCache.has(cacheKey)) {
      const audioUrl = previewBlobUrlCache.get(cacheKey)!;
      playAudioBlobUrl(voice, audioUrl, text, targetLang);
      return;
    }

    // 2. Offline Voice Preview -> immediate speech synthesis
    if (isOffline || !process.env.API_KEY) {
      fallbackSpeechSynthesis(voice, text, targetLang);
      return;
    }

    // 3. Online AI Voice Preview with fast response & fallback
    setPreviewState({ voiceId: voice.id, status: 'loading' });

    let hasResponded = false;
    // Fast timer: if Gemini takes longer than 900ms, immediately fall back so user hears sound instantly without buffering
    const fallbackTimer = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        fallbackSpeechSynthesis(voice, text, targetLang);
      }
    }, 900);

    try {
      const base64Audio = await generateSpeech(text, voice.name);
      const audioUrl = pcmBase64ToWavBlobUrl(base64Audio);
      previewBlobUrlCache.set(cacheKey, audioUrl);

      if (!hasResponded) {
        clearTimeout(fallbackTimer);
        hasResponded = true;
        playAudioBlobUrl(voice, audioUrl, text, targetLang);
      }
    } catch (err) {
      clearTimeout(fallbackTimer);
      if (!hasResponded) {
        hasResponded = true;
        fallbackSpeechSynthesis(voice, text, targetLang);
      }
    }
  };

  const playAudioBlobUrl = (voice: VoiceOption, audioUrl: string, text: string, targetLang: string) => {
    try {
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onplay = () => setPreviewState({ voiceId: voice.id, status: 'playing' });
      audio.onended = () => {
        setPreviewState(null);
        stopCallbackRef.current = null;
        activeAudioRef.current = null;
      };
      audio.onerror = () => {
        fallbackSpeechSynthesis(voice, text, targetLang);
      };

      stopCallbackRef.current = () => {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
      };

      audio.play().catch(() => {
        fallbackSpeechSynthesis(voice, text, targetLang);
      });
    } catch {
      fallbackSpeechSynthesis(voice, text, targetLang);
    }
  };

  const detectedLangObj = POPULAR_LANGUAGES.find(l => l.code === detectedDocLanguage);

  return (
    <div className="w-full space-y-4">
      {/* Header & Language Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>Voice & Language</span>
        </h3>

        {/* Language Filter */}
        {onSelectLanguage && (
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedLanguage}
              onChange={(e) => onSelectLanguage(e.target.value)}
              disabled={disabled}
              className="text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {POPULAR_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name} {lang.nativeName !== lang.name ? `(${lang.nativeName})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Auto-Detection Indicator Badge */}
      {selectedLanguage === 'auto' && detectedLangObj && detectedLangObj.code !== 'auto' && (
        <div className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-lg text-indigo-700 dark:text-indigo-300">
          <span>Detected document language:</span>
          <span className="font-semibold">{detectedLangObj.flag} {detectedLangObj.name} ({detectedLangObj.nativeName})</span>
        </div>
      )}

      {/* Category Tabs: strictly Online AI (20) and Offline System (10) */}
      <div className="flex items-center gap-2 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setVoiceCategory('online')}
          className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
            voiceCategory === 'online'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wifi className="w-3.5 h-3.5" /> Online AI ({AI_VOICES.length})
        </button>
        <button
          type="button"
          onClick={() => setVoiceCategory('offline')}
          className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
            voiceCategory === 'offline'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Laptop className="w-3.5 h-3.5" /> Offline System ({offlineVoices.length})
        </button>
      </div>

      {/* Voice Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[360px] overflow-y-auto pr-1">
        {displayedVoices.map((voice) => {
          const isPreviewing = previewState?.voiceId === voice.id;
          const isSelected = selectedVoiceId === voice.id;
          const isOffline = voice.isNative || voice.id.startsWith('native:');

          return (
            <div
              key={voice.id}
              onClick={() => !disabled && onSelectVoice(voice.id)}
              className={`
                relative flex items-center p-3 rounded-xl border transition-all duration-200 text-left group
                ${isSelected 
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/40 ring-1 ring-indigo-500 shadow-sm' 
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700/80'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Icon / Avatar */}
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center mr-3 shrink-0 transition-colors
                ${isSelected 
                    ? 'bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-200' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
              `}>
                {isPreviewing && previewState.status === 'playing' ? (
                   <Volume2 size={20} className="animate-pulse" />
                ) : isOffline ? (
                   <Laptop size={18} />
                ) : (
                   <Sparkles size={18} className="text-indigo-500" />
                )}
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 mr-8">
                <div className="flex items-center gap-1.5">
                  <p className={`font-semibold truncate text-sm ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-800 dark:text-slate-200'}`}>
                    {voice.name}
                  </p>
                  {isOffline ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 uppercase font-mono font-medium shrink-0">
                      Offline
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 uppercase font-mono font-medium shrink-0">
                      Online AI
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {voice.gender} • {voice.description}
                </p>
              </div>
              
              {/* Preview Button */}
              <button
                type="button"
                onClick={(e) => handlePreview(e, voice)}
                disabled={disabled || (previewState !== null && previewState.voiceId !== voice.id && previewState.status === 'loading')}
                className={`
                  absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full
                  transition-all z-10
                  ${isPreviewing 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-200 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-600'}
                `}
                title="Listen to sample"
              >
                {isPreviewing && previewState.status === 'playing' ? (
                  <Volume2 size={14} className="text-white animate-pulse" />
                ) : (
                  <Volume2 size={14} />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VoiceSelector;
