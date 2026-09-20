import React, { useState, useRef, useEffect } from 'react';
import { Download, Play, Pause, RotateCcw, Loader2, Square, Check, Music, Volume2, VolumeX, Volume1, Volume } from 'lucide-react';
import { pcmUint8ToWavBlob, pcmUint8ToMp3Blob, downloadBlob } from '../services/geminiService';

interface AudioPlayerProps {
  audioUrl: string | null; // WAV URL
  audioPcmData: Uint8Array | null; // For MP3 conversion
  textSnippet?: string;
  isPlaying: boolean;
  isBuffering: boolean;
  isLongBuffering?: boolean;
  playbackRate: number;
  volume: number;
  audioEngine?: 'gemini' | 'native';
  audioNotice?: string | null;
  filename?: string;
  isPreparingAudio?: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  onStop: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onVolumeChange: (volume: number) => void;
  onDownloadAudio?: (format: 'wav' | 'mp3') => Promise<void> | void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
    audioUrl, 
    audioPcmData,
    isPlaying, 
    isBuffering,
    isLongBuffering = false,
    playbackRate,
    volume,
    audioEngine = 'gemini',
    audioNotice = null,
    filename = 'my-reader-audio',
    isPreparingAudio = false,
    onTogglePlay, 
    onRestart,
    onStop,
    onPlaybackRateChange,
    onVolumeChange,
    onDownloadAudio
}) => {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isConvertingMp3, setIsConvertingMp3] = useState(false);
  const [isDownloadingWav, setIsDownloadingWav] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const handleDownloadMp3 = async () => {
    if (onDownloadAudio) {
      setIsConvertingMp3(true);
      try {
        await onDownloadAudio('mp3');
      } finally {
        setIsConvertingMp3(false);
      }
      return;
    }

    if (!audioPcmData) return;
    setIsConvertingMp3(true);
    
    // Defer to next tick to allow UI to show loading state
    setTimeout(() => {
        try {
            const blob = pcmUint8ToMp3Blob(audioPcmData);
            downloadBlob(blob, `${filename}.mp3`);
        } catch (e) {
            alert("Failed to convert to MP3. Please download as WAV instead.");
            console.error(e);
        } finally {
            setIsConvertingMp3(false);
        }
    }, 50);
  };

  const handleDownloadWav = async () => {
    if (onDownloadAudio) {
      setIsDownloadingWav(true);
      try {
        await onDownloadAudio('wav');
      } finally {
        setIsDownloadingWav(false);
      }
      return;
    }

    if (!audioPcmData && !audioUrl) return;
    setIsDownloadingWav(true);

    try {
      if (audioPcmData) {
        const blob = pcmUint8ToWavBlob(audioPcmData);
        downloadBlob(blob, `${filename}.wav`);
      } else if (audioUrl) {
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `${filename}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      alert("Failed to download WAV audio.");
      console.error(e);
    } finally {
      setIsDownloadingWav(false);
    }
  };

  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX size={20} />;
    if (volume < 0.3) return <Volume size={20} />;
    if (volume < 0.7) return <Volume1 size={20} />;
    return <Volume2 size={20} className={volume > 1 ? "text-indigo-600 dark:text-indigo-400 drop-shadow-sm" : ""} />;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
      {/* Background Gradient & Blur */}
      <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"></div>
      
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        
        {/* Left: Status */}
        <div className="hidden sm:flex items-center gap-3 w-1/4">
             {isBuffering ? (
                 <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 animate-pulse">
                     <Loader2 size={18} className="animate-spin" />
                     <span className="text-sm font-medium">
                        {isLongBuffering ? "Warming up AI..." : "Buffering..."}
                     </span>
                 </div>
             ) : (
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isPlaying 
                            ? (audioEngine === 'native' ? 'bg-amber-500 animate-pulse' : 'bg-green-500 animate-pulse') 
                            : 'bg-slate-300 dark:bg-slate-600'
                        }`}></div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                          {isPlaying 
                            ? (audioEngine === 'native' ? 'Browser Speech' : 'Gemini AI Voice') 
                            : 'Paused'}
                        </span>
                    </div>
                    {audioNotice && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium truncate max-w-[210px] mt-0.5" title={audioNotice}>
                        {audioNotice}
                      </span>
                    )}
                </div>
             )}
        </div>

        {/* Center: Controls */}
        <div className="flex-1 flex items-center justify-center gap-4 sm:gap-6">
            
            {/* Volume Control */}
            <div className="flex items-center gap-2 group mr-2 relative">
                <button 
                    onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}
                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                    title={volume === 0 ? "Unmute" : volume > 1 ? "Volume Boosted" : "Mute"}
                >
                    {getVolumeIcon()}
                </button>
                
                {/* Expanded Slider for better visibility */}
                <div className="w-0 sm:w-24 overflow-hidden group-hover:w-32 sm:group-hover:w-32 transition-all duration-300 ease-out flex items-center relative">
                    <input 
                        type="range" 
                        min="0" 
                        max="3" 
                        step="0.1"
                        value={volume}
                        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400"
                    />
                    {/* Tooltip for volume % */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {Math.round(volume * 100)}%
                    </div>
                </div>
            </div>

             <button 
                onClick={onRestart}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
                title="Restart"
             >
                <RotateCcw size={20} />
             </button>

             <button 
                onClick={onTogglePlay}
                disabled={isBuffering}
                className={`
                    w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95
                    ${isBuffering 
                        ? 'bg-indigo-300 dark:bg-indigo-900/50 cursor-not-allowed' 
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
                `}
             >
                {isBuffering ? (
                    <Loader2 size={24} className="animate-spin" />
                ) : isPlaying ? (
                    <Pause size={24} fill="currentColor" />
                ) : (
                    <Play size={24} fill="currentColor" className="ml-1" />
                )}
             </button>
             
             <button 
                onClick={onStop}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all"
                title="Stop"
             >
                <Square size={20} fill="currentColor" />
             </button>

             <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4 ml-2">
                 <button 
                    onClick={handleDownloadMp3}
                    disabled={isConvertingMp3 || (isPreparingAudio && !isDownloadingWav) || (!audioPcmData && !onDownloadAudio)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-600 dark:hover:bg-indigo-700 hover:text-white transition-colors text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    title={audioPcmData ? "Download MP3 Audio" : "Generate & download MP3"}
                >
                    {isConvertingMp3 || (isPreparingAudio && !isDownloadingWav) ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />}
                    <span>MP3</span>
                </button>

                <button 
                    onClick={handleDownloadWav}
                    disabled={isDownloadingWav || (isPreparingAudio && !isConvertingMp3) || (!audioPcmData && !audioUrl && !onDownloadAudio)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-indigo-700 dark:hover:text-indigo-400 transition-colors text-xs font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    title={audioPcmData || audioUrl ? "Download WAV Audio" : "Generate & download WAV"}
                >
                    {isDownloadingWav || (isPreparingAudio && !isConvertingMp3) ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    <span>WAV</span>
                </button>
             </div>

             {/* Speed Control */}
             <div className="relative border-l border-slate-200 dark:border-slate-700 pl-4 ml-2" ref={menuRef}>
                <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="flex items-center justify-center w-10 h-10 rounded-full text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all font-bold text-xs tracking-tight"
                    title="Playback Speed"
                >
                    {playbackRate}x
                </button>

                {showSpeedMenu && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-24 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden py-1">
                        {speeds.map((rate) => (
                            <button
                                key={rate}
                                onClick={() => {
                                    onPlaybackRateChange(rate);
                                    setShowSpeedMenu(false);
                                }}
                                className={`
                                    w-full px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
                                    ${playbackRate === rate ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}
                                `}
                            >
                                <span>{rate}x</span>
                                {playbackRate === rate && <Check size={12} />}
                            </button>
                        ))}
                    </div>
                )}
             </div>
        </div>

        {/* Right: Empty placeholder to keep center aligned */}
        <div className="hidden sm:block w-1/4"></div>
      </div>
    </div>
  );
};

export default AudioPlayer;