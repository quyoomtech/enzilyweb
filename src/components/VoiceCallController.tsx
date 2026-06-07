import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, HelpCircle, AlertCircle, Play, Square, Loader2 } from 'lucide-react';

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

  // Start Voice Calling Session using Default Voice & Model
  const startVoiceSession = async () => {
    setIsConnecting(true);
    setError(null);
    stopSession(); // Reset any existing stream fully before starting a fresh one

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
      const wsUrl = `${protocol}//${window.location.host}/api/live-ws?mode=${mode}`;
      
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsStarted(true);
        setIsConnecting(false);
        setSessionState('listening');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
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
        stopSession();
      };

      ws.onerror = () => {
        setError('Failed to establish a duplex connection with Gemini. Please try again.');
        stopSession();
      };

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
              ws.send(JSON.stringify({ interrupted: true }));
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
        ws.send(JSON.stringify({ audio: base64Audio }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

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

      const buffer = audioCtx.createBuffer(1, float32Data.length, 16000);
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

  const stopSession = () => {
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
    setSessionState('idle');
    setIsConnecting(false);
    setUserMicLevel(0);
    setIsUserActive(false);
    setIsAiActive(false);
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  // Theme Styling Configuration
  const themeStyles = {
    indigo: {
      accent: 'from-pink-500 to-[#ec4899] hover:from-pink-400 hover:to-[#f43f5e]',
      outline: 'border-pink-200/50 bg-pink-50 text-pink-600',
      ring: 'bg-pink-300/25',
      orb: 'bg-pink-500',
      glow: 'shadow-[0_0_40px_rgba(236,72,153,0.25)]'
    },
    emerald: {
      accent: 'from-[#fb7185] to-rose-500 hover:from-[#f43f5e] hover:to-rose-450',
      outline: 'border-rose-200/50 bg-rose-50 text-rose-500',
      ring: 'bg-rose-300/25',
      orb: 'bg-rose-500',
      glow: 'shadow-[0_0_40px_rgba(244,63,94,0.25)]'
    },
    violet: {
      accent: 'from-[#d946ef] to-[#ec4899] hover:from-[#c2410c] hover:to-[#db2777]',
      outline: 'border-fuchsia-200/50 bg-fuchsia-50/70 text-fuchsia-600',
      ring: 'bg-fuchsia-300/25',
      orb: 'bg-fuchsia-500',
      glow: 'shadow-[0_0_40px_rgba(217,70,239,0.25)]'
    }
  }[themeColor];

  return (
    <div className="flex-grow flex flex-col justify-between p-6 max-w-sm mx-auto w-full h-full min-h-[500px] font-sans">
      <AnimatePresence mode="wait">
        {!isStarted ? (
          // 1. CHILL IDLE SCREEN
          <motion.div
            key="idle-state"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="flex-grow flex flex-col justify-between"
          >
            <div className="space-y-5 pt-4">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase font-mono tracking-wider font-bold px-3 py-1 rounded-full border ${themeStyles.outline}`}>
                  {emoji} Real-Time Voice
                </span>
                {isConnecting && (
                  <span className="text-[10px] uppercase font-mono bg-pink-50 text-pink-500 border border-pink-100/50 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                    <Loader2 size={10} className="animate-spin" />
                    Connecting
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-serif font-light text-zinc-900 tracking-tight leading-snug">
                  {title}
                </h1>
                <p className="text-zinc-500 text-xs leading-relaxed font-normal">
                  {description}
                </p>
              </div>

              {/* Minimal Aesthetic Ambient Card matching layout instructions */}
              <div className="p-4 rounded-2xl bg-pink-50/20 border border-pink-100/40 space-y-1 text-center py-6 shadow-sm">
                <div className="flex justify-center mb-2.5">
                  <div className={`h-1.5 w-1.5 rounded-full ${themeStyles.orb} animate-pulse`} />
                </div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-[#a1a1aa] font-medium">
                  Ready to stream duplex audio
                </p>
                <p className="text-[10px] text-zinc-400">
                  Powered by standard Gemini API key
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex gap-2 items-start">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span className="font-semibold text-[11px] leading-tight">{error}</span>
                </div>
              )}
            </div>

            {/* HIGH-CONTRAST START BUTTON ONLY */}
            <div className="pb-8">
              <button
                id="start-voice-session-btn"
                disabled={isConnecting}
                onClick={startVoiceSession}
                className={`w-full py-4 bg-gradient-to-r ${themeStyles.accent} active:scale-98 text-white font-semibold text-sm rounded-full shadow-lg shadow-pink-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isConnecting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Starting Live Call...
                  </>
                ) : (
                  <>
                    <Play size={14} fill="currentColor" />
                    Start {mode.toUpperCase()}
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
                  {sessionState === 'speaking' ? 'Companion Talking' : 'Listening... speak now'}
                </span>
              </div>
              <div className="bg-pink-50/50 border border-pink-100/40 text-pink-500 px-3 py-1 rounded-full text-[9px] font-mono">
                Duplex Active
              </div>
            </header>

            {/* Centered Pulsing Aesthetic Orb Visualization */}
            <div className="flex-grow flex flex-col items-center justify-center gap-8 py-8 relative">
              <div className="relative flex items-center justify-center">
                {/* Outward soundwaves for interactive feedback */}
                <AnimatePresence>
                  {isAiActive && (
                    <>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0.6 }}
                        animate={{ scale: 2.2, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 2.0, ease: 'easeOut' }}
                        className={`absolute h-24 w-24 rounded-full ${themeStyles.ring} filter blur`}
                      />
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0.4 }}
                        animate={{ scale: 1.6, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.6, ease: 'easeOut', delay: 0.3 }}
                        className={`absolute h-24 w-24 rounded-full ${themeStyles.ring} filter blur`}
                      />
                    </>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isUserActive && (
                    <>
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0.6 }}
                        animate={{ scale: 1.4 + userMicLevel, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeOut' }}
                        className="absolute h-24 w-24 rounded-full bg-pink-100/40 filter blur"
                      />
                    </>
                  )}
                </AnimatePresence>

                {/* Main Interactive Orb */}
                <div className={`h-24 w-24 rounded-full flex items-center justify-center relative transition-all duration-500 ring-4 ring-pink-50 ${
                  isAiActive 
                    ? `bg-gradient-to-tr ${themeStyles.accent} ${themeStyles.glow} text-white` 
                    : isUserActive 
                      ? 'bg-gradient-to-tr from-rose-400 to-pink-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.3)]' 
                      : 'bg-pink-50 border border-pink-100 text-pink-400'
                }`}>
                  <Sparkles size={24} className={`${isAiActive ? 'animate-spin-slow' : 'opacity-40'}`} />
                </div>
              </div>

              {/* Sub-status label */}
              <div className="text-center space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-pink-500/70 font-semibold">
                  {isAiActive ? 'Gemini Speaking' : isUserActive ? 'You Speaking' : 'Silent'}
                </span>
                <p className="text-[9px] text-zinc-500 max-w-[160px] mx-auto leading-normal">
                  Speak naturally and fluent at any pacing. Gemini will respond instantly.
                </p>
              </div>
            </div>

            {/* CONTROLS ZONE: Only Mic and Stop Button */}
            <div className="pb-8 space-y-4">
              <div className="flex items-center gap-3">
                {/* MUTE TOGGLE BUTTON */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`flex-1 py-3.5 px-4 rounded-full border transition-all font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer ${
                    isMuted
                      ? 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100/40'
                      : 'border-pink-100 bg-[#fffbfc] text-pink-500 hover:bg-pink-50/50 hover:text-pink-600'
                  }`}
                >
                  {isMuted ? (
                    <>
                      <MicOff size={14} />
                      Muted
                    </>
                  ) : (
                    <>
                      <Mic size={14} />
                      Mute Microphone
                    </>
                  )}
                </button>

                {/* HIGH-CONTRAST STOP BUTTON ONLY */}
                <button
                  id="stop-voice-session-btn"
                  onClick={stopSession}
                  className="py-3.5 px-6 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition-colors shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  title="Hang Up Session"
                >
                  <Square size={12} fill="currentColor" />
                  Stop Session
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
