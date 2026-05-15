/**
 * speechService.ts
 * Universal Speech-to-Text service that works across all modern browsers.
 *
 * Strategy:
 *  1. Web Speech API (Chrome, Edge, Safari)  — real-time streaming transcript
 *  2. MediaRecorder + Google Cloud Speech-to-Text (Firefox & others) — records
 *     audio, sends as base64 to Google STT REST API on stop.
 */

const GOOGLE_API_KEY: string =
  (import.meta as any).env?.VITE_GOOGLE_API_KEY ??
  (import.meta as any).env?.VITE_GEMINI_API_KEY ??
  '';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True when the browser supports the Web Speech API */
export function hasWebSpeechSupport(): boolean {
  return !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
}

/** True when the browser can record audio via MediaRecorder */
function hasMediaRecorderSupport(): boolean {
  return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined');
}

// ── Language code mapping ────────────────────────────────────────────────────

/**
 * Map BCP-47 codes used by the app to the language codes that
 * Google Cloud Speech-to-Text expects (they're the same, but listed explicitly).
 */
const STT_LANG_MAP: Record<string, string> = {
  'en-IN': 'en-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN',
  'or-IN': 'or-IN',
  'ur-PK': 'ur-PK',
};

function toSttLang(lang: string): string {
  return STT_LANG_MAP[lang] ?? lang;
}

// ── Google Cloud STT (MediaRecorder fallback) ─────────────────────────────────

async function transcribeViaGoogleSTT(
  audioBlob: Blob,
  languageCode: string,
): Promise<string> {
  if (!GOOGLE_API_KEY) {
    throw new Error('❌ Google API key not configured. Speech recognition is unavailable.');
  }

  console.log('Starting STT transcription...');
  console.log('Audio blob:', { size: audioBlob.size, type: audioBlob.type });

  // Convert blob to base64
  let base64 = '';
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8.byteLength; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    base64 = btoa(binary);
    console.log('Base64 conversion successful, length:', base64.length);
  } catch (e: any) {
    throw new Error(`❌ Could not process audio: ${e.message}`);
  }

  // Determine encoding from MIME type
  const mimeType = audioBlob.type || 'audio/webm';
  let encoding = 'WEBM_OPUS';
  if (mimeType.includes('ogg')) {
    encoding = 'OGG_OPUS';
  } else if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    encoding = 'MP4';
  } else if (mimeType.includes('wav')) {
    encoding = 'LINEAR16';
  } else if (mimeType.includes('webm')) {
    encoding = 'WEBM_OPUS';
  }

  console.log('Audio encoding:', encoding, 'from MIME type:', mimeType);

  const sttLanguage = toSttLang(languageCode);
  console.log('STT language:', sttLanguage);

  const body = {
    config: {
      encoding,
      languageCode: sttLanguage,
      alternativeLanguageCodes: ['en-IN', 'en-US'], // fallbacks
      enableAutomaticPunctuation: true,
      model: 'latest_long',
    },
    audio: { content: base64 },
  };

  console.log('Sending request to Google Cloud Speech-to-Text API...');

  let res: Response;
  try {
    res = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
  } catch (e: any) {
    throw new Error(`❌ Network error calling Google STT: ${e.message}`);
  }

  if (!res.ok) {
    let errText = '';
    try {
      errText = await res.text();
    } catch { }
    console.error('Google STT HTTP error:', res.status, errText);

    // Provide specific error messages
    if (res.status === 400) {
      throw new Error('❌ Invalid audio format or language. Please try again.');
    } else if (res.status === 401 || res.status === 403) {
      throw new Error('❌ Google API key invalid or not authorized for Speech-to-Text.');
    } else if (res.status === 429) {
      throw new Error('❌ Speech recognition quota exceeded. Please try again later.');
    } else if (res.status === 500 || res.status === 503) {
      throw new Error('❌ Speech recognition service temporarily unavailable. Please try again later.');
    } else {
      throw new Error(`❌ Google STT error ${res.status}: ${errText || 'Unknown error'}`);
    }
  }

  let data: any;
  try {
    data = await res.json();
  } catch (e: any) {
    throw new Error(`❌ Invalid response from Google STT: ${e.message}`);
  }

  console.log('Google STT response:', JSON.stringify(data, null, 2));

  // Check for API errors
  if (data.error) {
    console.error('Google STT API error:', data.error);
    const errorCode = data.error.code;
    const errorMsg = data.error.message;

    if (errorCode === 3) throw new Error('❌ Invalid audio format or speech not detected');
    if (errorCode === 7) throw new Error('❌ Not enough credits or billing not set up');
    if (errorCode === 9) throw new Error('❌ Project not found or API not enabled');
    if (errorCode === 12) throw new Error('❌ API key not valid');
    if (errorCode === 13) throw new Error('❌ Request limit exceeded');

    throw new Error(`❌ Google API Error (${errorCode}): ${errorMsg}`);
  }

  // Extract transcript from results
  if (!data.results || data.results.length === 0) {
    console.warn('No results in STT response - audio may not have contained speech');
    throw new Error('❌ No speech detected. Please speak clearly into your microphone.');
  }

  const transcript = (data.results ?? [])
    .map((r: any) => r.alternatives?.[0]?.transcript ?? '')
    .filter((t: string) => t.length > 0)
    .join(' ')
    .trim();

  if (!transcript) {
    console.warn('No transcript extracted from results');
    throw new Error('❌ No speech detected. Please speak clearly into your microphone.');
  }

  console.log('Transcription result:', transcript);
  return transcript;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SpeechSession {
  /** Stop the current session. For Web Speech, returns ''. For MediaRecorder, triggers transcription. */
  stop(): Promise<string>;
  /** True if the session is using Web Speech API (real-time interim results via onInterim) */
  isStreaming: boolean;
}

export interface SpeechSessionOptions {
  language: string;
  /** Called with interim/partial transcript (Web Speech only) */
  onInterim?: (text: string) => void;
  /** Called when an error occurs */
  onError?: (err: string) => void;
  /** Called when the session ends on its own (e.g. silence detection) */
  onEnd?: () => void;
}

/**
 * Start a speech recognition session.
 * Returns a SpeechSession handle. Call session.stop() when done.
 *
 * - In Chrome/Edge/Safari: uses Web Speech API, calls onInterim in real time.
 * - In Firefox: records via MediaRecorder and transcribes on stop().
 */
export async function startSpeechSession(
  options: SpeechSessionOptions,
): Promise<SpeechSession> {
  const { language, onInterim, onError, onEnd } = options;

  // ── Web Speech API path ───────────────────────────────────────────────────
  if (hasWebSpeechSupport()) {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interim += t;
        }
      }
      if (onInterim) onInterim((finalTranscript + interim).trim());
    };

    recognition.onerror = (event: any) => {
      console.warn('Web Speech error:', event.error);
      if (onError) onError(event.error);
    };

    recognition.onend = () => {
      if (onEnd) onEnd();
    };

    recognition.start();

    return {
      isStreaming: true,
      stop: async () => {
        recognition.stop();
        return finalTranscript.trim();
      },
    };
  }

  // ── MediaRecorder fallback (Firefox, Safari, etc.) ────────────────────────────────

  // Check if mediaDevices is available (newer Firefox, Chrome, Safari)
  if (!navigator.mediaDevices) {
    console.warn('navigator.mediaDevices not available, trying webkit fallback...');
    if ((navigator as any).webkitGetUserMedia) {
      // Very old browsers - not supported
      throw new Error('Your browser does not support microphone access. Please use Chrome, Firefox 25+, Safari, or Edge.');
    }
    throw new Error('Microphone access not supported in this browser.');
  }

  if (!hasMediaRecorderSupport()) {
    throw new Error('Your browser does not support audio recording. Please use Chrome, Firefox 25+, Safari, or Edge.');
  }

  // Request microphone with better error handling
  let stream: MediaStream;
  try {
    // Use detailed audio constraints for better quality
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    console.log('Microphone access granted');
  } catch (e: any) {
    console.error('Microphone error details:', {
      name: e.name,
      message: e.message,
      code: e.code,
    });

    // Provide specific error messages for Firefox
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      throw new Error('❌ Microphone permission denied. Please allow microphone access in your browser settings.');
    } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
      throw new Error('❌ No microphone device found. Please check your microphone connection.');
    } else if (e.name === 'NotSupportedError') {
      throw new Error('❌ Your browser or device does not support microphone access.');
    } else if (e.name === 'SecurityError') {
      throw new Error('❌ Microphone access denied for security reasons. Please check HTTPS and browser settings.');
    } else {
      throw new Error(`❌ Microphone error: ${e.message || e.name}. Please try again.`);
    }
  }

  // Pick supported MIME type - try Firefox-friendly types first
  const MIME_TYPES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
    'audio/wav',
  ];

  let mimeType = '';
  for (const m of MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(m)) {
      mimeType = m;
      console.log('Using MIME type:', mimeType);
      break;
    }
  }

  if (!mimeType) {
    console.warn('No supported MIME type found, using default');
    mimeType = 'audio/webm';
  }

  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (e: any) {
    stream.getTracks().forEach(t => t.stop());
    console.error('MediaRecorder creation failed:', e);
    throw new Error(`Could not initialize audio recorder: ${e.message}`);
  }

  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
      console.log('Audio chunk received:', e.data.size, 'bytes');
    }
  };

  recorder.onerror = (event: any) => {
    console.error('MediaRecorder error:', event.error);
    if (onError) onError(`Recording error: ${event.error}`);
  };

  try {
    recorder.start(250); // collect chunks every 250 ms
    console.log('Recording started');
  } catch (e: any) {
    stream.getTracks().forEach(t => t.stop());
    throw new Error(`Could not start recording: ${e.message}`);
  }

  // Visual feedback during recording (Firefox shows dots)
  let dotInterval: ReturnType<typeof setInterval> | null = null;
  let dotCount = 0;
  if (onInterim) {
    dotInterval = setInterval(() => {
      dotCount = (dotCount + 1) % 4;
      onInterim('🎙️ ' + '●'.repeat(dotCount + 1) + ' Recording…');
    }, 500);
  }

  return {
    isStreaming: false,
    stop: () =>
      new Promise<string>((resolve, reject) => {
        if (dotInterval) clearInterval(dotInterval);

        recorder.onstop = async () => {
          console.log('Recording stopped, processing audio...');
          // Stop all mic tracks
          stream.getTracks().forEach(t => t.stop());

          if (chunks.length === 0) {
            console.warn('No audio chunks recorded');
            if (onError) onError('No audio was recorded. Please try again.');
            resolve('');
            return;
          }

          console.log('Total chunks:', chunks.length);
          const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          console.log('Audio blob created:', blob.size, 'bytes, type:', blob.type);

          try {
            if (!GOOGLE_API_KEY) {
              throw new Error('Google API key not configured. Please set VITE_GOOGLE_API_KEY environment variable.');
            }
            console.log('Sending audio to Google Cloud Speech-to-Text...');
            const transcript = await transcribeViaGoogleSTT(blob, language);
            console.log('Transcription successful:', transcript);
            resolve(transcript);
          } catch (e: any) {
            console.error('STT transcription failed:', {
              message: e.message,
              error: e,
            });
            const errMsg = e.message || 'Speech recognition failed. Please try again.';
            if (onError) onError(errMsg);
            reject(new Error(errMsg));
          }
        };

        recorder.stop();
      }),
  };
}
