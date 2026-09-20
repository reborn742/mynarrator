import { SYSTEM_VOICES, AI_VOICES, GLOBAL_VOICES, ALL_VOICES } from '../constants';
import { VoiceOption } from '../types';

export function getVoiceOption(voiceId: string): VoiceOption | undefined {
  const found = ALL_VOICES.find(v => v.id === voiceId) || 
                GLOBAL_VOICES.find(v => v.id === voiceId) ||
                AI_VOICES.find(v => v.id === voiceId) ||
                SYSTEM_VOICES.find(v => v.id === voiceId);
  if (found) return found;

  if (voiceId && voiceId.startsWith('native:')) {
    let rawName = voiceId.replace(/^native:/, '').trim();
    if (rawName.includes(':')) {
      rawName = rawName.split(':').slice(1).join(':').trim();
    }
    const isFemale = /female|zira|samantha|susan|hazel|victoria|karen|helena|elena|maria|laura|anna|catherine|clara|alice|monica|emma/i.test(rawName);
    return {
      id: voiceId,
      name: rawName,
      gender: isFemale ? 'Female' : 'Male',
      description: 'System offline voice',
      isNative: true,
      pitch: 1.0,
      rate: 1.0,
    };
  }
  return undefined;
}

// 10 distinct acoustic calibrations to ensure 10 audible, distinct sound profiles
const OFFLINE_ACOUSTIC_SLOTS = [
  { pitch: 1.00, rate: 1.00 }, // 0: Natural baseline
  { pitch: 0.65, rate: 0.90 }, // 1: Deep low baritone
  { pitch: 1.35, rate: 1.06 }, // 2: Bright crisp studio
  { pitch: 0.85, rate: 0.96 }, // 3: Warm casual
  { pitch: 1.45, rate: 1.12 }, // 4: Vibrant cheerful
  { pitch: 0.55, rate: 0.92 }, // 5: Authoritative deep command
  { pitch: 1.12, rate: 0.80 }, // 6: Gentle slow whisper
  { pitch: 0.95, rate: 1.25 }, // 7: Dynamic fast pace
  { pitch: 1.25, rate: 0.86 }, // 8: Melodic storyteller
  { pitch: 0.75, rate: 1.08 }, // 9: Executive formal
];

export function resolveOfflineVoice(
  selectedVoiceId: string,
  targetLang: string,
  voices: SpeechSynthesisVoice[]
): { voice: SpeechSynthesisVoice | null; pitch: number; rate: number } {
  const profile = getVoiceOption(selectedVoiceId) || SYSTEM_VOICES[0];
  let pitch = profile.pitch ?? 1.0;
  let rate = profile.rate ?? 1.0;

  if (!voices || voices.length === 0) {
    return { voice: null, pitch, rate };
  }

  // 1. Exact match by installed browser voice name or URI (stripping slot prefix if present)
  if (selectedVoiceId.startsWith('native:')) {
    let rawName = selectedVoiceId.replace(/^native:/, '').trim();
    if (rawName.includes(':')) {
      rawName = rawName.split(':').slice(1).join(':').trim();
    }
    const exact = voices.find(v => v.name === rawName || v.voiceURI === rawName || v.name.toLowerCase() === rawName.toLowerCase());
    if (exact) {
      // Determine slot index from ID if present
      const slotMatch = selectedVoiceId.match(/offline-(\d+)/);
      if (slotMatch) {
        const slotIdx = Math.max(0, Math.min(9, parseInt(slotMatch[1], 10) - 1));
        const tuning = OFFLINE_ACOUSTIC_SLOTS[slotIdx];
        pitch = tuning.pitch;
        rate = tuning.rate;
      }
      return { voice: exact, pitch, rate };
    }
  }

  // 2. Identify the slot (0 to 9)
  let slot = 0;
  const slotMatch = selectedVoiceId.match(/offline-(\d+)/);
  if (slotMatch) {
    slot = Math.max(0, Math.min(9, parseInt(slotMatch[1], 10) - 1));
  } else {
    const offlineIndex = SYSTEM_VOICES.findIndex(v => v.id === selectedVoiceId || v.name === profile.name);
    slot = offlineIndex >= 0 ? offlineIndex : 0;
  }

  // Apply acoustic calibration for the slot
  const acoustic = OFFLINE_ACOUSTIC_SLOTS[slot % OFFLINE_ACOUSTIC_SLOTS.length];
  pitch = acoustic.pitch;
  rate = acoustic.rate;

  // 3. Build a pool of distinct voices from installed browser voices
  const cleanLang = (targetLang || 'en').toLowerCase().split('-')[0];
  const langVoices = voices.filter(v => 
    v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(cleanLang)
  );

  const voicePool: SpeechSynthesisVoice[] = [];
  const seen = new Set<string>();

  // Prioritize matching language voices first
  for (const v of langVoices) {
    const key = v.voiceURI || v.name;
    if (!seen.has(key)) {
      seen.add(key);
      voicePool.push(v);
    }
  }

  // Add all other distinct installed voices so we have as many distinct voices as possible
  for (const v of voices) {
    const key = v.voiceURI || v.name;
    if (!seen.has(key)) {
      seen.add(key);
      voicePool.push(v);
    }
  }

  // Assign a distinct voice to each slot (0..9)
  const chosenVoice = voicePool[slot % voicePool.length] || voices[0] || null;

  return { voice: chosenVoice, pitch, rate };
}
