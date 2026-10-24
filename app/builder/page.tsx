'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Copy,
  ExternalLink,
  Eye,
  Layers,
  Calendar,
} from 'lucide-react';
import { PhotoItem, ThemeType } from '@/lib/types';

const SAMPLE_PRESETS: PhotoItem[] = [
  {
    id: 's1',
    url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
    title: 'Golden Hour In Venice',
    caption: 'The afternoon we got completely lost and found that hidden espresso bar.',
    date: 'June 2023',
    orderIndex: 0,
  },
  {
    id: 's2',
    url: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
    title: 'Under the Starlit Ridge',
    caption: 'Freezing cold mountain air, hot cocoa in thermoses, and infinite shooting stars.',
    date: 'September 2023',
    orderIndex: 1,
  },
  {
    id: 's3',
    url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80',
    title: 'Midnight Carnival Lights',
    caption: 'You insisted we ride the ferris wheel three times just to see the city lights.',
    date: 'December 2023',
    orderIndex: 2,
  },
  {
    id: 's4',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    title: 'First Dip In The Pacific',
    caption: 'Salty ocean air, sunscreen, and laughing until our stomachs hurt.',
    date: 'March 2024',
    orderIndex: 3,
  },
  {
    id: 's5',
    url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
    title: 'The Rainstorm Rooftop',
    caption: 'Dancing in the torrential downpour while everyone else ran for shelter.',
    date: 'May 2024',
    orderIndex: 4,
  },
  {
    id: 's6',
    url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
    title: 'Roadtrip Highway 1',
    caption: 'Singing 80s rock songs with windows down and ocean cliffs on our right.',
    date: 'August 2024',
    orderIndex: 5,
  },
];

export default function BuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);

  // Form State
  const [title, setTitle] = useState('Our Unforgettable Chapters');
  const [recipientName, setRecipientName] = useState('Sarah');
  const [creatorName, setCreatorName] = useState('Alex');
  const [theme, setTheme] = useState<ThemeType>('museum');
  const [photos, setPhotos] = useState<PhotoItem[]>(SAMPLE_PRESETS);
  const [message, setMessage] = useState(
    'I gathered some of our most special memories together in this 3D exhibition. Walk through the gallery and look around!'
  );
  const [originalDraft, setOriginalDraft] = useState('');
  const [aiTone, setAiTone] = useState<'heartfelt' | 'romantic' | 'nostalgic' | 'playful' | 'poetic'>('heartfelt');
  const [isPolishing, setIsPolishing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // File Upload Handler with Instant Local Preview and Permanent Dynamic Serving
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);

    const fileList = Array.from(e.target.files);

    // 1. Instant local thumbnail preview so images appear immediately
    const tempItems: PhotoItem[] = fileList.map((file, idx) => ({
      id: 'u_' + Math.random().toString(36).substring(2, 9),
      url: URL.createObjectURL(file),
      title: file.name.replace(/\.[^/.]+$/, '').substring(0, 30) || `Memory #${photos.length + idx + 1}`,
      caption: 'Add a special caption for this moment...',
      date: new Date().getFullYear().toString(),
      orderIndex: photos.length + idx,
    }));

    setPhotos((prev) => [...prev, ...tempItems]);

    try {
      const formData = new FormData();
      for (const file of fileList) {
        formData.append('file', file);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.urls && data.urls.length > 0) {
        // Update temp blob URLs with permanent server URLs
        setPhotos((prev) =>
          prev.map((photo) => {
            const tempIndex = tempItems.findIndex((t) => t.id === photo.id);
            if (tempIndex !== -1 && data.urls[tempIndex]) {
              return {
                ...photo,
                url: data.urls[tempIndex],
              };
            }
            return photo;
          })
        );
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Could not upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePhoto = (id: string, field: keyof PhotoItem, value: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // AI Polish Handler
  const handleAiPolish = async () => {
    if (!message.trim()) return;
    setIsPolishing(true);
    setOriginalDraft(message);

    try {
      const res = await fetch('/api/ai-writer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: message,
          tone: aiTone,
          recipientName,
        }),
      });

      const data = await res.json();
      if (data.polished) {
        setMessage(data.polished);
      }
    } catch (err) {
      console.error('AI polish error:', err);
    } finally {
      setIsPolishing(false);
    }
  };

  // Publish Gift
  const handlePublish = async () => {
    if (!title || !message || photos.length === 0) {
      alert('Please fill out all steps and include at least one photo.');
      return;
    }

    setIsPublishing(true);

    try {
      const res = await fetch('/api/gift/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          recipientName,
          creatorName,
          theme,
          photos,
          message,
        }),
      });

      const data = await res.json();
      if (data.success && data.id) {
        const fullUrl = `${window.location.origin}/gift/${data.id}`;
        setPublishedUrl(fullUrl);
      } else {
        alert(data.error || 'Failed to generate gift link.');
      }
    } catch (err) {
      console.error('Publishing failed:', err);
      alert('Error publishing gift. Please check server connection.');
    } finally {
      setIsPublishing(false);
    }
  };

  const copyToClipboard = () => {
    if (!publishedUrl) return;
    navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push('/')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-amber-400 to-rose-400 bg-clip-text text-transparent">
              Giftvera Studio
            </h1>
            <p className="text-xs text-slate-400">3D Interactive Gift Creator</p>
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="hidden md:flex items-center space-x-2 text-sm font-medium">
          {[
            { num: 1, label: 'Theme & Names' },
            { num: 2, label: 'Photo Gallery' },
            { num: 3, label: 'Letter & AI Polish' },
            { num: 4, label: 'Publish & Share' },
          ].map((item) => (
            <React.Fragment key={item.num}>
              <div
                onClick={() => setStep(item.num)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                  step === item.num
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : step > item.num
                    ? 'text-emerald-400 hover:bg-slate-800'
                    : 'text-slate-500 hover:bg-slate-800/50'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                    step === item.num
                      ? 'bg-amber-500 text-slate-950'
                      : step > item.num
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.num}
                </span>
                <span>{item.label}</span>
              </div>
              {item.num < 4 && <div className="w-4 h-[1px] bg-slate-800" />}
            </React.Fragment>
          ))}
        </div>

        {/* Quick Preview Action */}
        <button
          onClick={() => router.push('/gift/demo')}
          className="flex items-center space-x-2 text-xs text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 px-3 py-2 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View Sample Museum</span>
        </button>
      </header>

      {/* Main Studio Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-10 flex flex-col justify-center">
        {/* STEP 1: THEME & OCCASION */}
        {step === 1 && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white">Choose Theme & Dedication</h2>
              <p className="text-slate-400 mt-1">
                Customize who this 3D exhibition is for and pick an architectural atmosphere.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  id: 'museum',
                  name: '3D Modernist Museum',
                  desc: 'Polished oak floors, warm gallery spotlights, and twilight horizon glass wall.',
                  badge: 'Flagship & Most Popular',
                  accent: 'from-amber-500/20 to-orange-500/10 border-amber-500/50',
                },
                {
                  id: 'sunset',
                  name: 'Sunset Ocean Pavilion',
                  desc: 'Open-air wooden deck over gentle waters with golden-hour sunset lighting.',
                  badge: 'Romantic & Serene',
                  accent: 'from-rose-500/20 to-purple-500/10 border-rose-500/30',
                },
                {
                  id: 'loft',
                  name: 'Cozy Industrial Loft',
                  desc: 'Warm exposed brick, floating brass pedestals, and glowing night ambiance.',
                  badge: 'Chic & Intimate',
                  accent: 'from-indigo-500/20 to-blue-500/10 border-indigo-500/30',
                },
              ].map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTheme(t.id as ThemeType)}
                  className={`p-5 rounded-2xl border cursor-pointer transition-all bg-gradient-to-b relative ${
                    theme === t.id
                      ? `${t.accent} ring-2 ring-amber-500/50 shadow-xl`
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-semibold px-2 py-0.5 rounded-full inline-block bg-white/10 text-slate-300 mb-3">
                    {t.badge}
                  </div>
                  <h3 className="font-bold text-lg text-white mb-1">{t.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900/60 p-6 rounded-2xl border border-slate-800/80">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Exhibition Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Our Greatest Adventures, Sarah's 30th Birthday"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Sarah"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    placeholder="Alex"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStep(2)}
                className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold px-6 py-3 rounded-xl hover:opacity-90 shadow-lg shadow-amber-500/25 transition-all"
              >
                <span>Continue to Photo Gallery</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PHOTO CURATOR */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">Curate 3D Gallery Frames</h2>
                <p className="text-slate-400 mt-1">
                  Upload 6–10 photos. Each will hang in the museum with custom plaque captions.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-colors shadow-lg shadow-amber-500/20">
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading...' : 'Upload Photos'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Photo List Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex gap-4 items-start relative group hover:border-slate-700 transition-all"
                >
                  {/* Photo Preview Thumbnail */}
                  <div className="w-24 h-28 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-700/60 relative">
                    <img
                      src={photo.url}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Metadata Inputs */}
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={photo.title}
                      onChange={(e) => updatePhoto(photo.id, 'title', e.target.value)}
                      placeholder="Frame Title (e.g. Venice Sunset)"
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <textarea
                      value={photo.caption}
                      onChange={(e) => updatePhoto(photo.id, 'caption', e.target.value)}
                      placeholder="Story or caption on the museum plaque..."
                      rows={2}
                      className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={photo.date || ''}
                        onChange={(e) => updatePhoto(photo.id, 'date', e.target.value)}
                        placeholder="Date (e.g. June 2023)"
                        className="bg-slate-950/80 border border-slate-800 rounded-md px-2 py-0.5 text-xs text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="flex items-center space-x-2 text-slate-400 hover:text-white px-4 py-2 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                onClick={() => setStep(3)}
                className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold px-6 py-3 rounded-xl hover:opacity-90 shadow-lg shadow-amber-500/25 transition-all"
              >
                <span>Continue to Letter & AI</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: LETTER & AI POLISH */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white">Write Dedication Letter</h2>
              <p className="text-slate-400 mt-1">
                This heartfelt message is presented inside an animated envelope before they enter the 3D world.
              </p>
            </div>

            {/* AI Control Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                <span className="text-sm font-semibold text-slate-200">AI Writing Companion:</span>
                <select
                  value={aiTone}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setAiTone(e.target.value as 'heartfelt' | 'romantic' | 'nostalgic' | 'playful' | 'poetic')
                  }
                  className="bg-slate-950 border border-slate-700 text-amber-400 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none"
                >
                  <option value="heartfelt">Heartfelt & Deep</option>
                  <option value="romantic">Romantic & Sweet</option>
                  <option value="nostalgic">Nostalgic & Reflective</option>
                  <option value="playful">Playful & Funny</option>
                  <option value="poetic">Poetic & Artistic</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                {originalDraft && (
                  <button
                    onClick={() => {
                      setMessage(originalDraft);
                      setOriginalDraft('');
                    }}
                    className="text-xs text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 rounded-lg transition-colors"
                  >
                    Revert to Original
                  </button>
                )}

                <button
                  onClick={handleAiPolish}
                  disabled={isPolishing}
                  className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg hover:opacity-90 transition-all disabled:opacity-50 shadow-md shadow-amber-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isPolishing ? 'Polishing Draft...' : 'AI Polish & Enhance'}</span>
                </button>
              </div>
            </div>

            {/* Message Textarea */}
            <div className="relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={10}
                placeholder="Type your personal letter, inside jokes, or memories here..."
                className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-5 text-slate-100 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500 text-base shadow-inner resize-none"
              />
              <div className="absolute bottom-4 right-4 text-xs text-slate-500">
                {message.length} characters
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setStep(2)}
                className="flex items-center space-x-2 text-slate-400 hover:text-white px-4 py-2 rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                onClick={() => setStep(4)}
                className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold px-6 py-3 rounded-xl hover:opacity-90 shadow-lg shadow-amber-500/25 transition-all"
              >
                <span>Review & Publish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & PUBLISH */}
        {step === 4 && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white">Generate Your 3D Gift</h2>
              <p className="text-slate-400 mt-1">
                Your exhibition is configured and ready. Click publish to create your unique unindexed link.
              </p>
            </div>

            {/* Exhibition Summary Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{title}</h3>
                  <p className="text-xs text-slate-400">
                    For <span className="text-amber-400 font-semibold">{recipientName}</span> from{' '}
                    <span className="text-slate-200">{creatorName}</span>
                  </p>
                </div>
                <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-semibold uppercase">
                  {theme} theme
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="block text-slate-500">Wall Frames</span>
                  <span className="text-lg font-bold text-white">{photos.length} Photos</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="block text-slate-500">Real-Time Room</span>
                  <span className="text-lg font-bold text-emerald-400">Multiplayer Enabled</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="block text-slate-500">Controls</span>
                  <span className="text-lg font-bold text-white">WASD + Mobile Joypad</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="block text-slate-500">Privacy</span>
                  <span className="text-lg font-bold text-white">Unindexed / Secret</span>
                </div>
              </div>
            </div>

            {/* Generated Link Box */}
            {publishedUrl ? (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-6 space-y-4 animate-scaleUp">
                <div className="flex items-center space-x-3 text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                  <h4 className="font-bold text-lg">Your 3D Exhibition Is Live!</h4>
                </div>
                <p className="text-xs text-slate-300">
                  Send this link to {recipientName}. Up to 4 people opening the link will enter the same 3D room simultaneously:
                </p>

                <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
                  <input
                    type="text"
                    readOnly
                    value={publishedUrl}
                    className="flex-1 bg-transparent px-3 text-sm text-amber-300 font-mono outline-none select-all"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center space-x-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-all text-sm shadow-lg shadow-amber-500/20"
                  >
                    <span>Open 3D Museum Now</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center space-x-2 text-slate-400 hover:text-white px-4 py-2 rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="flex items-center space-x-2 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-extrabold px-8 py-3.5 rounded-xl hover:opacity-95 shadow-xl shadow-amber-500/30 transition-all text-base disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>{isPublishing ? 'Publishing Exhibition...' : 'Publish 3D Gift'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
