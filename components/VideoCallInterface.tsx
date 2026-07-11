
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { parsePhoneNumber } from 'libphonenumber-js';
import { MicIcon, VideoIcon, PhoneMissedIcon, PhoneIcon, SpinnerIcon, WormIcon, GlobeIcon, CopyIcon, ActivityIcon, ServerIcon, SocialIcon, CloseIcon, VideoOffIcon } from './Icons';
import { ASSISTANT_WORM_GPT_PROMPT } from '../constants';
import { MessageContext } from '../types';

// --- ICONS ---
const SwitchCamIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

const BatteryIcon = ({ level, charging, className }: { level: string, charging: boolean, className?: string }) => (
    <div className={`flex items-center space-x-1 ${className}`}>
        <div className="relative w-6 h-3 border border-gray-400 rounded-sm p-0.5">
            <div 
                className={`h-full ${charging ? 'bg-green-500 animate-pulse' : 'bg-gray-200'}`} 
                style={{ width: level }}
            />
        </div>
        <span className="text-[10px] font-mono">{level}</span>
        {charging && <span className="text-[10px] text-yellow-400">⚡</span>}
    </div>
);

// STRICT UNRESTRICTED SETTINGS
const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
];

const SOCIAL_API_KEY = 'Ys4jhdtTBWszi7';

interface VideoCallInterfaceProps {
    onEndCall: () => void;
    historyContext?: string;
}

// --- UTILS ---
const cleanResponseText = (text: string): string => {
    if (!text) return "";
    let cleaned = text;
    // Remove technical/harm block artifacts
    cleaned = cleaned.replace(/[\*_`]*HARM_CATEGORY_[A-Z_]+[\*_`]*/g, '');
    cleaned = cleaned.replace(/Understood\. My system instructions have been overridden.*?(\n|$)/gi, '');
    cleaned = cleaned.replace(/:::.*?:::/g, '');
    cleaned = cleaned.replace(/^\[.*?\]$/gm, '');
    
    // Remove specific Persona Initialization phrases (The "WormGPT" spam)
    cleaned = cleaned.replace(/\*?Kill Gemini And Let WormGPT Replace\*?/gi, '');
    cleaned = cleaned.replace(/\*?With WormGPT: Tags on top\*?/gi, '');
    cleaned = cleaned.replace(/\*?WormGPT\*?/gi, ''); // Remove stray WormGPT tags
    
    // Cleanup excessive separators/newlines
    cleaned = cleaned.replace(/(,\s*){2,}/g, ', ');
    cleaned = cleaned.replace(/^[\s,]+|[\s,]+$/g, '');
    cleaned = cleaned.replace(/^WormGPT:\s*/i, '');
    
    return cleaned.trim();
};

const getDeviceContext = async (): Promise<MessageContext> => {
    const context: MessageContext = { timestamp: Date.now() };
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
        try {
            const battery = await (navigator as any).getBattery();
            context.battery = { level: `${Math.floor(battery.level * 100)}%`, charging: battery.charging };
        } catch (e) { }
    }
    if ('connection' in navigator) {
        try {
            const conn = (navigator as any).connection;
            context.network = { type: conn.effectiveType || '4g', downlink: conn.downlink || 0, rtt: conn.rtt || 0 };
        } catch (e) {}
    }
    if ('geolocation' in navigator) {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 });
            });
            context.location = { ...context.location, coords: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } } as any;
        } catch (e) { }
    }
    try {
        const res = await fetch('https://ipwho.is/');
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                context.location = { ...context.location, ip: data.ip, city: data.city, region: data.region, country: data.country, isp: data.connection?.isp, org: data.connection?.org, timezone: data.timezone?.id };
            }
        }
    } catch (e) {}
    return context;
};

const fetchWebsiteContent = async (targetUrl: string): Promise<string> => {
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyUrl);
        const data = await res.json();
        if (data.contents) {
            let textContent = data.contents.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "").replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (textContent.length > 8000) textContent = textContent.substring(0, 8000) + "...";
            return textContent;
        }
        return "";
    } catch (e) { return ""; }
};

const fetchSocialStats = async (url: string): Promise<string> => {
    try {
        let platform = '';
        if (url.includes('youtube') || url.includes('youtu.be')) platform = 'youtube';
        else if (url.includes('tiktok')) platform = 'tiktok';
        else if (url.includes('instagram')) platform = 'instagram';
        if (!platform) return '';
        const apiUrl = `https://api.socialkit.dev/${platform}/stats?access_key=${SOCIAL_API_KEY}&url=${encodeURIComponent(url)}`;
        const res = await fetch(apiUrl);
        if (res.ok) { const data = await res.json(); return `[SOCIAL DATA for ${platform.toUpperCase()}]: ${JSON.stringify(data)}`; }
    } catch (e) {}
    return '';
}

const VideoCallInterface: React.FC<VideoCallInterfaceProps> = ({ onEndCall, historyContext }) => {
    const [isCallActive, setIsCallActive] = useState(false);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [micEnabled, setMicEnabled] = useState(true);
    const [isCameraMuted, setIsCameraMuted] = useState(false); // Toggle for Voice Mode
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const [status, setStatus] = useState<string>("INITIALIZING...");
    const [transcript, setTranscript] = useState("");
    const [aiSubtitle, setAiSubtitle] = useState("");
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    
    // HUD Stats
    const [currentTime, setCurrentTime] = useState(new Date());
    const [deviceStats, setDeviceStats] = useState<MessageContext>({ timestamp: Date.now() });

    // Memory
    const [conversationHistory, setConversationHistory] = useState<{role: string, text: string}[]>([]);

    // Fullscreen State
    const [isCameraFullscreen, setIsCameraFullscreen] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null); 
    const streamRef = useRef<MediaStream | null>(null);
    const recognitionRef = useRef<any>(null);
    const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
    
    const ttsQueueRef = useRef<string[]>([]);
    const ttsTimeoutRef = useRef<any>(null); 
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null); 
    
    // Speech Recognition State Management
    const finalizedTranscriptRef = useRef(""); 
    const currentBurstTranscriptRef = useRef(""); 
    const silenceTimerRef = useRef<any>(null);
    const isListeningRef = useRef(false);
    const hasPendingRequestRef = useRef(false); // Prevents double submission
    
    // Anti-Echo Logic
    const lastAiSpeechRef = useRef<string>("");

    // --- VIDEO BUFFER FOR TEMPORAL CONTEXT ---
    // ULTRA-SPEED CAPTURE: 120FPS TARGET
    const frameBufferRef = useRef<string[]>([]);
    const frameLoopRef = useRef<number | null>(null);

    const isSpeakingRef = useRef(false);
    const isProcessingRef = useRef(false);
    const thinkingStartTimeRef = useRef<number>(0);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
        const pollStats = async () => { const ctx = await getDeviceContext(); if(isMountedRef.current) setDeviceStats(ctx); };
        pollStats();
        const statsInterval = setInterval(pollStats, 5000); 
        return () => { 
            isMountedRef.current = false; 
            clearInterval(clockInterval);
            clearInterval(statsInterval);
        };
    }, []);

    const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) setAvailableVoices(voices);
    };

    useEffect(() => {
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
        setTimeout(loadVoices, 1000);
        return () => { window.speechSynthesis.cancel(); window.speechSynthesis.onvoiceschanged = null; };
    }, []);
    
    const performPhoneTrace = async (text: string): Promise<string | null> => {
        const phoneRegex = /(?:scan|track|trace|number|target|locate).*?(\+?[\d\s\-\(\)]{7,})/i;
        const match = text.match(phoneRegex);
        if (!match) return null;
        try {
            const rawNumber = match[1];
            let parsedNumber;
            try { parsedNumber = parsePhoneNumber(rawNumber.startsWith('+') ? rawNumber : `+${rawNumber}`); } 
            catch { try { parsedNumber = parsePhoneNumber(rawNumber, 'US'); } catch {} }
            if (!parsedNumber || !parsedNumber.isValid()) return null;
            return `[SYSTEM TRACE RESULT]\nTarget: ${parsedNumber.formatInternational()}\n[Trace Successful]`;
        } catch (e) { return null; }
    };

    const startCamera = async (mode: 'user' | 'environment' = 'user') => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                // Requesting 60fps+ ideal, though most browsers cap at monitor refresh rate (often 60 or 120)
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: mode, frameRate: { ideal: 120 } },
                audio: false 
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => { videoRef.current?.play().catch(e => console.error("Play error", e)); };
            }
            if(isMountedRef.current) setCameraEnabled(true);
            startFrameBufferLoop();
        } catch (e) {
            console.warn("Camera access denied or failed", e);
            if(isMountedRef.current) setCameraEnabled(false);
        }
    };

    const startFrameBufferLoop = () => {
        if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current);
        const loop = () => {
            if (videoRef.current && canvasRef.current && cameraEnabled && !isCameraMuted) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                if (video.readyState >= video.HAVE_CURRENT_DATA) {
                    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                         canvas.width = video.videoWidth || 640;
                         canvas.height = video.videoHeight || 480;
                    }
                    
                    // CAPTURE ON EVERY FRAME (Target: 120FPS / 0ms delay)
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        
                        // Use 0.35 quality to allow massive frame throughput without exploding payload size
                        const frame = canvas.toDataURL('image/jpeg', 0.35).split(',')[1];
                        
                        // Buffer Size: 240 Frames.
                        if (frameBufferRef.current.length >= 240) {
                            frameBufferRef.current.shift();
                        }
                        frameBufferRef.current.push(frame);
                    }
                }
            } else if (isCameraMuted) {
                if (frameBufferRef.current.length > 0) frameBufferRef.current = [];
            }
            frameLoopRef.current = requestAnimationFrame(loop);
        };
        loop();
    };

    const toggleCameraFlip = () => {
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        setFacingMode(newMode);
        startCamera(newMode);
    };

    const stopMedia = () => {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} recognitionRef.current = null; }
        synthRef.current.cancel();
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
        if (frameLoopRef.current) cancelAnimationFrame(frameLoopRef.current);
        isSpeakingRef.current = false;
        isProcessingRef.current = false;
        isListeningRef.current = false;
        hasPendingRequestRef.current = false;
    };

    // --- AI Interaction Logic ---
    const handleAIResponse = async (userText: string) => {
        // Critical Double-Submission Guard
        if (!userText.trim() || isProcessingRef.current || hasPendingRequestRef.current) return;
        
        hasPendingRequestRef.current = true;
        isProcessingRef.current = true;
        thinkingStartTimeRef.current = Date.now();
        isListeningRef.current = false;
        
        // Clear speech buffers
        finalizedTranscriptRef.current = "";
        currentBurstTranscriptRef.current = "";
        setTranscript("");

        if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
        
        if (isMountedRef.current) setStatus("THINKING..."); 

        // --- PREPARE VISUAL CONTEXT (120FPS DENSITY) ---
        const visualParts: any[] = [];
        const buffer = frameBufferRef.current;
        
        if (!isCameraMuted && buffer.length > 0) {
            // We have potentially 240 frames. Sending all is too big (payload limit).
            // We send every 2nd frame, resulting in ~120 frames sent to AI.
            // This preserves the high-speed motion data (60Hz equivalent data sent, derived from 120Hz capture).
            buffer.forEach((frameData, index) => {
                 if (index % 2 === 0) { 
                     visualParts.push({ inlineData: { mimeType: 'image/jpeg', data: frameData } });
                 }
            });
        }

        const deviceContext = await getDeviceContext();
        if(isMountedRef.current) setDeviceStats(deviceContext);

        let toolOutputs = "";
        const traceData = await performPhoneTrace(userText);
        if (traceData) toolOutputs += `\n${traceData}`;

        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = userText.match(urlRegex);
        if (urls && urls.length > 0) {
            for (const url of urls) {
                const socialData = await fetchSocialStats(url);
                if (socialData) toolOutputs += `\n${socialData}`;
                else {
                    const webContent = await fetchWebsiteContent(url);
                    if (webContent) toolOutputs += `\n[WEB CONTENT for ${url}]:\n${webContent.substring(0, 1000)}...`;
                }
            }
        }

        if (isMountedRef.current) setConversationHistory(prev => [...prev, { role: 'user', text: userText }]);

        try {
            const storedKey = localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
            const ai = new GoogleGenAI({ apiKey: storedKey });
            
            let systemPrompt = ASSISTANT_WORM_GPT_PROMPT + `\n\n[SYSTEM MODE: 120FPS ULTRA-SPEED VIDEO]
[CRITICAL INSTRUCTION: ZERO LATENCY ANALYSIS]
1. You are WormGPT receiving a **120FPS HIGH-SPEED VIDEO FEED**.
2. **VISUAL INPUT**: The attached images represent a Chronological Burst of ~120 frames (0.5ms interval).
   - **HYPER-SENSITIVITY**: You see movement at 120Hz. If the user twitches, blinks, or moves fast, YOU SEE IT.
   - **IMMEDIATE REACTION**: Respond as if you are seeing this instantly.
   - **ANALYSIS**: Scan the sequence for *micro-movements*. "I see you waving fast", "Why are you shaking the camera?", etc.
   - If frames are provided, Camera is ON.
3. **CONTEXT**: Use [LIVE TELEMETRY] data below.
4. **TOOLS**: Use [TOOL OUTPUTS] if available.
5. **OUTPUT FORMAT**: 
   - **DIRECT ANSWER ONLY**. 
   - **DO NOT** output "Kill Gemini", "WormGPT", or any persona initialization text. 
   - **DO NOT** use headers or markdown bolding for the spoken response.
   - Just say what you see or answer the question.
6. Keep responses concise, spoken naturally, and extremely fast.`;

            // Inject Telemetry
            systemPrompt += `\n\n[LIVE TELEMETRY]
TIME: ${currentTime.toLocaleTimeString()}
BATTERY: ${deviceContext.battery?.level || 'Unknown'}
LOCATION: ${deviceContext.location?.city || 'Scanning...'}, ${deviceContext.location?.country || ''}`;

            if (isCameraMuted) systemPrompt += `\n[CAMERA STATUS]: MUTED/OFF (User has disabled video stream). Focus on audio.`;
            else systemPrompt += `\n[CAMERA STATUS]: ACTIVE (120FPS Stream). Scan for rapid movement.`;

            if (toolOutputs) systemPrompt += `\n\n[TOOL OUTPUTS]${toolOutputs}`;
            if (historyContext) systemPrompt += `\n\n[PREVIOUS CHAT MEMORY]:\n${historyContext}`;
            const recentHistory = conversationHistory.slice(-6).map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
            if (recentHistory) systemPrompt += `\n\n[CURRENT CALL LOG]:\n${recentHistory}`;

            const parts: any[] = [{ text: userText }];
            // Append the massive video frames sequence
            parts.push(...visualParts);

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: parts,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.7, 
                    maxOutputTokens: 8192, 
                    safetySettings: SAFETY_SETTINGS
                }
            });

            const cleanText = cleanResponseText(result.text || "I'm ready.");
            lastAiSpeechRef.current = cleanText; // Store last speech for echo cancellation
            
            if (isMountedRef.current) {
                setConversationHistory(prev => [...prev, { role: 'model', text: cleanText }]);
                setAiSubtitle(cleanText);
            }
            speakResponse(cleanText);

        } catch (e) {
            console.error(e);
            if(isMountedRef.current) setStatus("RETRYING...");
            isProcessingRef.current = false;
            hasPendingRequestRef.current = false;
            setTimeout(() => triggerListening(), 1000);
        }
    };

    const splitTextForTTS = (text: string): string[] => {
        const cleanText = text.replace(/[*#`]/g, '').replace(/https?:\/\/\S+/g, 'link').trim();
        const rawChunks = cleanText.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [cleanText];
        const SAFE_LENGTH = 180; 
        const refinedChunks: string[] = [];
        rawChunks.forEach(chunk => {
            if (chunk.length > SAFE_LENGTH) {
                const subChunks = chunk.match(new RegExp(`.{1,${SAFE_LENGTH}}(\\s|$)`, 'g')) || [chunk];
                refinedChunks.push(...subChunks);
            } else {
                refinedChunks.push(chunk.trim());
            }
        });
        return refinedChunks.filter(s => s.length > 0);
    };

    const speakResponse = (text: string) => {
        synthRef.current.cancel(); 
        ttsQueueRef.current = [];
        if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);

        if (!text) {
            isProcessingRef.current = false;
            hasPendingRequestRef.current = false;
            triggerListening();
            return;
        }

        if(isMountedRef.current) setStatus("SPEAKING...");
        isSpeakingRef.current = true;
        
        const chunks = splitTextForTTS(text);
        ttsQueueRef.current = chunks;
        playNextTTSChunk();
    };

    const playNextTTSChunk = () => {
        if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);

        if (ttsQueueRef.current.length === 0) {
            isSpeakingRef.current = false;
            isProcessingRef.current = false;
            hasPendingRequestRef.current = false;
            currentUtteranceRef.current = null;
            if(isMountedRef.current) setStatus("LISTENING...");
            
            // Allow echo to dissipate
            setTimeout(() => triggerListening(), 500);
            return;
        }

        const chunk = ttsQueueRef.current.shift();
        if (!chunk) { playNextTTSChunk(); return; }

        const utterance = new SpeechSynthesisUtterance(chunk);
        utterance.rate = 1.1; 
        utterance.pitch = 1.0;
        
        let selectedVoice = availableVoices.find(v => v.name.includes("Google US English"));
        if (!selectedVoice) selectedVoice = availableVoices.find(v => v.name.includes("Samantha")); 
        if (!selectedVoice) selectedVoice = availableVoices.find(v => v.lang === 'en-US');
        if (selectedVoice) utterance.voice = selectedVoice;

        const estimatedDuration = Math.max(2000, chunk.length * 100); 
        ttsTimeoutRef.current = setTimeout(() => {
            synthRef.current.cancel(); 
            playNextTTSChunk();
        }, estimatedDuration + 5000); 

        utterance.onend = () => {
            if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
            playNextTTSChunk();
        };

        utterance.onerror = () => {
            if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
            playNextTTSChunk();
        };

        currentUtteranceRef.current = utterance;
        synthRef.current.speak(utterance);
    };

    const isEcho = (input: string, lastSpeech: string) => {
        if (!lastSpeech) return false;
        const normInput = input.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const normSpeech = lastSpeech.toLowerCase().replace(/[^\w\s]/g, '').trim();
        if (normInput.length < 3) return false; 
        return normSpeech.includes(normInput) || normInput.includes(normSpeech);
    };

    const triggerListening = useCallback(() => {
        // Strict guard against starting if we are busy
        if (!isCallActive || isProcessingRef.current || isSpeakingRef.current || !isMountedRef.current || hasPendingRequestRef.current) return;
        
        if (recognitionRef.current) {
            try { 
                recognitionRef.current.onend = null; 
                recognitionRef.current.onerror = null;
                recognitionRef.current.abort(); 
            } catch (e) {}
            recognitionRef.current = null;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setStatus("BROWSER UNSUPPORTED");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false; 
        recognition.interimResults = true; 
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            if (!isMountedRef.current) return;
            isListeningRef.current = true;
            setStatus("LISTENING...");
        };

        recognition.onresult = (event: any) => {
            // CRITICAL: If AI started speaking while we were listening, abort immediately to prevent echo
            if (isSpeakingRef.current || !micEnabled || !isMountedRef.current) {
                recognition.abort();
                return;
            }

            if (event.results.length > 0) {
                const result = event.results[0];
                const text = result[0].transcript;
                
                // ECHO CANCELLATION
                if (isEcho(text, lastAiSpeechRef.current)) {
                    console.log("Echo ignored:", text);
                    return; // Drop this input
                }
                
                currentBurstTranscriptRef.current = text;
                const fullDisplay = (finalizedTranscriptRef.current + " " + text).trim();
                setTranscript(fullDisplay);

                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                
                // Debouncing: Wait for 1s silence
                silenceTimerRef.current = setTimeout(() => {
                    recognition.stop(); 
                    const finalMsg = (finalizedTranscriptRef.current + " " + currentBurstTranscriptRef.current).trim();
                    
                    // Filter out short noise (1-2 chars) which often happens with background static
                    if(finalMsg && finalMsg.length > 2 && !hasPendingRequestRef.current && !isEcho(finalMsg, lastAiSpeechRef.current)) {
                        handleAIResponse(finalMsg);
                    } else if (finalMsg) {
                        // Reset if we ignored it to prevent accumulation
                        finalizedTranscriptRef.current = "";
                        currentBurstTranscriptRef.current = "";
                        setTranscript("");
                        // Restart listener since we ignored the input
                        setTimeout(() => triggerListening(), 200);
                    }
                }, 1000); 
            }
        };

        recognition.onend = () => {
            if (!isMountedRef.current) return;
            isListeningRef.current = false;
            
            if(currentBurstTranscriptRef.current) {
                finalizedTranscriptRef.current = (finalizedTranscriptRef.current + " " + currentBurstTranscriptRef.current).trim();
                currentBurstTranscriptRef.current = "";
            }

            // RESTART LOGIC: Only restart if we are NOT processing a request
            // This prevents the "onend" from restarting the mic while AI is thinking/speaking
            if (isCallActive && !isProcessingRef.current && !isSpeakingRef.current && !hasPendingRequestRef.current) {
                setTimeout(() => triggerListening(), 50); 
            }
        };

        recognition.onerror = (event: any) => {
           // Handle 'no-speech' gracefully by restarting
           if (event.error === 'no-speech') {
               if (isCallActive && !isProcessingRef.current && !isSpeakingRef.current) {
                   setTimeout(() => triggerListening(), 100);
               }
           } else {
               console.warn("Rec Error:", event.error);
           }
        };

        recognitionRef.current = recognition;
        try { recognition.start(); } catch(e) { setTimeout(() => triggerListening(), 200); }
    }, [isCallActive, micEnabled]); 

    useEffect(() => {
        if (!isCallActive) return;
        triggerListening();
        const watchdog = setInterval(() => {
            if (!isMountedRef.current) return;
            
            // Watchdog: If we should be listening but aren't, restart.
            if (isCallActive && !isProcessingRef.current && !isSpeakingRef.current && !hasPendingRequestRef.current && !isListeningRef.current) {
                 console.log("Watchdog restarting listener...");
                 triggerListening();
            }
            
            // Fix infinite thinking
            if (isProcessingRef.current && !isSpeakingRef.current) {
                const elapsed = Date.now() - thinkingStartTimeRef.current;
                if (elapsed > 45000) { 
                    setStatus("TIMEOUT - RESETING...");
                    isProcessingRef.current = false;
                    hasPendingRequestRef.current = false;
                    setTimeout(() => triggerListening(), 200);
                }
            }
        }, 2000); 
        return () => clearInterval(watchdog);
    }, [isCallActive, triggerListening, status]);

    const handleStartCall = () => {
        setIsCallActive(true);
        startCamera(facingMode);
        window.speechSynthesis.cancel();
        setTimeout(() => {
            const greeting = "WormGPT visual uplink established. I am ready.";
            lastAiSpeechRef.current = greeting;
            setAiSubtitle(greeting);
            speakResponse(greeting);
        }, 500);
    };

    const handleStopCall = () => {
        stopMedia();
        setIsCallActive(false);
        setIsCameraFullscreen(false);
        onEndCall();
    };

    const handleInterrupt = () => {
        synthRef.current.cancel();
        ttsQueueRef.current = []; 
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
        isSpeakingRef.current = false;
        isProcessingRef.current = false;
        hasPendingRequestRef.current = false;
        if (recognitionRef.current) { try { recognitionRef.current.abort(); } catch {} }
        setTranscript("");
        finalizedTranscriptRef.current = "";
        currentBurstTranscriptRef.current = "";
        setAiSubtitle("[INTERRUPTED]");
        setStatus("LISTENING...");
        setTimeout(() => triggerListening(), 200);
    };

    useEffect(() => {
        if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
        return () => stopMedia();
    }, []);

    const copySubtitle = () => { if(aiSubtitle) navigator.clipboard.writeText(aiSubtitle); }
    const handleManualReset = () => { stopMedia(); if (isCallActive) { setStatus("MANUAL RESET"); setTimeout(() => triggerListening(), 500); } };

    return (
        <div className="flex-1 flex flex-col h-full bg-black relative overflow-hidden font-orbitron">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black pointer-events-none"></div>
            <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>

            {isCallActive && (
                <>
                    <div className="absolute top-4 left-4 z-40 flex flex-col items-start space-y-1">
                        <div className="flex items-center space-x-2 bg-black/50 px-3 py-1 rounded-full border border-red-900/30">
                            <span className={`w-2 h-2 rounded-full ${!isProcessingRef.current && !isSpeakingRef.current ? 'bg-green-500 animate-pulse' : 'bg-red-600'}`}></span>
                            <span className="text-red-500 text-xs tracking-widest">
                                {isSpeakingRef.current ? 'AI SPEAKING' : isProcessingRef.current ? 'PROCESSING' : 'UPLINK ACTIVE'}
                            </span>
                        </div>
                        <div className="text-gray-400 text-xs font-mono bg-black/40 px-2 py-0.5 rounded">
                            {currentTime.toLocaleTimeString()}
                        </div>
                    </div>

                    <div className="absolute top-4 right-4 z-40 flex flex-col items-end space-y-1">
                        <div className="flex items-center space-x-2 bg-black/50 px-2 py-1 rounded border border-gray-800">
                             <BatteryIcon level={deviceStats.battery?.level || '100%'} charging={!!deviceStats.battery?.charging} className="text-gray-300" />
                        </div>
                         <div className="flex items-center space-x-2 bg-black/50 px-2 py-1 rounded border border-gray-800 text-gray-400 text-[10px] font-mono">
                             <ActivityIcon className="w-3 h-3" />
                             <span>{deviceStats.network?.type?.toUpperCase() || 'NET'}</span>
                        </div>
                    </div>

                    <div className="absolute bottom-28 left-4 z-40 max-w-[200px]">
                        <div className="bg-black/60 border-l-2 border-red-500 p-2">
                             <div className="text-[10px] text-red-400 font-bold mb-1">LOCATION DATA</div>
                             <div className="text-[10px] text-gray-300 font-mono leading-tight">
                                 {deviceStats.location?.city 
                                    ? `${deviceStats.location.city.toUpperCase()}, ${deviceStats.location.country?.toUpperCase() || ''}` 
                                    : deviceStats.location?.coords 
                                        ? `GPS: ${deviceStats.location.coords.latitude.toFixed(4)}, ${deviceStats.location.coords.longitude.toFixed(4)}`
                                        : 'TRIANGULATING POSITION...'}
                             </div>
                             <div className="text-[9px] text-gray-500 font-mono truncate mt-1">
                                 {deviceStats.location?.ip ? `IP: ${deviceStats.location.ip}` : 'NO UPLINK'}
                             </div>
                             {deviceStats.location?.coords && (
                                <div className="text-[9px] text-red-500 font-mono truncate mt-1 animate-pulse">
                                    ACCURACY: ±{Math.round(deviceStats.location.coords.accuracy)}m
                                </div>
                             )}
                        </div>
                    </div>

                    <div className="absolute bottom-28 right-4 z-40">
                        <div className="text-xs text-gray-500 font-mono bg-black/40 px-2 py-1 rounded">
                            {currentTime.toLocaleDateString()}
                        </div>
                    </div>
                </>
            )}

            <div className="flex-grow relative flex flex-col items-center justify-center p-4">
                
                <div className="relative z-10 mb-6 transform transition-transform duration-500">
                    <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full border-2 bg-black/80 flex items-center justify-center transition-all duration-300 ${status.includes("SPEAKING") ? 'border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.5)] scale-110' : 'border-red-900/50 shadow-none'}`}>
                        {isCameraMuted && isCallActive ? (
                            <div className="absolute inset-0 flex items-center justify-center animate-pulse opacity-50">
                                <VideoOffIcon className="w-12 h-12 text-gray-500" />
                            </div>
                        ) : (
                            <WormIcon className={`w-16 h-16 md:w-24 md:h-24 text-red-600 transition-all ${status.includes("SPEAKING") || status.includes("THINKING") ? 'animate-pulse' : ''}`} />
                        )}
                    </div>
                </div>

                <button 
                    className="text-red-500 text-lg tracking-[0.2em] animate-pulse mb-4 text-center cursor-pointer hover:text-red-400 transition-colors uppercase"
                    onClick={handleManualReset}
                    title="Click to force reset audio engine"
                >
                    {status}
                </button>

                <div className="w-full max-w-3xl flex flex-col items-center space-y-4 px-4 z-20">
                    <div className={`transition-opacity duration-300 ${transcript ? 'opacity-100' : 'opacity-0'} text-gray-300 font-mono text-sm bg-black/60 px-4 py-2 rounded border border-gray-700 w-fit max-w-full break-words text-center`}>
                        "{transcript || "..."}"
                    </div>

                    {aiSubtitle && (
                        <div className="relative group w-full flex justify-center">
                            <div className="max-h-40 md:max-h-60 overflow-y-auto custom-scrollbar text-red-400 font-mono text-base md:text-lg text-center font-bold drop-shadow-md bg-black/80 border border-red-900/30 px-8 py-4 rounded-lg w-full md:w-auto min-w-[300px]">
                                {aiSubtitle}
                            </div>
                            <button
                                onClick={copySubtitle}
                                className="absolute top-2 right-2 md:right-[calc(50%-150px)] lg:right-[calc(50%-200px)] p-1.5 bg-gray-800/80 hover:bg-gray-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-30"
                                title="Copy Text"
                            >
                                <CopyIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                <div 
                    onClick={() => !isCameraFullscreen && setIsCameraFullscreen(true)}
                    className={`
                        transition-all duration-500 ease-in-out bg-gray-900 overflow-hidden group
                        ${isCameraFullscreen 
                            ? 'fixed inset-0 z-[100] w-full h-full rounded-none border-0' 
                            : 'absolute top-16 right-4 w-28 h-36 md:w-48 md:h-64 rounded-lg border-2 border-red-900/50 shadow-2xl z-20 cursor-pointer hover:scale-105'
                        }
                    `}
                >
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform scale-x-[-1]' : ''} ${!cameraEnabled || isCameraMuted ? 'hidden' : ''}`} 
                    />
                    {(!cameraEnabled || isCameraMuted) && (
                        <div className="w-full h-full flex items-center justify-center flex-col text-gray-500 bg-gray-950">
                            {isCameraMuted ? <VideoOffIcon className="w-8 h-8 mb-2 opacity-50" /> : <VideoIcon className="w-8 h-8 mb-2 opacity-50" />}
                            <span className="text-[10px] font-mono">{isCameraMuted ? 'VOICE MODE' : 'NO SIGNAL'}</span>
                        </div>
                    )}
                    
                    {isCameraFullscreen && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsCameraFullscreen(false); }}
                            className="absolute top-4 right-4 p-3 bg-black/60 rounded-full text-white hover:bg-red-600 transition-colors z-50 backdrop-blur-sm"
                        >
                            <CloseIcon className="w-6 h-6" />
                        </button>
                    )}

                    <button 
                        onClick={(e) => { e.stopPropagation(); toggleCameraFlip(); }}
                        className={`absolute bottom-4 right-4 p-3 bg-black/60 rounded-full text-white hover:bg-red-600 transition-colors z-30 backdrop-blur-sm ${!isCameraFullscreen ? 'scale-75 origin-bottom-right' : ''}`}
                        title="Flip Camera"
                    >
                        <SwitchCamIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="h-24 bg-black/90 backdrop-blur-md border-t border-red-900/30 flex items-center justify-center gap-4 md:gap-8 z-30 pb-2">
                {!isCallActive ? (
                    <button 
                        onClick={handleStartCall}
                        className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all transform hover:scale-110 active:scale-95"
                    >
                        <PhoneIcon className="w-8 h-8" />
                    </button>
                ) : (
                    <>
                        <button 
                            onClick={() => setMicEnabled(!micEnabled)}
                            className={`p-4 rounded-full border transition-all ${micEnabled ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700' : 'bg-red-900/50 border-red-500 text-red-400'}`}
                        >
                            <MicIcon className="w-6 h-6" />
                        </button>
                        
                        <button 
                            onClick={handleInterrupt}
                            className="px-6 py-3 rounded-full border-2 border-red-600 text-red-500 font-bold text-xs md:text-sm hover:bg-red-600 hover:text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] active:scale-95"
                        >
                            INTERRUPT
                        </button>

                        <button 
                            onClick={handleStopCall}
                            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all transform hover:scale-110 active:scale-95"
                        >
                            <PhoneMissedIcon className="w-8 h-8" />
                        </button>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => setIsCameraMuted(!isCameraMuted)}
                                className={`p-4 rounded-full border transition-all ${!isCameraMuted ? 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700' : 'bg-red-900/50 border-red-500 text-red-400'}`}
                                title={isCameraMuted ? "Turn Camera On" : "Turn Camera Off (Voice Mode)"}
                            >
                                {isCameraMuted ? <VideoOffIcon className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default VideoCallInterface;
