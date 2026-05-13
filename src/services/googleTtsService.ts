/**
 * Google Cloud Text-to-Speech Service
 *
 * Uses the Cloud TTS REST API (texttospeech.googleapis.com) with the same
 * VITE_GOOGLE_API_KEY that powers the Gemini Ask feature.
 *
 * The API returns base64-encoded MP3 audio which we decode into a Blob URL
 * and play with the <audio> element — no proxy, no CORS issues.
 *
 * Falls back to window.speechSynthesis if the API call fails.
 */

const GOOGLE_API_KEY: string =
  (import.meta as any).env?.VITE_GOOGLE_API_KEY ??
  'AIzaSyBUScNU_AwtxZJvXF3IVBPhx3393_2fEq0';
const TTS_ENDPOINT = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`;

// ── Language / voice mapping ───────────────────────────────────────────────────
interface VoiceConfig { languageCode: string; male: string; female: string; name?: string; ssmlGender?: 'MALE' | 'FEMALE'; }

const VOICE_MAP: Record<string, VoiceConfig> = {
  'en-IN': { languageCode: 'en-IN', male: 'en-IN-Wavenet-A', female: 'en-IN-Wavenet-D' },
  'hi-IN': { languageCode: 'hi-IN', male: 'hi-IN-Wavenet-A', female: 'hi-IN-Wavenet-D' },
  'te-IN': { languageCode: 'te-IN', male: 'te-IN-Wavenet-A', female: 'te-IN-Wavenet-D' },
  'ur-PK': { languageCode: 'ur-PK', male: 'ur-PK-Wavenet-A', female: 'ur-PK-Wavenet-D' },
  'ur-IN': { languageCode: 'ur-PK', male: 'ur-PK-Wavenet-A', female: 'ur-PK-Wavenet-D' },
  'or-IN': { languageCode: 'en-IN', male: 'en-IN-Wavenet-A', female: 'en-IN-Wavenet-D' },
};

const DEFAULT_VOICE: VoiceConfig = { languageCode: 'en-IN', male: 'en-IN-Wavenet-A', female: 'en-IN-Wavenet-D' };

function getVoiceNameForGender(voice: VoiceConfig, isMale: boolean): string {
  return isMale ? voice.male : voice.female;
}

const CHUNK_SIZE = 4500; // Cloud TTS allows up to 5000 chars per request

// ── Script detection ───────────────────────────────────────────────────────────
export function detectLangCode(text: string, fallbackBcp47: string): string {
  if (/[\u0600-\u06FF]/.test(text)) return 'ur-PK';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  return fallbackBcp47;
}

// ── Text sanitisation ─────────────────────────────────────────────────────────
export function sanitizeForTts(raw: string): string {
  let t = raw;

  // Strip HTML tags
  t = t.replace(/<[^>]*>/g, ' ');

  // Decode HTML entities via DOM
  try {
    const el = document.createElement('textarea');
    el.innerHTML = t;
    t = el.value;
  } catch { /* non-browser */ }

  // Manual entity fallback
  t = t
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Strip markdown
  t = t
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/#{1,6}\s+/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[(.+?)\]\(.*?\)/g, '$1')
    .replace(/^[-*+]\s+/gm, ' ')
    .replace(/^\d+\.\s+/gm, ' ')
    .replace(/^>\s*/gm, ' ')
    .replace(/---+/g, ' ')
    .replace(/==(.+?)==/g, '$1')
    .replace(/[|^~\\]/g, ' ');

  // Normalise whitespace
  t = t
    .replace(/\r?\n+/g, '. ')
    .replace(/\.(\s*\.)+/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return t;
}

// ── Chunk splitter ─────────────────────────────────────────────────────────────
function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  // Split on sentence boundaries first
  const sentences = text.split(/(?<=[.!?।؟])\s+/);
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length <= maxLen) {
      current = (current + ' ' + s).trim();
    } else {
      if (current) chunks.push(current);
      // If a single sentence exceeds limit, split by words
      if (s.length > maxLen) {
        const words = s.split(' ');
        let w = '';
        for (const word of words) {
          if ((w + ' ' + word).trim().length <= maxLen) {
            w = (w + ' ' + word).trim();
          } else {
            if (w) chunks.push(w);
            w = word;
          }
        }
        if (w) chunks.push(w);
        current = '';
      } else {
        current = s;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(c => c.trim().length > 0);
}

// ── Google Cloud TTS API call ──────────────────────────────────────────────────
const inflightControllers = new Set<AbortController>();

async function synthesizeChunk(text: string, voice: VoiceConfig): Promise<string> {
  const gender = voice.ssmlGender ?? 'FEMALE';
  const selectedVoiceName = voice.name ?? getVoiceNameForGender(voice, gender === 'MALE');
  const body = {
    input: { text },
    voice: {
      languageCode: voice.languageCode,
      name: selectedVoiceName,
      ssmlGender: gender,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.95,
      pitch: 0,
    },
  };

  const controller = new AbortController();
  inflightControllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), 12000);
  const res = await fetch(TTS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout);
    inflightControllers.delete(controller);
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloud TTS error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const base64Audio: string = data.audioContent;
  if (!base64Audio) throw new Error('No audioContent in response');

  // Decode base64 → Blob → Object URL
  const binary = atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mp3' });
  return URL.createObjectURL(blob);
}

// ── Player state ───────────────────────────────────────────────────────────────
let currentAudio: HTMLAudioElement | null = null;
let pendingBlobUrls: string[] = [];        // object URLs to revoke after playback
let textChunks: string[] = [];             // plain text chunks queued for synthesis
let chunkQueue: { text: string; start: number }[] = [];
let currentVoice: VoiceConfig = DEFAULT_VOICE;
let isPlaying = false;
let isStopped = false;
let onDoneCallback: (() => void) | null = null;
let onProgressCallback: ((globalCharIndex: number) => void) | null = null;
let onStartCallback: (() => void) | null = null;
let didFireStart = false;
let fallbackProgressTimer: number | null = null;
let runId = 0;
let chunkProgressTimers = new Set<number>();
let isPaused = false;

function cleanup() {
  pendingBlobUrls.forEach(u => URL.revokeObjectURL(u));
  pendingBlobUrls = [];
  if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
  if (fallbackProgressTimer != null) {
    window.clearInterval(fallbackProgressTimer);
    fallbackProgressTimer = null;
  }
  chunkProgressTimers.forEach((t) => window.clearInterval(t));
  chunkProgressTimers.clear();
}

// ── speechSynthesis fallback ───────────────────────────────────────────────────
function fallbackSpeak(
  text: string,
  bcp47: string,
  onDone?: () => void,
  onProgress?: (charIndex: number) => void,
) {
  if (!window.speechSynthesis) { onDone?.(); return; }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = bcp47;
  const preferredGender = localStorage.getItem('user_voice') === 'male' ? 'male' : 'female';
  const desiredLang = bcp47.toLowerCase().split('-')[0];
  let availableVoices = window.speechSynthesis.getVoices();

  const startFallbackProgress = () => {
    if (!onProgress || !text) return;
    let lastTs = Date.now();
    let spokenMs = 0;
    const approxMsPerChar = 42;
    if (fallbackProgressTimer != null) {
      window.clearInterval(fallbackProgressTimer);
    }
    fallbackProgressTimer = window.setInterval(() => {
      const now = Date.now();
      const delta = now - lastTs;
      lastTs = now;
      if (isPaused) return;
      spokenMs += delta;
      const idx = Math.min(text.length, Math.floor(spokenMs / approxMsPerChar));
      onProgress(idx);
      if (idx >= text.length && fallbackProgressTimer != null) {
        window.clearInterval(fallbackProgressTimer);
        fallbackProgressTimer = null;
      }
    }, 180);
  };
  const clearFallbackProgress = () => {
    if (fallbackProgressTimer != null) {
      window.clearInterval(fallbackProgressTimer);
      fallbackProgressTimer = null;
    }
  };

  // Some browsers never fire voiceschanged reliably. Use default voice immediately.
  if (!availableVoices.length) {
    if (!didFireStart) { onStartCallback?.(); didFireStart = true; }
    startFallbackProgress();
    utter.rate = 0.95;
    utter.onend = () => { clearFallbackProgress(); onProgress?.(text.length); isPlaying = false; onDone?.(); };
    utter.onerror = () => { clearFallbackProgress(); isPlaying = false; onDone?.(); };
    window.speechSynthesis.speak(utter);
    return;
  }

  const genderPattern = preferredGender === 'male' ? /male|man|boy|guy|david|james|mark/i : /female|woman|girl|zira|aria|hazel/i;
  const languageMatches = availableVoices.filter((v) => v.lang.toLowerCase().startsWith(desiredLang));
  const matchingVoice = languageMatches.find((v) => genderPattern.test(v.name) || genderPattern.test(v.voiceURI))
    || languageMatches.find((v) => /en-|hi-|te-|ur-/.test(v.lang.toLowerCase()))
    || availableVoices[0];

  if (matchingVoice) utter.voice = matchingVoice;
  if (!didFireStart) { onStartCallback?.(); didFireStart = true; }
  startFallbackProgress();
  utter.rate = 0.95;
  utter.onend = () => { clearFallbackProgress(); onProgress?.(text.length); isPlaying = false; onDone?.(); };
  utter.onerror = () => { clearFallbackProgress(); isPlaying = false; onDone?.(); };
  window.speechSynthesis.speak(utter);
}

// ── Sequential chunk player ────────────────────────────────────────────────────
async function playNextChunk() {
  const localRunId = runId;
  if (isStopped || chunkQueue.length === 0) {
    if (!isStopped) {
      isPlaying = false;
      onDoneCallback?.();
      onDoneCallback = null;
      onProgressCallback = null;
    }
    return;
  }

  const chunkMeta = chunkQueue.shift()!;
  const chunk = chunkMeta.text;

  try {
    const blobUrl = await synthesizeChunk(chunk, currentVoice);
    if (isStopped || localRunId !== runId) { URL.revokeObjectURL(blobUrl); return; }

    const audio = new Audio(blobUrl);
    currentAudio = audio;
    pendingBlobUrls.push(blobUrl);
    let chunkProgressTimer: number | null = null;
    const clearChunkProgressTimer = () => {
      if (chunkProgressTimer != null) {
        window.clearInterval(chunkProgressTimer);
        chunkProgressTimers.delete(chunkProgressTimer);
        chunkProgressTimer = null;
      }
    };
    const startChunkProgressTimer = () => {
      if (chunkProgressTimer != null) return;
      chunkProgressTimer = window.setInterval(() => {
        if (isPaused) return;
        if (!onProgressCallback) return;
        const hasDuration = !!audio.duration && isFinite(audio.duration) && audio.duration > 0;
        if (hasDuration) {
          const ratio = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
          const spokenChars = Math.floor(ratio * chunk.length);
          onProgressCallback(chunkMeta.start + spokenChars);
          return;
        }
        // Fallback progression when duration metadata is missing.
        const approxChars = Math.floor(audio.currentTime * 14);
        onProgressCallback(chunkMeta.start + Math.min(chunk.length, Math.max(0, approxChars)));
      }, 150);
      chunkProgressTimers.add(chunkProgressTimer);
    };

    audio.ontimeupdate = () => {
      if (!onProgressCallback || !audio.duration || !isFinite(audio.duration)) return;
      const ratio = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
      const spokenChars = Math.floor(ratio * chunk.length);
      onProgressCallback(chunkMeta.start + spokenChars);
    };

    audio.onended = () => {
      if (localRunId !== runId) return;
      clearChunkProgressTimer();
      if (onProgressCallback) onProgressCallback(chunkMeta.start + chunk.length);
      URL.revokeObjectURL(blobUrl);
      pendingBlobUrls = pendingBlobUrls.filter(u => u !== blobUrl);
      currentAudio = null;
      playNextChunk();
    };

    audio.onerror = () => {
      if (localRunId !== runId) return;
      console.warn('[CloudTTS] audio playback error — skipping chunk');
      clearChunkProgressTimer();
      URL.revokeObjectURL(blobUrl);
      currentAudio = null;
      playNextChunk(); // skip and continue
    };

    audio.onplay = () => {
      if (localRunId !== runId) return;
      startChunkProgressTimer();
      if (!didFireStart) { onStartCallback?.(); didFireStart = true; }
    };

    audio.play().catch(() => {
      console.warn('[CloudTTS] play() rejected — falling back to speechSynthesis');
      clearChunkProgressTimer();
      URL.revokeObjectURL(blobUrl);
      currentAudio = null;
      if (localRunId !== runId) return;
      // Fall back for all remaining text
      const remaining = [chunkMeta.text, ...chunkQueue.map(c => c.text)].join(' ');
      chunkQueue = [];
      const doneCb = onDoneCallback ?? undefined;
      const progressCb = onProgressCallback;
      fallbackSpeak(
        remaining,
        currentVoice.languageCode,
        doneCb,
        (fallbackIdx) => progressCb?.(chunkMeta.start + fallbackIdx),
      );
      onDoneCallback = null;
      onProgressCallback = null;
    });
  } catch (err) {
    if (localRunId !== runId) return;
    console.warn('[CloudTTS] synthesis failed:', err, '— falling back to speechSynthesis');
    const remaining = [chunkMeta.text, ...chunkQueue.map(c => c.text)].join(' ');
    chunkQueue = [];
    const doneCb = onDoneCallback ?? undefined;
    const progressCb = onProgressCallback;
    fallbackSpeak(
      remaining,
      currentVoice.languageCode,
      doneCb,
      (fallbackIdx) => progressCb?.(chunkMeta.start + fallbackIdx),
    );
    onDoneCallback = null;
    onProgressCallback = null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function googleTtsSpeak(
  text: string,
  bcp47Lang: string,
  onStart?: () => void,
  onEnd?: () => void,
  onProgress?: (globalCharIndex: number) => void,
) {
  googleTtsStop();
  runId += 1;
  isPaused = false;

  const clean = sanitizeForTts(text);
  if (!clean) { onEnd?.(); return; }

  // Auto-detect language from script if content gives a clearer signal
  const detectedBcp47 = detectLangCode(clean, bcp47Lang);
  const preferMale = localStorage.getItem('user_voice') === 'male';
  const selectedVoice = VOICE_MAP[detectedBcp47] ?? DEFAULT_VOICE;
  currentVoice = {
    ...selectedVoice,
    name: getVoiceNameForGender(selectedVoice, preferMale),
    ssmlGender: preferMale ? 'MALE' : 'FEMALE',
  };

  textChunks = splitIntoChunks(clean, CHUNK_SIZE);
  if (textChunks.length === 0) { onEnd?.(); return; }
  let cursor = 0;
  chunkQueue = textChunks.map((chunkText) => {
    const start = cursor;
    cursor += chunkText.length;
    return { text: chunkText, start };
  });

  isStopped = false;
  isPlaying = true;
  onDoneCallback = onEnd ?? null;
  onProgressCallback = onProgress ?? null;
  onStartCallback = onStart ?? null;
  didFireStart = false;
  playNextChunk();
}

export function googleTtsStop() {
  runId += 1;
  isStopped = true;
  isPlaying = false;
  isPaused = false;
  textChunks = [];
  chunkQueue = [];
  onDoneCallback = null;
  onProgressCallback = null;
  onStartCallback = null;
  didFireStart = false;
  inflightControllers.forEach((c) => c.abort());
  inflightControllers.clear();
  cleanup();
  window.speechSynthesis?.cancel();
}

export function googleTtsPause() {
  isPaused = true;
  if (currentAudio) {
    currentAudio.pause();
  }
  window.speechSynthesis?.pause();
}

export function googleTtsResume() {
  isPaused = false;
  if (currentAudio) {
    currentAudio.play().catch(e => console.warn('Resume failed:', e));
  }
  window.speechSynthesis?.resume();
}

export function googleTtsIsPlaying(): boolean {
  return isPlaying;
}
