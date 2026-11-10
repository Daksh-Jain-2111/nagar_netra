import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2, AlertTriangle, Mic } from 'lucide-react';
import { formatClock } from '../../hooks/useVoiceRecorder';

interface Props {
  src: string;
  /** Duration known from the server/recorder; used when the browser can't read it from the file. */
  fallbackDuration?: number;
  title?: string;
  subtitle?: string;
  errorLabel?: string;
  compact?: boolean;
}

/** Custom audio player around a real <audio> element (NagarNetra styling). */
export const VoiceNotePlayer: React.FC<Props> = ({ src, fallbackDuration, title, subtitle, errorLabel, compact }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(fallbackDuration || 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setState('loading');
    setDuration(fallbackDuration || 0);
  }, [src, fallbackDuration]);

  const syncDuration = () => {
    const d = audioRef.current?.duration;
    if (d && Number.isFinite(d) && d > 0) setDuration(d);
  };

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        setState('error');
      }
    } else {
      el.pause();
    }
  };

  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = value;
    setCurrent(value);
  };

  const progress = duration ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className={`rounded-xl border border-[#D6DFE8] bg-[#F4F7FA] ${compact ? 'p-2.5' : 'p-3'} space-y-2`}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => { syncDuration(); setState('ready'); }}
        onCanPlay={() => setState('ready')}
        onDurationChange={syncDuration}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onError={() => { setState('error'); setPlaying(false); }}
        className="hidden"
      />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={toggle}
          disabled={state === 'error'}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
          className="w-9 h-9 shrink-0 rounded-full bg-[#0B3D66] text-white flex items-center justify-center hover:bg-[#082d4d] disabled:bg-[#D6DFE8] disabled:text-[#566475] transition-colors"
        >
          {state === 'loading' && !playing ? <Loader2 className="w-4 h-4 animate-spin" />
            : playing ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.05}
            value={Math.min(current, duration || 0)}
            onChange={e => seek(Number(e.target.value))}
            disabled={!duration || state === 'error'}
            aria-label="Seek"
            className="w-full h-1.5 accent-[#E0681A] cursor-pointer"
            style={{ background: `linear-gradient(to right, #E0681A ${progress}%, #D6DFE8 ${progress}%)`, borderRadius: 999 }}
          />
        </div>
        <span className="text-[11px] font-mono font-bold text-[#0B3D66] shrink-0 tabular-nums">
          {formatClock(current)} / {formatClock(Math.round(duration))}
        </span>
        <button
          type="button"
          onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            el.muted = !muted;
            setMuted(!muted);
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="p-1 text-[#566475] hover:text-[#0B3D66] shrink-0"
        >
          {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        {!compact && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={e => {
              const v = Number(e.target.value);
              if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0; }
              setVolume(v);
              setMuted(v === 0);
            }}
            aria-label="Volume"
            className="w-16 h-1 accent-[#0B3D66] hidden sm:block"
          />
        )}
      </div>
      {(title || state === 'error') && (
        <div className="flex items-center gap-1.5 text-[10px]">
          {state === 'error' ? (
            <span className="flex items-center gap-1 text-[#B42318] font-semibold">
              <AlertTriangle className="w-3 h-3" />
              {errorLabel || 'Voice note could not be played.'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#566475] font-semibold">
              <Mic className="w-3 h-3 text-[#E0681A]" />
              {title}{subtitle ? ` · ${subtitle}` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
