'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Canvas } from '@react-three/fiber';
import {
  Users,
  Heart,
  Sparkles,
  PartyPopper,
  Hand,
  Volume2,
  VolumeX,
  FileText,
  X,
  Camera,
  Bot,
  Palette,
  Sun,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GiftData, PhotoItem, PlayerState, EmoteEvent, ThemeType } from '@/lib/types';
import { VirtualJoystick } from '@/components/ui/VirtualJoystick';

const COLOR_OPTIONS = [
  { name: 'Rose Coral', hex: '#f43f5e' },
  { name: 'Sky Blue', hex: '#38bdf8' },
  { name: 'Emerald Mint', hex: '#10b981' },
  { name: 'Purple Violet', hex: '#a855f7' },
  { name: 'Warm Amber', hex: '#f59e0b' },
  { name: 'Radiant Pink', hex: '#ec4899' },
  { name: 'Sunset Orange', hex: '#f97316' },
];

// Dynamically import Three.js scene to avoid SSR canvas issues
const MuseumScene = dynamic(
  () => import('@/components/canvas/MuseumScene').then((mod) => mod.MuseumScene),
  { ssr: false }
);

interface GiftPageProps {
  params: { id: string };
}

export default function GiftViewerPage({ params }: GiftPageProps) {
  const { id } = params;

  // State
  const [gift, setGift] = useState<GiftData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [isLetterOpen, setIsLetterOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joystickInput, setJoystickInput] = useState({ x: 0, y: 0 });

  // Camera, Outfit Color, Theme & Companion Controls
  const [cameraMode, setCameraMode] = useState<'first-person' | 'third-person'>('third-person');
  const [showCompanion, setShowCompanion] = useState(true);
  const [myColor, setMyColor] = useState<string>('#f472b6'); // Pink Girl outfit
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [activeTheme, setActiveTheme] = useState<ThemeType>('museum');

  // Multiplayer State
  const [peers, setPeers] = useState<PlayerState[]>([]);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [emotes, setEmotes] = useState<EmoteEvent[]>([]);
  const myPlayerId = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentPos = useRef<[number, number, number]>([0, 0, 6]);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Fetch Gift Data
  useEffect(() => {
    async function fetchGift() {
      try {
        const res = await fetch(`/api/gift/${id}`);
        if (!res.ok) {
          throw new Error('Gift not found or expired.');
        }
        const data = await res.json();
        setGift(data);
        if (data.theme) {
          setActiveTheme(data.theme);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load gift';
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    }
    fetchGift();
  }, [id]);

  // WebSocket Connection
  useEffect(() => {
    if (!hasEntered || !gift) return;

    const envWsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname;
    const wsPort = window.location.port ? `:${window.location.port}` : '';
    // If in local Next dev (port 3000), use standalone ws-server port 3001; on Render/prod, use same domain
    const wsUrl = envWsUrl || (wsPort === ':3000' ? `${wsProtocol}//${wsHost}:3001` : `${wsProtocol}//${wsHost}${wsPort}`);

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: 'join',
            roomId: gift.id,
            name: gift.recipientName || 'Visitor',
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'welcome') {
            myPlayerId.current = msg.playerId;
            setMyColor(msg.color || '#38bdf8');
            setPeers(msg.peers || []);
            setOnlineCount(msg.totalOnline || 1);
          }

          if (msg.type === 'peer_joined') {
            setPeers((prev) => {
              const filtered = prev.filter((p) => p.id !== msg.player.id);
              return [...filtered, msg.player];
            });
            setOnlineCount(msg.totalOnline || 1);
          }

          if (msg.type === 'peer_moved') {
            setPeers((prev) =>
              prev.map((p) =>
                p.id === msg.playerId
                  ? {
                      ...p,
                      position: msg.position,
                      rotation: msg.rotation,
                      action: msg.action,
                      lastUpdated: Date.now(),
                    }
                  : p
              )
            );
          }

          if (msg.type === 'peer_emote') {
            setEmotes((prev) => [
              ...prev.slice(-10),
              {
                playerId: msg.playerId,
                type: msg.emote,
                position: msg.position || [0, 1, 0],
                timestamp: Date.now(),
              },
            ]);

            if (msg.emote === 'confetti') {
              confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
            }
          }

          if (msg.type === 'peer_left') {
            setPeers((prev) => prev.filter((p) => p.id !== msg.playerId));
            setOnlineCount(msg.totalOnline || 1);
          }
        } catch (err) {
          console.error('WS message error:', err);
        }
      };

      socket.onerror = (err) => {
        console.warn('Multiplayer socket unavailable, running in standalone mode:', err);
      };
    } catch (e) {
      console.warn('Could not connect to multiplayer WS server:', e);
    }

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [hasEntered, gift]);

  // Player position update handler
  const handlePlayerMove = useCallback(
    (
      pos: [number, number, number],
      rot: [number, number, number],
      action: 'idle' | 'walking' | 'jumping'
    ) => {
      currentPos.current = pos;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'move',
            position: pos,
            rotation: rot,
            action,
          })
        );
      }
    },
    []
  );

  // Send Emote
  const sendEmote = (type: 'heart' | 'confetti' | 'clap' | 'wave' | 'sparkles') => {
    if (type === 'confetti') {
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.8 } });
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'emote',
          emote: type,
          position: currentPos.current,
        })
      );
    } else {
      setEmotes((prev) => [
        ...prev.slice(-10),
        {
          playerId: 'local',
          type,
          position: currentPos.current,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const handleCompanionEmote = (
    type: 'heart' | 'confetti' | 'sparkles',
    position: [number, number, number]
  ) => {
    setEmotes((prev) => [
      ...prev.slice(-10),
      {
        playerId: 'companion',
        type,
        position,
        timestamp: Date.now(),
      },
    ]);
  };

  const toggleCameraMode = () => {
    setCameraMode((prev) => (prev === 'third-person' ? 'first-person' : 'third-person'));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
        <p className="text-sm font-medium tracking-wide text-slate-400">Opening 3D Exhibition...</p>
      </div>
    );
  }

  if (error || !gift) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center space-y-4">
        <h2 className="text-2xl font-bold text-rose-400">Gift Unavailable</h2>
        <p className="text-slate-400 max-w-md text-sm">{error || 'This gift link does not exist.'}</p>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* 3D WebGL Canvas with High-DPI and Antialiasing for Crystal Clear Photos */}
      {hasEntered && (
        <Canvas
          shadows
          dpr={[1, 2]} // Crisp rendering on Retina & mobile screens
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
          }}
          camera={{ position: [0, 1.8, 6], fov: 60, near: 0.1, far: 100 }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <MuseumScene
            photos={gift.photos}
            peers={peers}
            emotes={emotes}
            theme={activeTheme}
            onSelectPhoto={(photo) => setSelectedPhoto(photo)}
            onPlayerMove={handlePlayerMove}
            joystickInput={joystickInput}
            isTouchDevice={isTouchDevice}
            cameraMode={cameraMode}
            onToggleCameraMode={toggleCameraMode}
            myColor={myColor}
            myName={gift.recipientName || 'You'}
            showCompanion={showCompanion}
            companionName={gift.creatorName || 'Sophia'}
            onCompanionEmote={handleCompanionEmote}
          />
        </Canvas>
      )}

      {/* ================= WELCOME ENVELOPE GATE MODAL ================= */}
      {!hasEntered && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fadeIn">
          <div className="max-w-md w-full bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Wax Seal Icon */}
            <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center shadow-xl shadow-amber-600/30 ring-4 ring-amber-500/20">
              <Heart className="w-8 h-8 text-white fill-white" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Special Delivery
              </span>
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{gift.title}</h2>
              <p className="text-xs text-slate-400">
                Dedicated to <span className="text-amber-300 font-semibold">{gift.recipientName}</span> from{' '}
                <span className="text-slate-200">{gift.creatorName}</span>
              </p>
            </div>

            {/* Letter Preview Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 text-left text-xs text-slate-300 max-h-48 overflow-y-auto leading-relaxed shadow-inner font-serif italic">
              {gift.message}
            </div>

            {/* Enter Button */}
            <button
              onClick={() => {
                setHasEntered(true);
                confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
              }}
              className="w-full bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-extrabold py-4 rounded-2xl shadow-xl shadow-amber-500/30 hover:opacity-95 transition-all text-sm tracking-wide"
            >
              Enter 3D Experience
            </button>
            <p className="text-[11px] text-slate-500">
              {isTouchDevice ? 'Virtual joypad on screen' : 'WASD to walk • Mouse to look • V to toggle 3rd/1st person'}
            </p>
          </div>
        </div>
      )}

      {/* ================= IN-GAME HUD OVERLAY ================= */}
      {hasEntered && (
        <>
          {/* Top-Left: Multiplayer Presence Counter */}
          <div className="absolute top-5 left-5 z-40 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-full px-4 py-2 flex items-center space-x-2.5 shadow-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <Users className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-200">
              {onlineCount + (showCompanion ? 1 : 0)} characters exploring
            </span>
          </div>

          {/* Top-Right: Camera Mode, Companion Toggle, Letter & Audio */}
          <div className="absolute top-5 right-5 z-40 flex items-center space-x-2">
            {/* Camera View Toggle */}
            <button
              onClick={toggleCameraMode}
              title="Toggle Camera View (or press V)"
              className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 rounded-full px-3 py-2 text-xs font-medium text-slate-300 flex items-center space-x-1.5 shadow-lg transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>{cameraMode === 'third-person' ? '3rd Person' : '1st Person'}</span>
            </button>

            {/* Live 3D Theme Switcher */}
            <button
              onClick={() => {
                const cycle: Record<ThemeType, ThemeType> = {
                  museum: 'sunset',
                  sunset: 'loft',
                  loft: 'museum',
                };
                setActiveTheme(cycle[activeTheme] || 'museum');
              }}
              title="Switch 3D Environment Theme"
              className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 rounded-full px-3.5 py-2 text-xs font-medium text-amber-300 flex items-center space-x-1.5 shadow-lg transition-colors"
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="capitalize">{activeTheme} Theme</span>
            </button>

            {/* Character Outfit Color Swapper */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                title="Swap Character Outfit Color"
                className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 rounded-full px-3 py-2 text-xs font-medium text-slate-300 flex items-center space-x-2 shadow-lg transition-colors"
              >
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span
                  className="w-3 h-3 rounded-full ring-2 ring-white/50 shadow-sm"
                  style={{ backgroundColor: myColor }}
                />
                <span className="hidden sm:inline">Color</span>
              </button>

              {showColorPicker && (
                <div className="absolute top-12 right-0 bg-slate-900/95 border border-slate-700 p-2.5 rounded-2xl shadow-2xl flex items-center space-x-2 backdrop-blur-lg animate-fadeIn z-50">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        setMyColor(c.hex);
                        setShowColorPicker(false);
                      }}
                      title={c.name}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-125 ${
                        myColor === c.hex ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Companion Toggle */}
            <button
              onClick={() => setShowCompanion(!showCompanion)}
              title="Toggle AI Companion Bot"
              className={`backdrop-blur-md border rounded-full px-3 py-2 text-xs font-medium flex items-center space-x-1.5 shadow-lg transition-colors ${
                showCompanion
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-white'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guide Bot</span>
            </button>

            {/* Read Letter Modal */}
            <button
              onClick={() => setIsLetterOpen(true)}
              className="bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 rounded-full px-3.5 py-2 text-xs font-medium text-amber-400 flex items-center space-x-2 shadow-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Letter</span>
            </button>

            {/* Audio Toggle */}
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className="w-9 h-9 rounded-full bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 flex items-center justify-center text-slate-300 transition-colors shadow-lg"
            >
              {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Bottom-Left: Virtual Joystick on Mobile */}
          {isTouchDevice && (
            <div className="absolute bottom-6 left-6 z-40">
              <VirtualJoystick onChange={(v) => setJoystickInput(v)} />
            </div>
          )}

          {/* Bottom Controls Helper (Desktop) */}
          {!isTouchDevice && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 bg-slate-900/70 backdrop-blur-md border border-slate-800 text-slate-400 text-xs px-4 py-1.5 rounded-full pointer-events-none shadow-md flex items-center space-x-3">
              <span>[W,A,S,D] walk</span>
              <span>•</span>
              <span>[Space] jump</span>
              <span>•</span>
              <span>[V] toggle 3rd/1st person</span>
              <span>•</span>
              <span>Click artwork to inspect</span>
            </div>
          )}

          {/* Bottom-Right: 3D Emote Reactions Wheel */}
          <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end space-y-2">
            <div className="flex items-center space-x-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-full p-1.5 shadow-xl">
              <button
                onClick={() => sendEmote('heart')}
                title="Send Heart Emote"
                className="w-10 h-10 rounded-full bg-rose-500/20 hover:bg-rose-500/30 flex items-center justify-center text-rose-400 transition-transform active:scale-90"
              >
                <Heart className="w-5 h-5 fill-rose-500" />
              </button>
              <button
                onClick={() => sendEmote('confetti')}
                title="Celebrate with Confetti"
                className="w-10 h-10 rounded-full bg-amber-500/20 hover:bg-amber-500/30 flex items-center justify-center text-amber-400 transition-transform active:scale-90"
              >
                <PartyPopper className="w-5 h-5" />
              </button>
              <button
                onClick={() => sendEmote('sparkles')}
                title="Sparkles"
                className="w-10 h-10 rounded-full bg-purple-500/20 hover:bg-purple-500/30 flex items-center justify-center text-purple-400 transition-transform active:scale-90"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              <button
                onClick={() => sendEmote('wave')}
                title="Wave"
                className="w-10 h-10 rounded-full bg-sky-500/20 hover:bg-sky-500/30 flex items-center justify-center text-sky-400 transition-transform active:scale-90"
              >
                <Hand className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ================= FULL LETTER OVERLAY MODAL ================= */}
      {isLetterOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl p-7 shadow-2xl relative space-y-4">
            <button
              onClick={() => setIsLetterOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-amber-400 font-serif">Dedication Letter</h3>
            <div className="text-sm text-slate-200 leading-relaxed font-serif whitespace-pre-wrap max-h-[60vh] overflow-y-auto pr-2">
              {gift.message}
            </div>

            <div className="pt-2 text-right text-xs text-slate-400">
              — With love, <span className="font-semibold text-white">{gift.creatorName}</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= PHOTO INSPECTION ZOOM MODAL ================= */}
      {selectedPhoto && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-6 animate-fadeIn">
          <div className="max-w-xl w-full bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 bg-black/60 text-white p-2 rounded-full hover:bg-black/90 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-full max-h-[60vh] overflow-hidden bg-black flex items-center justify-center">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.title}
                className="w-full h-auto max-h-[60vh] object-contain"
              />
            </div>

            <div className="p-6 space-y-2 bg-gradient-to-t from-slate-950 to-slate-900">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-bold text-white">{selectedPhoto.title}</h4>
                {selectedPhoto.date && (
                  <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    {selectedPhoto.date}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{selectedPhoto.caption}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
