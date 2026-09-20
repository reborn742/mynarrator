
import { GoogleGenAI } from '@google/genai';
import { Mp3Encoder } from '@breezystack/lamejs';
import { 
  GoalHighlightResult, 
  QuestionTOCItem, 
  ClaimVerification, 
  MergedConnection, 
  DocumentVersionComparison, 
  Highlight 
} from '../types';
import { detectLanguage, LANG_TO_BCP47 } from './parsers';
import { resolveOfflineVoice } from './voiceHelper';

const SAMPLE_RATE = 24000; // Gemini TTS standard sample rate
const MAX_CHUNK_LENGTH = 3000; // Safe character limit per request

// Helper: Decode Base64 to Uint8Array
export const base64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Type for streaming return
export interface AudioChunk {
  data: Uint8Array;
  segmentIndex: number;
}

export class GeminiTTSError extends Error {
  isQuotaExceeded: boolean;
  segmentIndex: number;
  statusCode?: number;

  constructor(message: string, isQuotaExceeded = false, segmentIndex = -1, statusCode?: number) {
    super(message);
    this.name = 'GeminiTTSError';
    this.isQuotaExceeded = isQuotaExceeded;
    this.segmentIndex = segmentIndex;
    this.statusCode = statusCode;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// In-memory cache for audio PCM segments to enable instant playback & zero-latency replays
const audioSegmentCache = new Map<string, Uint8Array>();
const inFlightSegmentRequests = new Map<string, Promise<Uint8Array>>();
const MAX_CACHE_ENTRIES = 300;

export const getCachedSegmentAudio = (cleanText: string, voiceName: string): Uint8Array | undefined => {
  const cacheKey = `${voiceName}:::${cleanText}`;
  return audioSegmentCache.get(cacheKey);
};

export const fetchSingleSegmentAudio = async (
  cleanChunk: string, 
  voiceName: string, 
  segmentIndex: number,
  signal?: AbortSignal
): Promise<Uint8Array> => {
  const cacheKey = `${voiceName}:::${cleanChunk}`;
  
  const cached = audioSegmentCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (inFlightSegmentRequests.has(cacheKey)) {
    return inFlightSegmentRequests.get(cacheKey)!;
  }

  const promise = (async (): Promise<Uint8Array> => {
    if (!process.env.API_KEY) {
      throw new Error("API Key is missing. Please check your environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
    const modelName = 'gemini-2.5-flash-preview-tts';
    const promptText = `Read aloud the following text exactly as written in its original language without translating or modifying it:\n${cleanChunk.slice(0, MAX_CHUNK_LENGTH)}`;

    let attempt = 0;
    const MAX_RETRIES = 2;

    while (attempt <= MAX_RETRIES) {
      if (signal?.aborted) {
        throw new Error("Aborted");
      }

      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ parts: [{ text: promptText }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName },
              },
            },
          },
        });

        if (signal?.aborted) {
          throw new Error("Aborted");
        }

        const candidate = response.candidates?.[0];
        if (candidate?.finishReason === 'STOP' || !candidate?.finishReason) {
          const base64Audio = candidate?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            const pcm = base64ToUint8Array(base64Audio);
            
            // Manage cache size
            if (audioSegmentCache.size >= MAX_CACHE_ENTRIES) {
              const oldestKey = audioSegmentCache.keys().next().value;
              if (oldestKey) audioSegmentCache.delete(oldestKey);
            }
            audioSegmentCache.set(cacheKey, pcm);
            return pcm;
          }
          throw new Error("No audio data returned despite successful finish reason.");
        } else if (candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'OTHER') {
          console.warn(`Segment ${segmentIndex} returned finishReason: ${candidate?.finishReason}. Skipping.`);
          return new Uint8Array(0);
        } else {
          throw new Error(`Unexpected finishReason: ${candidate?.finishReason}`);
        }
      } catch (error: any) {
        if (signal?.aborted || error?.message === "Aborted") {
          throw error;
        }
        const errorMsg = error?.message || String(error);
        const statusCode = error?.status || error?.code;
        const isRateLimit = errorMsg.includes('429') || statusCode === 429 || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('Quota exceeded') || errorMsg.includes('quota');
        const isTransient = errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504') || statusCode === 500 || statusCode === 503 || errorMsg.includes('Rpc failed') || errorMsg.includes('xhr error') || errorMsg.includes('UNKNOWN') || errorMsg.includes('fetch failed');

        if (isTransient && attempt < MAX_RETRIES) {
          attempt++;
          const delayTime = Math.pow(2, attempt) * 400 + Math.random() * 200;
          await sleep(delayTime);
        } else if (isRateLimit) {
          console.warn(`Segment ${segmentIndex}: Rate limit reached. Handing over to browser speech.`);
          throw new GeminiTTSError(errorMsg, true, segmentIndex, 429);
        } else {
          if (errorMsg.includes("API Key")) {
            throw error;
          }
          throw new GeminiTTSError(errorMsg, false, segmentIndex, statusCode);
        }
      }
    }

    throw new Error("Failed to generate audio after retries.");
  })().finally(() => {
    inFlightSegmentRequests.delete(cacheKey);
  });

  inFlightSegmentRequests.set(cacheKey, promise);
  return promise;
};

// Prefetch upcoming segments in background so playback starts and continues instantly
export const prefetchSpeech = (segments: string[], voiceName: string, maxCount = 3): void => {
  if (!process.env.API_KEY) return;
  const targetSegments = segments.slice(0, maxCount);
  for (let i = 0; i < targetSegments.length; i++) {
    const chunk = targetSegments[i];
    const cleanChunk = chunk ? chunk.replace(/[#*_`~]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    if (cleanChunk && cleanChunk.length >= 1) {
      const cacheKey = `${voiceName}:::${cleanChunk}`;
      if (!audioSegmentCache.has(cacheKey) && !inFlightSegmentRequests.has(cacheKey)) {
        fetchSingleSegmentAudio(cleanChunk, voiceName, i).catch(() => {});
      }
    }
  }
};

// Pipelined Generator that yields chunks of audio data with lookahead prefetching
export async function* streamGenerateSpeech(
  segments: string[], 
  voiceName: string,
  signal?: AbortSignal
): AsyncGenerator<AudioChunk, void, unknown> {
  const PREFETCH_LOOKAHEAD = 3; // Concurrently prefetch next 3 segments ahead

  for (let i = 0; i < segments.length; i++) {
    if (signal?.aborted) break;

    const chunk = segments[i];
    const cleanChunk = chunk ? chunk.replace(/[#*_`~]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    if (!cleanChunk || cleanChunk.length < 1) continue;

    // Trigger lookahead prefetching for the next segments in parallel
    for (let ahead = 1; ahead <= PREFETCH_LOOKAHEAD; ahead++) {
      const aheadIdx = i + ahead;
      if (aheadIdx < segments.length) {
        const nextChunk = segments[aheadIdx];
        const nextClean = nextChunk ? nextChunk.replace(/[#*_`~]/g, ' ').replace(/\s+/g, ' ').trim() : '';
        if (nextClean && nextClean.length >= 1) {
          fetchSingleSegmentAudio(nextClean, voiceName, aheadIdx, signal).catch(() => {});
        }
      }
    }

    // Await audio for current segment (may already be in cache or in-flight from previous iterations)
    const pcm = await fetchSingleSegmentAudio(cleanChunk, voiceName, i, signal);
    
    if (signal?.aborted) break;

    if (pcm && pcm.length > 0) {
      yield {
        data: pcm,
        segmentIndex: i
      };
    }
  }
}

// In-memory cache for full audio speech generation (e.g. preview audio, full page generations)
const fullAudioSpeechCache = new Map<string, string>();
const inFlightGenerateSpeechRequests = new Map<string, Promise<string>>();

// Fast, cached speech generator for voice previews and audio samples
export const generateSpeech = async (text: string, voiceName: string): Promise<string> => {
  const cleanText = text.replace(/[#*_`~]/g, ' ').replace(/\s+/g, ' ').trim();
  const cacheKey = `${voiceName}:::${cleanText}`;

  // 1. Return immediately from in-memory cache if available
  const cached = fullAudioSpeechCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 2. Reuse in-flight request if another caller is already fetching this exact sample
  const inFlight = inFlightGenerateSpeechRequests.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const promise = (async (): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
    const modelName = 'gemini-2.5-flash-preview-tts';
    const promptText = `Read aloud the following text exactly as written in its original language without translating or modifying it:\n${cleanText}`;
    
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error(`No audio returned. Reason: ${response.candidates?.[0]?.finishReason}`);
    }

    // Manage cache size
    if (fullAudioSpeechCache.size >= 250) {
      const oldest = fullAudioSpeechCache.keys().next().value;
      if (oldest) fullAudioSpeechCache.delete(oldest);
    }
    fullAudioSpeechCache.set(cacheKey, base64Audio);

    return base64Audio;
  })().finally(() => {
    inFlightGenerateSpeechRequests.delete(cacheKey);
  });

  inFlightGenerateSpeechRequests.set(cacheKey, promise);
  return promise;
};

// Chat Response Generation
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatOptions {
  documentTitle?: string;
  currentPage?: number;
  totalPages?: number;
  currentPageText?: string;
  signal?: AbortSignal;
}

export const sanitizeChatHistory = (history: ChatMessage[]): { role: 'user' | 'model'; parts: { text: string }[] }[] => {
  const valid: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  
  const filtered = history.filter(m => 
    m.text && 
    m.text.trim().length > 0 &&
    !m.text.startsWith("Sorry, I encountered an error") &&
    !m.text.startsWith("Hi! I can answer questions")
  );

  for (const msg of filtered) {
    if (valid.length === 0) {
      if (msg.role === 'user') {
        valid.push({ role: 'user', parts: [{ text: msg.text }] });
      }
    } else {
      const last = valid[valid.length - 1];
      if (last.role === msg.role) {
        last.parts[0].text += `\n\n${msg.text}`;
      } else {
        valid.push({ role: msg.role, parts: [{ text: msg.text }] });
      }
    }
  }

  // If the last item in valid is 'user', remove it since the new message is passed in sendMessage
  if (valid.length > 0 && valid[valid.length - 1].role === 'user') {
    valid.pop();
  }

  return valid.slice(-12);
};

const buildChatSystemInstruction = (documentContext: string, options?: ChatOptions): string => {
  let instruction = `You are a helpful, brilliant, and friendly AI reading companion in the Reader app.
Your mission is to help the reader understand, explore, critique, and summarize their documents.

GUIDELINES:
- Format your answers beautifully using Markdown: use bold text for key terms, concise bullet points or numbered lists, and clear paragraphs.
- Keep your answers direct, articulate, and engaging.
- If a document is uploaded, base your answers primarily on its contents. If the user asks something beyond the document, answer helpfully while clarifying what is from the document versus general knowledge.
- If asked to summarize or explain something on the current page, prioritize the current page text.
`;

  if (documentContext && documentContext.trim().length > 0) {
    const truncatedContext = documentContext.slice(0, 300000);
    instruction += `\nDOCUMENT INFORMATION:
${options?.documentTitle ? `Title: ${options.documentTitle}\n` : ''}${options?.currentPage && options?.totalPages ? `Current Position: Page ${options.currentPage} of ${options.totalPages}\n` : ''}
${options?.currentPageText ? `CURRENT PAGE EXCERPT:\n"""\n${options.currentPageText.slice(0, 8000)}\n"""\n` : ''}
DOCUMENT CONTENT START:
${truncatedContext}
DOCUMENT CONTENT END
`;
  } else {
    instruction += `\nNOTE: No document is currently open. You can answer general knowledge questions, discuss literature, help with writing or reading strategies, or encourage the user to upload a PDF, DOCX, or TXT document.`;
  }

  return instruction;
};

export const generateChatResponse = async (
  documentContext: string, 
  history: ChatMessage[], 
  newMessage: string,
  options?: ChatOptions
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
  const model = 'gemini-3.8-flash';
  const systemInstruction = buildChatSystemInstruction(documentContext, options);
  const formattedHistory = sanitizeChatHistory(history);

  const chat = ai.chats.create({
    model: model,
    config: {
      systemInstruction: systemInstruction,
    },
    history: formattedHistory
  });

  const result = await chat.sendMessage({ message: newMessage });
  return result.text || "I'm sorry, I couldn't generate a response.";
};

export const streamChatResponse = async (
  documentContext: string,
  history: ChatMessage[],
  newMessage: string,
  onChunk: (text: string) => void,
  options?: ChatOptions
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
  const model = 'gemini-3.8-flash';
  const systemInstruction = buildChatSystemInstruction(documentContext, options);
  const formattedHistory = sanitizeChatHistory(history);

  const chat = ai.chats.create({
    model: model,
    config: {
      systemInstruction: systemInstruction,
    },
    history: formattedHistory
  });

  const streamResponse = await chat.sendMessageStream({ message: newMessage });
  let accumulated = '';

  for await (const chunk of streamResponse) {
    if (options?.signal?.aborted) {
      break;
    }
    const text = chunk.text;
    if (text) {
      accumulated += text;
      onChunk(text);
    }
  }

  return accumulated || "I'm sorry, I couldn't generate a response.";
};

export const playSpeechWithFallback = async (
  text: string, 
  voiceName: string, 
  onStart?: () => void, 
  onEnd?: () => void
): Promise<{ stop: () => void }> => {
  const cleanText = text
    .replace(/[#*_`~]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\n+/g, '. ')
    .trim();

  const playWebSpeech = (): { stop: () => void } => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return { stop: () => {} };
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 1500));
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    const detectedLang = detectLanguage(cleanText, 'en');
    utterance.lang = LANG_TO_BCP47[detectedLang] || detectedLang;

    const voices = window.speechSynthesis.getVoices();
    const resolution = resolveOfflineVoice(voiceName, detectedLang, voices);
    if (resolution.voice) {
      utterance.voice = resolution.voice;
      utterance.lang = resolution.voice.lang || utterance.lang;
    }
    utterance.pitch = resolution.pitch;
    utterance.rate = resolution.rate;
    
    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
    return {
      stop: () => {
        window.speechSynthesis.cancel();
        onEnd?.();
      }
    };
  };

  // If voice is a native system voice or running offline without API key, use web speech immediately
  if (voiceName?.startsWith('native:') || !process.env.API_KEY) {
    return playWebSpeech();
  }

  try {
    if (cleanText.length <= 400 && process.env.API_KEY) {
      const base64Audio = await generateSpeech(cleanText.slice(0, 400), voiceName);
      const audioUrl = pcmBase64ToWavBlobUrl(base64Audio);
      const audio = new Audio(audioUrl);
      
      onStart?.();
      audio.onended = () => onEnd?.();
      audio.onerror = () => {
        playWebSpeech();
      };
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise.catch(() => {
          playWebSpeech();
        });
      }
      return {
        stop: () => {
          audio.pause();
          audio.currentTime = 0;
          onEnd?.();
        }
      };
    } else {
      return playWebSpeech();
    }
  } catch (err) {
    console.warn("TTS fallback engaged:", err);
    return playWebSpeech();
  }
};

// WAV Headers logic
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const addWavHeader = (pcmData: Uint8Array, sampleRate: number): ArrayBuffer => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const pcmBytes = new Uint8Array(buffer, 44);
  pcmBytes.set(pcmData);

  return buffer;
};

export const pcmBase64ToWavBlobUrl = (base64: string): string => {
  const pcmData = base64ToUint8Array(base64);
  return pcmUint8ToWavBlobUrl(pcmData);
};

export const pcmUint8ToWavBlob = (pcmData: Uint8Array): Blob => {
  const wavBuffer = addWavHeader(pcmData, SAMPLE_RATE);
  return new Blob([wavBuffer], { type: 'audio/wav' });
};

export const pcmUint8ToWavBlobUrl = (pcmData: Uint8Array): string => {
  const blob = pcmUint8ToWavBlob(pcmData);
  return URL.createObjectURL(blob);
};

// MP3 Conversion using @breezystack/lamejs
export const pcmUint8ToMp3Blob = (pcmData: Uint8Array): Blob => {
  try {
    const numSamples = Math.floor(pcmData.length / 2);
    const int16Data = new Int16Array(numSamples);
    const dataView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    for (let i = 0; i < numSamples; i++) {
      int16Data[i] = dataView.getInt16(i * 2, true);
    }

    const EncoderClass = Mp3Encoder || (typeof window !== 'undefined' && (window as any).lamejs?.Mp3Encoder);
    if (!EncoderClass) {
      throw new Error("MP3 encoder module is not available.");
    }

    const mp3encoder = new EncoderClass(1, SAMPLE_RATE, 128);
    const mp3Data: Uint8Array[] = [];

    const sampleBlockSize = 1152;
    for (let i = 0; i < int16Data.length; i += sampleBlockSize) {
      const chunk = int16Data.subarray(i, Math.min(i + sampleBlockSize, int16Data.length));
      const mp3buf = mp3encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }

    const flush = mp3encoder.flush();
    if (flush.length > 0) {
      mp3Data.push(new Uint8Array(flush));
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  } catch (e: any) {
    console.error("MP3 Encoding failed", e);
    throw new Error("Failed to encode MP3: " + (e?.message || String(e)));
  }
};

export const pcmUint8ToMp3BlobUrl = (pcmData: Uint8Array): string => {
  const blob = pcmUint8ToMp3Blob(pcmData);
  return URL.createObjectURL(blob);
};

// Safe and cross-browser Blob download trigger
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 1500);
};
export const analyzeReadingGoal = async (pages: string[], goal: string): Promise<GoalHighlightResult[]> => {
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
    return [];
  }
  const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
  const model = 'gemini-3.8-flash';
  
  const documentContext = pages.map((page, i) => `--- PAGE ${i} ---\n${page}`).join('\n\n');
  const truncatedContext = documentContext.slice(0, 1000000); 

  const systemInstruction = `You are a helpful AI reading assistant. 
The user has provided a document and a specific goal for reading it.
Your task is to identify the most relevant sections of the document that help the user achieve their goal.

Return a JSON array of objects. Each object MUST have:
- "pageIndex": the integer index of the page (e.g. 0, 1, 2).
- "text": the exact, literal string from the document text to highlight. It MUST be an exact substring of the text on that page. Do not alter it.
- "reason": a short, 1-2 sentence explanation of why this section is relevant to the goal.

Limit to at most 15 highlights. If nothing is relevant, return an empty array.
`;

  const chat = ai.chats.create({
    model: model,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `Goal: ${goal}\n\nDocument Content:\n${truncatedContext}`;
  
  const result = await chat.sendMessage({ message: prompt });
  const responseText = result.text;
  
  if (!responseText) return [];
  
  try {
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr) as GoalHighlightResult[];
  } catch (e) {
    console.error("Failed to parse goal analysis JSON:", e);
    return [];
  }
};

export const analyzeReadingDebt = async (pages: string[], lastReadPage: number, timeSinceOpenedMs: number): Promise<{reason: string, condensedSummary: string}> => {
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
    return {
      reason: "Document paused for later reading.",
      condensedSummary: pages.slice(0, 2).join('\n\n').slice(0, 400) + '...'
    };
  }
  const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
  const model = 'gemini-3.8-flash';
  
  const daysSinceOpened = timeSinceOpenedMs / (1000 * 60 * 60 * 24);
  const percentRead = (lastReadPage / pages.length) * 100;
  
  const context = `The user read ${percentRead.toFixed(1)}% of a ${pages.length}-page document and hasn't opened it in ${daysSinceOpened.toFixed(1)} days.
  Here are the first few pages and the page they stopped on:
  First 2 pages:
  ${pages.slice(0, 2).join('\n')}
  
  Stopped at page ${lastReadPage}:
  ${pages[lastReadPage - 1]}
  `;

  const systemInstruction = `You are a helpful AI reading assistant.
Based on the reading behavior and the content, infer a likely reason the user abandoned this document (e.g., too dense, not urgent, lost interest).
Also, generate a condensed 2-paragraph summary of the ENTIRE document (or what you can infer) to help them finish it quickly.
Return a JSON object with:
- "reason": A short 1-sentence inferred reason.
- "condensedSummary": A 2-paragraph summary.`;

  const response = await ai.models.generateContent({
    model,
    contents: context,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    }
  });

  return JSON.parse(response.text || '{}');
};

export const analyzeMergedDocuments = async (mergedPages: string[], documentBoundaries: {name: string, startPage: number, endPage: number}[]): Promise<{summary: string, connections: MergedConnection[]}> => {
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
    return {
      summary: "Merged document analysis requires an active Gemini API key.",
      connections: []
    };
  }
  const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
  const model = 'gemini-3.8-flash';
  
  const context = mergedPages.map((page, i) => `--- PAGE ${i} ---\n${page}`).join('\n\n');
  const boundariesInfo = documentBoundaries.map(b => `${b.name} is from page ${b.startPage} to ${b.endPage}`).join('\n');

  const systemInstruction = `You are a helpful AI reading assistant.
The user is reading multiple documents merged into one session.
Documents mapping:
${boundariesInfo}

Analyze the content and identify where the documents agree, contradict each other, or cover the same ground redundantly.
Return a JSON object with:
- "summary": A 2-3 paragraph summary of the contradictions and gaps found across the set.
- "connections": An array of objects, each with:
  - "type": "agree" | "contradict" | "redundant"
  - "pageIndex": integer, the page index (0-based) where this connection occurs.
  - "text": exact literal string from that page.
  - "explanation": 1-2 sentence explanation of how it agrees, contradicts, or is redundant with another document.
Limit connections to the top 10 most important ones.`;

  const response = await ai.models.generateContent({
    model,
    contents: context.slice(0, 1000000), // truncate if too long
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    }
  });

  return JSON.parse(response.text || '{}');
};


export async function generateQuestionTOC(pages: string[]): Promise<QuestionTOCItem[]> {
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') return [];
  try {
    const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });

    // Limit to first 10 pages for TOC generation to save tokens
    const samplePages = pages.slice(0, 10);
    const documentContext = samplePages.map((page, index) => `[PAGE ${index + 1}]\n${page}`).join("\n\n---\n\n");

    const prompt = `
Analyze the provided document pages and generate a "Question-Based Table of Contents".
Instead of traditional headings, formulate the core question that each major section answers.

Respond with a JSON object containing an array of "toc" items.
Each item must have:
- "question": A clear, concise question that the section answers.
- "pageIndex": The 0-based index of the page where this section begins.

JSON Schema:
{
  "toc": [
    { "question": "string", "pageIndex": "number" }
  ]
}

Document Content:
${documentContext}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text;
    if (!resultText) return [];

    const result = JSON.parse(resultText);
    return result.toc || [];
  } catch (error) {
    console.warn("Question TOC unavailable:", error);
    return [];
  }
}

export async function analyzeTopic(pages: string[]): Promise<string> {
  if (!pages || pages.length === 0) return "General Reading";

  // Fast, zero-latency local classifier for localhost or when offline / on 500 error
  const detectLocalTopic = (sampleText: string): string => {
    const lower = sampleText.toLowerCase();
    if (/\b(algorithm|neural|dataset|python|javascript|typescript|software|api|server|database|query|cloud|cpu|gpu|network|react|component|code|programming|dev|system)\b/.test(lower)) {
      return "Technology & Computer Science";
    }
    if (/\b(patient|clinical|diagnosis|therapy|disease|medical|syndrome|drug|surgery|doctor|hospital|health|medicine)\b/.test(lower)) {
      return "Medicine & Health";
    }
    if (/\b(contract|agreement|clause|party|court|lawyer|legal|statute|jurisdiction|liability|compliance|law)\b/.test(lower)) {
      return "Law & Legal";
    }
    if (/\b(revenue|profit|margin|stock|equity|dividend|inflation|gdp|market|investment|asset|portfolio|quarter|finance|business|accounting)\b/.test(lower)) {
      return "Business & Finance";
    }
    if (/\b(century|empire|revolution|war|treaty|dynasty|republic|colony|historical|history|president|government|politics)\b/.test(lower)) {
      return "History & Politics";
    }
    if (/\b(quantum|physics|relativity|electron|molecule|chemical|reaction|organism|species|evolution|astronomy|galaxy|science)\b/.test(lower)) {
      return "Science & Physics";
    }
    if (/\b(novel|chapter|character|protagonist|dialogue|story|narrative|fiction|literature)\b/.test(lower)) {
      return "Literature & Fiction";
    }
    if (/\b(philosophy|philosophical|ethics|moral|epistemology|metaphysics|consciousness|logic)\b/.test(lower)) {
      return "Philosophy";
    }
    return "General Reading";
  };

  const samplePages = pages.slice(0, 3).join("\n\n").slice(0, 4000);

  // If no API key or empty on localhost, use local classifier immediately
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
    return detectLocalTopic(samplePages);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
    const prompt = `Analyze this text and output a single, broad topic category for it (e.g., "Science", "History", "Fiction", "Technical Documentation", "News", "Business"). Reply ONLY with the category name string, no other text.

Text:
${samplePages}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });
    const topic = (response.text || "").trim();
    if (topic && topic.length > 0 && topic.length < 50) {
      return topic;
    }
    return detectLocalTopic(samplePages);
  } catch (error: any) {
    // Avoid red 500 error in console; gracefully fallback to heuristic classifier
    console.warn("Topic analysis fallback engaged:", error?.message || error);
    return detectLocalTopic(samplePages);
  }
}

export async function argueCounterposition(text: string): Promise<string> {
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
    return "Counterposition analysis requires an API key in localhost.";
  }
  try {
    const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
    const prompt = `
Take the following claim or statement, and construct the strongest possible counter-argument or opposing position against it. Be direct, logical, and persuasive. Do not be neutral; actively argue against the provided text. Keep it concise (1-2 short paragraphs).

Statement to argue against:
"${text}"
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });
    return response.text || "Could not generate a counter-argument.";
  } catch (error) {
    console.warn("Error generating counterposition:", error);
    return "Error generating counterposition.";
  }
}

export async function verifyClaims(pageContent: string, fullContext?: string): Promise<ClaimVerification[]> {
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') return [];
  const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });

  const contextSection = fullContext ? `\nFull Document Context for reference:\n${fullContext.slice(0, 100000)}\n` : '';

  const prompt = `
Analyze the following text and extract significant factual claims or statistics.
For each claim, determine if it is clearly sourced/cited within the provided text itself.
Then, use your knowledge (or search capability) to evaluate if the claim is generally supported by established facts.
${contextSection}
Respond with a JSON object containing an array of "verifications".
Each item must have:
- "id": A unique string ID
- "claim": The extracted claim text
- "hasSource": Boolean indicating if the text cites a source for this claim
- "isSupported": Boolean indicating if the claim is generally considered true or supported by evidence
- "explanation": A brief 1-2 sentence explanation of why it is supported or unsupported, or noting the lack of citation.

JSON Schema:
{
  "verifications": [
    { "id": "string", "claim": "string", "hasSource": "boolean", "isSupported": "boolean", "explanation": "string" }
  ]
}

Text to analyze:
${pageContent}
`;

  try {
    // Note: To use actual web search grounding in GenAI SDK:
    // config: { tools: [{ googleSearch: {} }] }
    // However, using it with JSON responseMimeType sometimes conflicts in older versions, 
    // but we will try to use it if it's supported, otherwise it falls back to model knowledge.
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      },
    });

    const resultText = response.text;
    if (!resultText) return [];

    const result = JSON.parse(resultText);
    return result.verifications || [];
  } catch (error) {
    console.error("Error verifying claims:", error);
    return [];
  }
}

export async function compareDocumentVersions(oldPages: string[], newPages: string[], oldHighlights?: Highlight[]): Promise<DocumentVersionComparison> {
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
    return {
      summary: "Document version comparison requires an API key in localhost.",
      importantChanges: [],
      minorChanges: [],
      invalidatedHighlights: []
    };
  }
  const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
  
  const oldText = oldPages.slice(0, 15).join('\n'); // Limit for context size
  const newText = newPages.slice(0, 15).join('\n');
  const highlightsContext = oldHighlights && oldHighlights.length > 0 
    ? `The user had previously highlighted these important facts/notes from the OLD version:\n${oldHighlights.map(h => `- "${h.text}" (Note: ${h.note || 'None'})`).join('\n')}\n\nPlease explicitly check if any of these highlighted facts are now CONTRADICTED or OUTDATED in the new version. If so, list them in the "invalidatedHighlights" array.`
    : '';

  const prompt = `
Compare the following two versions of a document. 
Generate a plain-language summary of what changed, highlighting changes that matter versus minor edits.
${highlightsContext}

Respond with a JSON object:
{
  "summary": "A concise paragraph summarizing the overall changes.",
  "importantChanges": ["Key change 1", "Key change 2"],
  "minorChanges": ["Minor edit 1", "Minor edit 2"],
  "invalidatedHighlights": [
    { 
      "originalText": "The highlighted text from the old version that is no longer accurate", 
      "note": "The user's original note (if any)",
      "reason": "Why it is now contradicted or outdated based on the new version" 
    }
  ]
}

=== OLD VERSION ===
${oldText}

=== NEW VERSION ===
${newText}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No response");
    
    return JSON.parse(resultText) as DocumentVersionComparison;
  } catch (error) {
    console.error("Error comparing versions:", error);
    return {
      summary: "Failed to compare documents.",
      importantChanges: [],
      minorChanges: [],
      invalidatedHighlights: []
    };
  }
}

export const flagDenseSections = async (content: string): Promise<{ text: string; reason: string }[]> => {
  if (!process.env.API_KEY || process.env.API_KEY.trim() === '') return [];
  const ai = new GoogleGenAI({ apiKey: 'proxied-server-side', httpOptions: { baseUrl: '/api/gemini' } });
  
  const prompt = `
  You are an expert reading assistant. The user historically reads this topic slowly.
  Analyze the following document and identify 1-3 dense, complex, or highly technical sections that might slow them down.
  For each section, extract the exact text and explain briefly why it's dense.
  
  Document:
  ${content.substring(0, 20000)}

  Return a JSON array of objects with keys "text" (exact quote) and "reason".
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("Failed to flag dense sections:", error);
    return [];
  }
};
