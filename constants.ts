import { VoiceOption } from './types';

// 20 Online AI Voices (Gemini Neural Voices)
export const AI_VOICES: VoiceOption[] = [
  { id: 'Puck', name: 'Puck', gender: 'Male', description: 'Energetic, youthful, and clear' },
  { id: 'Charon', name: 'Charon', gender: 'Male', description: 'Deep, resonant, and authoritative' },
  { id: 'Kore', name: 'Kore', gender: 'Female', description: 'Warm, natural, and soothing' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male', description: 'Bold, dramatic, and intense' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female', description: 'Gentle, calm, and peaceful' },
  { id: 'Aoede', name: 'Aoede', gender: 'Female', description: 'Melodic, articulate, and expressive' },
  { id: 'Callirrhoe', name: 'Callirrhoe', gender: 'Female', description: 'Bright, sophisticated, and lively' },
  { id: 'Despina', name: 'Despina', gender: 'Female', description: 'Crisp, modern, and upbeat' },
  { id: 'Erinome', name: 'Erinome', gender: 'Female', description: 'Smooth, polished, and professional' },
  { id: 'Gacrux', name: 'Gacrux', gender: 'Female', description: 'Rich, balanced, and versatile' },
  { id: 'Laomedeia', name: 'Laomedeia', gender: 'Female', description: 'Elegant, poetic, and serene' },
  { id: 'Leda', name: 'Leda', gender: 'Female', description: 'Friendly, conversational, and warm' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix', gender: 'Female', description: 'Dynamic, sharp, and engaging' },
  { id: 'Achernar', name: 'Achernar', gender: 'Female', description: 'Clear, resonant, and confident' },
  { id: 'Alnilam', name: 'Alnilam', gender: 'Male', description: 'Narrative, measured, and thoughtful' },
  { id: 'Enceladus', name: 'Enceladus', gender: 'Male', description: 'Deep baritone, documentary style' },
  { id: 'Iapetus', name: 'Iapetus', gender: 'Male', description: 'Warm, trustworthy, and inspiring' },
  { id: 'Orus', name: 'Orus', gender: 'Male', description: 'Articulate, corporate, and precise' },
  { id: 'Rasalgethi', name: 'Rasalgethi', gender: 'Male', description: 'Vibrant, friendly, and conversational' },
  { id: 'Sadachbia', name: 'Sadachbia', gender: 'Male', description: 'Steady, clear, and academic' },
];

// 10 Distinct System Offline Voices (Native Browser Speech Profiles with Acoustic Tuning)
export const SYSTEM_VOICES: VoiceOption[] = [
  { id: 'native:offline-natural', name: 'System Natural', gender: 'Female', description: 'Balanced, clear, and natural', isNative: true, pitch: 1.00, rate: 1.00 },
  { id: 'native:offline-deep-narrator', name: 'System Deep Narrator', gender: 'Male', description: 'Deep baritone, rich and immersive', isNative: true, pitch: 0.72, rate: 0.92 },
  { id: 'native:offline-studio-crisp', name: 'System Studio Crisp', gender: 'Female', description: 'Bright, articulate, and sharp', isNative: true, pitch: 1.15, rate: 1.04 },
  { id: 'native:offline-warm-casual', name: 'System Warm Casual', gender: 'Male', description: 'Warm, conversational, and relaxed', isNative: true, pitch: 0.88, rate: 0.98 },
  { id: 'native:offline-bright-cheerful', name: 'System Bright Cheerful', gender: 'Female', description: 'Vibrant, lively, and energetic', isNative: true, pitch: 1.25, rate: 1.08 },
  { id: 'native:offline-authoritative', name: 'System Authoritative', gender: 'Male', description: 'Commanding, steady, and formal', isNative: true, pitch: 0.65, rate: 0.94 },
  { id: 'native:offline-gentle-whisper', name: 'System Gentle Whisper', gender: 'Female', description: 'Soft, peaceful, and calm pace', isNative: true, pitch: 1.08, rate: 0.82 },
  { id: 'native:offline-dynamic-pace', name: 'System Dynamic Pace', gender: 'Male', description: 'Quick, rhythmic, and executive', isNative: true, pitch: 1.04, rate: 1.18 },
  { id: 'native:offline-storyteller', name: 'System Melodic Storyteller', gender: 'Female', description: 'Rich, expressive, and poetic', isNative: true, pitch: 1.18, rate: 0.88 },
  { id: 'native:offline-executive', name: 'System Executive Presenter', gender: 'Male', description: 'Confident, crisp, and professional', isNative: true, pitch: 0.82, rate: 1.04 },
];

// Global multilingual profiles (for language selection fallback)
export const GLOBAL_VOICES: VoiceOption[] = [
  { id: 'native:System Spanish (Español)', name: 'Sistema Español', gender: 'Female', description: 'es-ES • Claro, natural y expresivo', lang: 'es', isNative: true, pitch: 1.00, rate: 1.00 },
  { id: 'native:System French (Français)', name: 'Système Français', gender: 'Female', description: 'fr-FR • Voix naturelle, claire et fluide', lang: 'fr', isNative: true, pitch: 1.04, rate: 0.98 },
  { id: 'native:System German (Deutsch)', name: 'System Deutsch', gender: 'Male', description: 'de-DE • Präzise, ruhig und deutlich', lang: 'de', isNative: true, pitch: 0.88, rate: 0.96 },
  { id: 'native:System Chinese (中文)', name: '系统中文 (普通话)', gender: 'Female', description: 'zh-CN • 自然流畅，清晰标准', lang: 'zh', isNative: true, pitch: 1.05, rate: 1.00 },
  { id: 'native:System Japanese (日本語)', name: 'システム日本語', gender: 'Female', description: 'ja-JP • 落ち着いた自然な読み上げ', lang: 'ja', isNative: true, pitch: 1.10, rate: 0.98 },
  { id: 'native:System Arabic (العربية)', name: 'النظام العربي', gender: 'Male', description: 'ar-SA • صوت متقن، نقي وواضح', lang: 'ar', isNative: true, pitch: 0.90, rate: 0.95 },
  { id: 'native:System Hindi (हिन्दी)', name: 'सिस्टम हिन्दी', gender: 'Female', description: 'hi-IN • मधुर, स्पष्ट और प्राकृतिक', lang: 'hi', isNative: true, pitch: 1.05, rate: 0.98 },
  { id: 'native:System Portuguese (Português)', name: 'Sistema Português', gender: 'Female', description: 'pt-BR • Expressivo, fluído e caloroso', lang: 'pt', isNative: true, pitch: 1.02, rate: 1.02 },
  { id: 'native:System Italian (Italiano)', name: 'Sistema Italiano', gender: 'Male', description: 'it-IT • Caldo, melodioso e naturale', lang: 'it', isNative: true, pitch: 0.94, rate: 1.00 },
  { id: 'native:System Korean (한국어)', name: '시스템 한국어', gender: 'Female', description: 'ko-KR • 부드럽고 명확한 음성', lang: 'ko', isNative: true, pitch: 1.08, rate: 0.98 },
];

export const ALL_OFFLINE_VOICES: VoiceOption[] = SYSTEM_VOICES;

// All 30 Voices (20 Online AI + 10 Offline System)
export const ALL_VOICES: VoiceOption[] = [...AI_VOICES, ...SYSTEM_VOICES];

export const MAX_TEXT_LENGTH = 100000; // ~100k chars (approx 50 pages)
