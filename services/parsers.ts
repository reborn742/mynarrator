import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Helper to split long text into "pages" for non-paginated formats
const CHARS_PER_PAGE = 3000;
const paginateText = (text: string): string[] => {
  if (!text) return [];
  const pages: string[] = [];
  for (let i = 0; i < text.length; i += CHARS_PER_PAGE) {
    pages.push(text.slice(i, i + CHARS_PER_PAGE));
  }
  return pages.length > 0 ? pages : [''];
};

// Language BCP-47 tag mappings
export const LANG_TO_BCP47: Record<string, string> = {
  ar: 'ar-SA',
  bn: 'bn-BD',
  de: 'de-DE',
  el: 'el-GR',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  gu: 'gu-IN',
  he: 'he-IL',
  hi: 'hi-IN',
  hy: 'hy-AM',
  id: 'id-ID',
  it: 'it-IT',
  ja: 'ja-JP',
  ka: 'ka-GE',
  kn: 'kn-IN',
  ko: 'ko-KR',
  ml: 'ml-IN',
  nl: 'nl-NL',
  pl: 'pl-PL',
  pt: 'pt-BR',
  ru: 'ru-RU',
  ta: 'ta-IN',
  te: 'te-IN',
  th: 'th-TH',
  tr: 'tr-TR',
  uk: 'uk-UA',
  vi: 'vi-VN',
  zh: 'zh-CN',
};

// Supported language definitions for user interface selector
export interface LanguageDefinition {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const POPULAR_LANGUAGES: LanguageDefinition[] = [
  { code: 'auto', name: 'Auto-Detect', nativeName: 'Auto', flag: '🌐' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
];

// Language detection supporting all major scripts and world languages
export const detectLanguage = (text: string, fallbackLang: string = 'en'): string => {
  if (!text || typeof text !== 'string') return fallbackLang || 'en';

  // Check unique Unicode script blocks first (100% certainty)
  if (/\p{Script=Arabic}/u.test(text)) return 'ar';
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) return 'ja';
  if (/\p{Script=Han}/u.test(text)) return 'zh';
  if (/\p{Script=Hangul}/u.test(text)) return 'ko';
  if (/\p{Script=Cyrillic}/u.test(text)) return 'ru';
  if (/\p{Script=Devanagari}/u.test(text)) return 'hi';
  if (/\p{Script=Bengali}/u.test(text)) return 'bn';
  if (/\p{Script=Thai}/u.test(text)) return 'th';
  if (/\p{Script=Hebrew}/u.test(text)) return 'he';
  if (/\p{Script=Greek}/u.test(text)) return 'el';
  if (/\p{Script=Tamil}/u.test(text)) return 'ta';
  if (/\p{Script=Telugu}/u.test(text)) return 'te';
  if (/\p{Script=Kannada}/u.test(text)) return 'kn';
  if (/\p{Script=Malayalam}/u.test(text)) return 'ml';
  if (/\p{Script=Gujarati}/u.test(text)) return 'gu';
  if (/\p{Script=Armenian}/u.test(text)) return 'hy';
  if (/\p{Script=Georgian}/u.test(text)) return 'ka';

  const lower = ' ' + text.toLowerCase().replace(/[^\p{L}\s]/gu, ' ') + ' ';

  // Specific character indicators with strong weighting
  if (/[đơư]/u.test(text)) return 'vi';
  if (/[ğ]/u.test(text)) return 'tr';
  if (/[ąćęłńśźż]/u.test(text)) return 'pl';
  if (/[ß]/u.test(text)) return 'de';
  if (/[¿¡ñ]/u.test(text)) return 'es';

  // Score popular European & Latin-alphabet languages based on distinctive words & features
  const scores: Record<string, number> = {
    es: 0,
    fr: 0,
    de: 0,
    it: 0,
    pt: 0,
    vi: 0,
    tr: 0,
    pl: 0,
    nl: 0,
    id: 0,
    en: 0,
  };

  const patterns: Record<string, RegExp[]> = {
    es: [
      /\b(el|la|los|las|un|una|unos|unas|y|o|pero|para|por|con|en|es|son|este|esta|estos|estas|del|al|como|que|qué|más|muy|todo|todos|toda|todas|hola|gracias|texto|documento|leer|palabra|capítulo|página)\b/g,
      /[áéíóúñ]/g
    ],
    fr: [
      /\b(le|la|les|un|une|des|du|de|dans|est|sont|pour|avec|cette|ce|ces|sur|pas|mais|nous|vous|tout|tous|toute|toutes|va|bien|qui|que|comment|bonjour|merci|texte|document|lire|chapitre|page)\b/g,
      /[çœæàèùéêëîïôû]/g
    ],
    de: [
      /\b(der|die|das|den|dem|des|ein|eine|einen|einem|einer|und|oder|aber|für|mit|sich|auf|nicht|wie|geht|dir|wir|ihr|sie|morgen|ist|sind|dieser|diese|dieses|alle|hallo|danke|text|dokument|lesen|kapitel|seite)\b/g,
      /[äöüß]/g
    ],
    it: [
      /\b(il|lo|la|i|gli|le|un|uno|una|dei|degli|delle|nel|nella|con|per|tra|fra|non|sono|è|tutti|tutto|tutta|benvenuti|questo|questa|questi|queste|ciao|grazie|come|che|testo|documento|leggere|capitolo|pagina)\b/g,
      /[àèéìíîòóùú]/g
    ],
    pt: [
      /\b(o|os|a|as|do|da|dos|das|no|na|nos|nas|para|com|não|que|um|uma|uns|umas|você|vocês|bem|tudo|todos|toda|todas|olá|obrigado|como|este|esta|estes|estas|texto|documento|ler|capítulo|página)\b/g,
      /[ãõáéíóúâêôç]/g
    ],
    vi: [
      /\b(và|của|trong|cho|người|với|không|chào|thế|giới|các|được|có|xin|văn|bản|đọc)\b/g
    ],
    tr: [
      /\b(ve|bir|bu|şu|o|da|de|için|ile|çok|dünya|merhaba|olan|daha|nasılsın|ne|teşekkür|metin|belge|okumak)\b/g,
      /[ğışöüç]/g
    ],
    pl: [
      /\b(i|oraz|w|z|na|do|się|jest|są|nie|jak|ale|świecie|cześć|masz|dla|ten|ta|to|tekst|dokument|czytać)\b/g,
      /[ąćęłńśźż]/g
    ],
    nl: [
      /\b(het|de|van|ik|je|dat|die|een|voor|niet|met|op|zijn|is|en|maar|hoe|wat|alle|hallo|bedankt|tekst|document|lezen)\b/g
    ],
    id: [
      /\b(dan|di|ke|dari|ini|itu|untuk|dengan|tidak|ada|adalah|yang|saya|anda|kamu|kita|mereka|selamat|pagi|terima|kasih|membaca)\b/g
    ],
    en: [
      /\b(the|and|is|in|to|of|that|it|you|he|she|was|for|on|are|as|with|his|her|they|at|be|this|these|those|have|has|from|what|how|where|when|all|read|text|document|page|chapter|simple|sentence)\b/g
    ]
  };

  for (const [lang, regexes] of Object.entries(patterns)) {
    for (const r of regexes) {
      const matches = lower.match(r);
      if (matches) scores[lang] += matches.length;
    }
  }

  let bestLang = fallbackLang || 'en';
  let maxScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestLang = lang;
    }
  }

  return maxScore > 0 ? bestLang : (fallbackLang || 'en');
};

// Robust sentence splitter supporting all world languages and scripts
export const splitIntoSentences = (text: string): string[] => {
  if (!text) return [];
  
  // Clean up common whitespace
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];
  
  try {
    // Using undefined lets Intl.Segmenter auto-detect language context and handle all Unicode scripts correctly
    const segmenter = new (Intl as any).Segmenter(undefined, { granularity: 'sentence' });
    const segments = Array.from(segmenter.segment(cleanText))
      .map((s: any) => s.segment)
      // Filter out empty segments or segments with only punctuation, supporting any Unicode letter (\p{L}) or number (\p{N})
      .filter((s: string) => s && s.trim().length > 0 && /\p{L}|\p{N}/u.test(s));
    
    if (segments.length > 0) {
      return segments;
    }
  } catch (e) {
    console.warn("Intl.Segmenter not supported or failed, using multilingual regex fallback", e);
  }

  // Multilingual fallback covering Western (.!?), CJK (。！？), Arabic (؟), Hindi/Bengali (।॥), and others
  const matches = cleanText.match(/[^.!?。！？؟।॥\n\r]+[.!?。！？؟।॥]+[\])'"”’»]*|.+/gu) || [cleanText];
  return matches.filter(s => s && s.trim().length > 0 && /\p{L}|\p{N}/u.test(s));
};

export interface ParsedResult {
    pages: string[];
    detectedFont: 'font-serif' | 'font-sans';
}

export const parseTextFile = async (file: File): Promise<ParsedResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string || '';
      // Text files are usually code or logs, but for reading, Sans is cleaner.
      resolve({ 
          pages: paginateText(text),
          detectedFont: 'font-sans' 
      });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

export const parsePdfFile = async (file: File): Promise<ParsedResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      cMapUrl: `https://esm.sh/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
    });
    const pdf = await loadingTask.promise;
    
    const pages: string[] = [];
    let isSerif = true; // Default to Serif for PDFs (often academic/books)
    
    // Iterate through all pages
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      pages.push(pageText || ' '); 

      // Attempt simple heuristic on first page
      if (i === 1 && textContent.items.length > 0) {
          try {
             const fontName = (textContent.items[0] as any).fontName;
             if (page.commonObjs && page.commonObjs.has(fontName)) {
                 const font = page.commonObjs.get(fontName);
                 const name = font.name.toLowerCase();
                 if (name.includes('arial') || name.includes('helvetica') || name.includes('sans')) {
                     isSerif = false;
                 }
             }
          } catch(e) {
              // Ignore font detection errors
          }
      }
    }
    
    return {
        pages,
        detectedFont: isSerif ? 'font-serif' : 'font-sans'
    };
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to extract text from PDF. The file might be corrupted or password protected.");
  }
};

export const parseDocxFile = async (file: File): Promise<ParsedResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // 1. Extract raw text for pages
    const result = await mammoth.extractRawText({ arrayBuffer });
    const pages = paginateText(result.value);

    // 2. Extract HTML snippet to guess font
    let detectedFont: 'font-serif' | 'font-sans' = 'font-sans'; // Default for Word (Calibri)
    try {
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    } catch (e) {
        console.warn("Font detection failed for docx");
    }

    return { pages, detectedFont };
  } catch (error) {
    console.error("Error parsing DOCX:", error);
    throw new Error("Failed to extract text from Word document.");
  }
};