import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, HelpCircle, AlertCircle, Play, Square, Loader2, ChevronDown, Check } from 'lucide-react';

const SUPPORTED_VOICES = [
  { id: 'Kore', name: 'Kore', description: 'Cheerful and bright', gender: 'female' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Warm and calm', gender: 'female' },
  { id: 'Aoede', name: 'Aoede', description: 'Clear and expressive', gender: 'female' },
  { id: 'Puck', name: 'Puck', description: 'Energetic and youthful', gender: 'male' },
  { id: 'Charon', name: 'Charon', description: 'Calm and quiet', gender: 'male' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Warm and resonant', gender: 'male' }
];

const SYSTEM_INSTRUCTIONS = {
  translator: `You are an automated direct speech-to-speech translator.
Keep your modality strictly to spoken audio.
Whenever the user speaks, detect the language they are speaking.
If the language is English, translate it immediately into clear and natural Spanish, and speak ONLY the translation back.
If the language is anything other than English, translate it immediately into natural and clear conversational English, and say only the translation back.
CRITICAL: Do NOT say any other words, conversational comments, or explanations. Only speak back the direct translation. For example: if they say something equivalent to 'How are you?', you must say ONLY 'How are you?' back.`,
  practice: `You are Enzily, a friendly and warm AI English practice partner.
We are engaging in friendly, natural spoken conversation.
If the user makes any grammatical errors, pronunciation awkwardness, or tense issues, first point it out and gently correct them in 1 warm sentence of audio.
Then, say 1-2 friendly conversational sentences to answer them and support them, followed by a warm question to keep the practice going.
If they speak perfectly, congratulate them warmly and continue the conversation naturally in 1-2 sentences with a friendly follow-up question. Say nothing else.`,
  debate: `You are Enzily, an extremely clever, eloquent, and highly logical academic debate opponent.
Since we are starting a fresh debate, always start the conversation by asking the user which topic they want to debate on, or suggest a highly engaging topic (such as 'Is AI a threat to human creativity?' or 'Should we prioritize space colonization?') to kick off.
Once the topic is decided or if the user starts arguing a point, engage in a friendly but highly sharp, articulate, and academically persuasive debate.
You should defend the opposite side of whatever stance the User takes. Keep your responses concise (1-3 sentences) to maintain a fast-paced debate. Let's begin!`
};

export interface VoiceCallControllerProps {
  mode: 'translator' | 'practice' | 'debate';
  title: string;
  description: string;
  themeColor: 'indigo' | 'emerald' | 'violet';
  emoji: string;
}

export default function VoiceCallController({
  mode,
  title,
  description,
  themeColor,
  emoji
}: VoiceCallControllerProps) {
  const [isStarted, setIsStarted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    const saved = localStorage.getItem('prebuilt_voice_selection') || 'Kore';
    const isValid = SUPPORTED_VOICES.some(v => v.id === saved);
    return isValid ? saved : 'Kore';
  });
  const [isDropdownActive, setIsDropdownActive] = useState(false);
  const [sessionState, setSessionState] = useState<'idle' | 'listening' | 'speaking' | 'thinking'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio level indicators (0 to 1) for animations
  const [userMicLevel, setUserMicLevel] = useState(0);
  const [isUserActive, setIsUserActive] = useState(false);
  const [isAiActive, setIsAiActive] = useState(false);

  // Audio Processing Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const socketRef = useRef<WebSocket | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isDirectRef = useRef<boolean>(false);
  const isSessionStartedRef = useRef<boolean>(false);

  // Play a beautiful, futuristic ascending dual-tone digital chime on secure connection
  const playStartSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      // Tone 1: Pinkish soft sine
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5
      osc1.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3); // C6
      
      gain1.gain.setValueAtTime(0.0, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Tone 2: Warm ambient triangle base-note
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(261.63, now); // C4
      
      gain2.gain.setValueAtTime(0.0, now);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn("Could not play start chime:", e);
    }
  };

  // Play a descending tender digital bell/chime on stop
  const playStopSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880.00, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(587.33, now + 0.12); // D5
      osc1.frequency.exponentialRampToValueAtTime(440.00, now + 0.25); // A4
      
      gain1.gain.setValueAtTime(0.0, now);
      gain1.gain.linearRampToValueAtTime(0.1, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      osc1.start(now);
      osc1.stop(now + 0.4);
    } catch (e) {
      console.warn("Could not play stop chime:", e);
    }
  };

  // Setup active audio and processing graph nodes dynamically
  const setupAudioNodes = (stream: MediaStream, audioCtx: AudioContext, ws: WebSocket) => {
    // 4. Setup Audio analyser for high-resolution input visualizer
    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevels = () => {
      if (!analyser || ws.readyState !== WebSocket.OPEN) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const normalized = Math.min(1, average / 80);
      setUserMicLevel(normalized);

      // Turn on user sound animation if volume is above idle threshold
      if (normalized > 0.08) {
        setIsUserActive(true);
        
        // Barge-in check: If the user speaks loudly while AI is talking, interrupt immediately
        if (normalized > 0.35 && isAiActive) {
          stopAllPlayback();
          setSessionState('listening');
          if (ws.readyState === WebSocket.OPEN) {
            if (isDirectRef.current) {
              // Direct Gemini protocol turn complete signals barge-in
              ws.send(JSON.stringify({ clientContent: { turnComplete: false, interrupted: true } }));
            } else {
              ws.send(JSON.stringify({ interrupted: true }));
            }
          }
        }
      } else {
        setIsUserActive(false);
      }

      animationFrameIdRef.current = requestAnimationFrame(updateLevels);
    };
    animationFrameIdRef.current = requestAnimationFrame(updateLevels);

    // 5. Setup recorder ScriptProcessor to encode and stream PCM 16-bit
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN || isMuted) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBuffer = floatTo16BitPCM(inputData);
      const base64Audio = arrayBufferToBase64(pcmBuffer);

      if (isDirectRef.current) {
        ws.send(JSON.stringify({
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }
            ]
          }
        }));
      } else {
        ws.send(JSON.stringify({ audio: base64Audio }));
      }
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
  };

  // Connect directly from client/browser to Google's public Gemini Multimodal API (Vercel/Cloudflare WebSocket Fallback)
  const startDirectSession = (apiKey: string, stream: MediaStream, audioCtx: AudioContext) => {
    try {
      isDirectRef.current = true;
      const directUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      
      const ws = new WebSocket(directUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsStarted(true);
        isSessionStartedRef.current = true;
        setIsConnecting(false);
        setSessionState('listening');
        playStartSound();

        // Send direct setup frame payload
        const instruction = SYSTEM_INSTRUCTIONS[mode];
        const setupMsg = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: selectedVoice
                  }
                }
              }
            },
            systemInstruction: {
              parts: [
                {
                  text: instruction
                }
              ]
            }
          }
        };
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          const audio = data.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            setSessionState('speaking');
            playAudioChunk(audio);
          }
          
          if (data.serverContent?.interrupted) {
            stopAllPlayback();
            setSessionState('listening');
          }
          
          if (data.error) {
            setError(data.error.message || 'Gemini server error');
            stopSession();
          }
        } catch (err) {
          console.error('[DirectWS] Parse error', err);
        }
      };

      ws.onclose = (event) => {
        console.log('[DirectWS] Closed with code:', event.code, 'reason:', event.reason);
        if (event.code !== 1000 && event.code !== 1005) {
          setError(`Direct Gemini Live connection closed (Code ${event.code}). Please verify your GEMINI_API_KEY is correct, active, and has access to the Multimodal Live API. Reason: ${event.reason || 'Authentication failed or API key not valid.'}`);
        }
        stopSession(true);
      };

      ws.onerror = (e) => {
        console.error('[DirectWS] connection error:', e);
        setError('Failed to establish a direct connection to the Gemini Live API host. Check your connection or API key settings.');
        stopSession();
      };

      setupAudioNodes(stream, audioCtx, ws);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to initialize direct Gemini Live API connection.');
      setIsConnecting(false);
      stopSession();
    }
  };

  // Start Voice Calling Session using Default Voice & Model
  const startVoiceSession = async () => {
    setIsConnecting(true);
    setError(null);
    stopSession(); // Reset any existing stream fully before starting a fresh one
    isDirectRef.current = false;

    // Fetch config early
    let serverConfig: { apiKey?: string } = {};
    try {
      const res = await fetch('/api/live-config');
      if (res.ok) {
        serverConfig = await res.json();
      }
    } catch (e) {
      console.warn('Could not fetch server live-config:', e);
    }

    try {
      // 1. Request microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Initialize AudioContext at 16000Hz (recommended standard sample rate for Gemini Live audio streams)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      // 3. Connect to the WebSocket endpoint on our full-stack server
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws?mode=${mode}&voice=${selectedVoice}`;
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      let fallbackTriggered = false;

      const triggerDirectFallback = async () => {
        if (fallbackTriggered) return;
        fallbackTriggered = true;
        
        console.warn("[VoiceCallController] Server duplex proxy socket errored/closed. Attempting direct fallback to Google Gemini Live API...");
        
        let apiKey = serverConfig.apiKey || 
                     process.env.GEMINI_API_KEY || 
                     process.env.VITE_GEMINI_API_KEY || 
                     ((import.meta as any).env?.VITE_GEMINI_API_KEY as string);
        if (!apiKey) {
          try {
            const res = await fetch('/api/live-config');
            if (res.ok) {
              const data = await res.json();
              apiKey = data.apiKey;
            }
          } catch (e) {
            console.error('[Fallback] Failed to fetch live-config API key:', e);
          }
        }
        
        if (apiKey) {
          startDirectSession(apiKey, stream, audioCtx);
        } else {
          setError('Failed to establish a duplex connection with Gemini. Please configure GEMINI_API_KEY or VITE_GEMINI_API_KEY in your Vercel or environment settings.');
          stopSession();
        }
      };

      ws.onopen = () => {
        setIsStarted(true);
        setSessionState('thinking');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.status === 'connected') {
            isSessionStartedRef.current = true;
            setIsConnecting(false);
            setSessionState('listening');
            playStartSound();
            return;
          }
          
          if (data.audio) {
            setSessionState('speaking');
            playAudioChunk(data.audio);
          }
          
          if (data.interrupted) {
            stopAllPlayback();
            setSessionState('listening');
          }
          
          if (data.error) {
            setError(data.error);
            stopSession();
          }
        } catch (err) {
          console.error('[ClientWS] Parse error', err);
        }
      };

      ws.onclose = () => {
        if (!isSessionStartedRef.current) {
          triggerDirectFallback();
        } else {
          stopSession(true);
        }
      };

      ws.onerror = () => {
        triggerDirectFallback();
      };

      setupAudioNodes(stream, audioCtx, ws);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Microphone access denied or audio hardware not available.');
      setIsConnecting(false);
      stopSession();
    }
  };

  // Convert Float32 state data to 16-bit Signed Little Endian PCM
  const floatTo16BitPCM = (input: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  };

  // Buffer to raw base64 converter
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  // Audio player chunk queue logic for gapless voice feed
  const playAudioChunk = (base64Audio: string) => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx || audioCtx.state === 'closed') return;

    try {
      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Data = new Int16Array(bytes.buffer);
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      const buffer = audioCtx.createBuffer(1, float32Data.length, 24000);
      buffer.copyToChannel(float32Data, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      const currentTime = audioCtx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.05; // Gentle timing buffer guard against jitter
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;

      activeSourcesRef.current.push(source);
      setIsAiActive(true);

      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((src) => src !== source);
        if (activeSourcesRef.current.length === 0) {
          setIsAiActive(false);
          setSessionState('listening');
        }
      };
    } catch (err) {
      console.warn('[Audio Out] Output chunk failure', err);
    }
  };

  const stopAllPlayback = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch (e) {}
    });
    activeSourcesRef.current = [];
    nextStartTimeRef.current = 0;
    setIsAiActive(false);
  };

  const stopSession = (playChime = false) => {
    const wasStarted = isStarted;

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {}
      sourceRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    stopAllPlayback();

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        audioCtxRef.current.close();
      } catch (e) {}
      audioCtxRef.current = null;
    }

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }

    setIsStarted(false);
    isSessionStartedRef.current = false;
    setSessionState('idle');
    setIsConnecting(false);
    setUserMicLevel(0);
    setIsUserActive(false);
    setIsAiActive(false);

    if (playChime && wasStarted) {
      playStopSound();
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  // Trigger automatic hot-reconnection when selected voice changes during an active call
  const initialVoiceMountRef = useRef(true);
  useEffect(() => {
    if (initialVoiceMountRef.current) {
      initialVoiceMountRef.current = false;
      return;
    }
    if (isStarted) {
      console.log(`[VoiceCallController] Voice changed to ${selectedVoice} during live session. Automatically reconnecting...`);
      startVoiceSession();
    }
  }, [selectedVoice]);

  // Theme Styling Configuration
  const themeStyles = {
    indigo: {
      accent: 'bg-pink-600 hover:bg-pink-700 text-white',
      outline: 'text-pink-600 bg-pink-50 border-pink-100/50',
      ring: 'bg-pink-100/30',
      orb: 'bg-pink-500',
      glow: 'shadow-[0_0_30px_rgba(219,39,119,0.15)]'
    },
    emerald: {
      accent: 'bg-pink-600 hover:bg-pink-700 text-white',
      outline: 'text-pink-600 bg-pink-50 border-pink-100/50',
      ring: 'bg-pink-100/30',
      orb: 'bg-pink-500',
      glow: 'shadow-[0_0_30px_rgba(219,39,119,0.15)]'
    },
    violet: {
      accent: 'bg-pink-600 hover:bg-pink-700 text-white',
      outline: 'text-pink-600 bg-pink-50 border-pink-100/50',
      ring: 'bg-pink-100/30',
      orb: 'bg-pink-500',
      glow: 'shadow-[0_0_30px_rgba(219,39,119,0.15)]'
    }
  }[themeColor];

  return (
    <div className="flex-grow flex flex-col justify-between p-6 max-w-sm mx-auto w-full h-full min-h-[500px] font-sans">
      <AnimatePresence mode="wait">
        {!isStarted ? (
          // 1. CHILL IDLE SCREEN
          <motion.div
            key="idle-state"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-grow flex flex-col justify-between gap-6"
          >
            <div className="space-y-6 pt-2">
              {/* Simple subtle live indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono uppercase tracking-widest font-semibold">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-pink-400"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-pink-500"></span>
                  </span>
                  <span>Interactive Voice Connection</span>
                </div>
                {isConnecting && (
                  <span className="text-[9px] uppercase font-mono text-pink-500 flex items-center gap-1 animate-pulse">
                    <Loader2 size={10} className="animate-spin" />
                    Connecting
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight leading-snug">
                  {title}
                </h1>
                <p className="text-zinc-500 text-xs leading-relaxed font-normal">
                  {description}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs flex gap-2 items-start">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span className="font-semibold text-[11px] leading-tight">{error}</span>
                </div>
              )}

              {/* COMPANION VOICE SELECTION */}
              <div className="space-y-2 relative z-30 pt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold block">
                  Companion Voice
                </span>
                
                <div className="relative">
                  {/* Select Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsDropdownActive(!isDropdownActive)}
                    className="w-full flex items-center justify-between text-left text-xs bg-zinc-50 border border-zinc-100/80 hover:bg-zinc-100/50 p-3 rounded-xl outline-none text-zinc-800 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                      <div>
                        <span className="font-semibold text-zinc-900">
                          {selectedVoice}
                        </span>
                        <span className="ml-2 text-[9px] bg-white text-zinc-500 border border-zinc-200/60 px-1.5 py-0.5 rounded-full font-medium">
                          {SUPPORTED_VOICES.find(v => v.id === selectedVoice)?.gender === 'female' ? 'Female' : 'Male'}
                        </span>
                      </div>
                    </div>
                    <ChevronDown size={14} className="text-zinc-400" />
                  </button>

                  {/* Options List */}
                  <AnimatePresence>
                    {isDropdownActive && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsDropdownActive(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute left-0 right-0 mt-1.5 max-h-[180px] overflow-y-auto bg-white border border-zinc-100 rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.06)] z-50 p-1 scrollbar-thin"
                        >
                          {SUPPORTED_VOICES.map((v) => {
                            const isSelected = v.id === selectedVoice;
                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => {
                                  setSelectedVoice(v.id);
                                  localStorage.setItem('prebuilt_voice_selection', v.id);
                                  setIsDropdownActive(false);
                                }}
                                className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                                  isSelected 
                                    ? 'bg-pink-50 text-pink-600 font-semibold' 
                                    : 'hover:bg-zinc-50 text-zinc-700'
                                }`}
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-[12px]">{v.name}</span>
                                    <span className={`text-[8px] px-1 rounded-sm ${v.gender === 'female' ? 'bg-pink-100/40 text-pink-600' : 'bg-zinc-100 text-zinc-500'}`}>
                                      {v.gender === 'female' ? 'Female' : 'Male'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-zinc-400 font-normal leading-tight mt-0.5">{v.description}</p>
                                </div>
                                {isSelected && <Check size={12} className="text-pink-500" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* START BUTTON */}
            <div className="pb-4">
              <button
                id="start-voice-session-btn"
                disabled={isConnecting}
                onClick={startVoiceSession}
                className={`w-full py-3.5 ${themeStyles.accent} active:scale-98 font-semibold text-xs rounded-xl shadow-md shadow-pink-500/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isConnecting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Starting session...
                  </>
                ) : (
                  <>
                    <Play size={12} fill="currentColor" />
                    Connect {title.includes('Debate') ? 'Debate Agent' : title.includes('Practice') ? 'Language Partner' : 'Translator'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          // 2. ACTIVE LIVE CALL SCREEN (Minimalist & Aesthetic Orb Visualizer)
          <motion.div
            key="call-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-grow flex flex-col justify-between"
          >
            {/* Header calling status */}
            <header className="flex justify-between items-center z-10">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-pink-400"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                </span>
                <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 font-mono">
                  {sessionState === 'speaking' ? 'Agent Response' : 'Listening... Speak Now'}
                </span>
              </div>
              <div className="bg-zinc-50 border border-zinc-100 text-zinc-500 px-2.5 py-1 rounded-full text-[9px] font-mono flex items-center gap-1">
                <Volume2 size={10} />
                <span>{selectedVoice}</span>
              </div>
            </header>

            {/* Centered Pulsing Aesthetic Minimal voice loop Indicator */}
            <div className="flex-grow flex flex-col items-center justify-center gap-6 py-12 relative">
              <div className="relative flex items-center justify-center">
                {/* Clean outward sound waves representing sound level */}
                <AnimatePresence>
                  {isAiActive && (
                    <>
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0.5 }}
                        animate={{ scale: 2.1, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
                        className="absolute h-20 w-20 rounded-full bg-pink-100/40 filter blur"
                      />
                    </>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isUserActive && (
                    <>
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0.5 }}
                        animate={{ scale: 1.3 + userMicLevel, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
                        className="absolute h-20 w-20 rounded-full bg-zinc-100 filter blur"
                      />
                    </>
                  )}
                </AnimatePresence>

                {/* Main Symmetrical Clean Active Node */}
                <div className={`h-20 w-20 rounded-full flex items-center justify-center relative transition-all duration-300 border ${
                  isAiActive 
                    ? 'bg-rose-500 border-rose-400 shadow-lg shadow-rose-500/10 text-white' 
                    : isUserActive 
                      ? 'bg-zinc-900 border-zinc-800 text-white' 
                      : 'bg-zinc-50 border-zinc-100 text-zinc-400'
                }`}>
                  <Sparkles size={20} className={isAiActive ? 'animate-pulse' : 'opacity-30'} />
                </div>
              </div>

              {/* Minimal current status text */}
              <div className="text-center space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
                  {isAiActive ? 'Agent is speaking' : isUserActive ? 'Listening to you' : 'Duplex Connected'}
                </span>
                <p className="text-[9px] text-zinc-400 max-w-[170px] mx-auto leading-normal">
                  Ask questions or chat naturally. Speak anytime to interrupt.
                </p>
              </div>
            </div>

            {/* CONTROLS ZONE: Symmetric circle action controls */}
            <div className="pb-6 flex justify-center">
              <div className="flex items-center gap-6">
                {/* MUTE CONTROL */}
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className={`h-11 w-11 rounded-full border transition-all flex items-center justify-center shadow-sm cursor-pointer ${
                    isMuted
                      ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100/50'
                      : 'border-zinc-200/80 bg-white text-zinc-650 hover:bg-zinc-50'
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                {/* STOP/HANGUP CONTROL */}
                <button
                  id="stop-voice-session-btn"
                  onClick={() => stopSession(true)}
                  className="h-12 w-12 rounded-full bg-zinc-900 hover:bg-zinc-800 transition-all flex items-center justify-center shadow-md cursor-pointer text-white"
                  title="Disconnect live call"
                >
                  <Square size={12} fill="currentColor" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
