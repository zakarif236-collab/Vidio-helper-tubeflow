import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─────────────────────────────────────────────────────────────
   LoadingMiniGame
   Drop-in replacement for any loading placeholder.
   Usage:  {loading && <LoadingMiniGame message="Generating…" color="purple" />}
───────────────────────────────────────────────────────────── */
interface LoadingMiniGameProps {
  /** Short label shown next to the pulsing dot */
  message?: string;
  /**
   * Tailwind colour key that drives the progress-bar gradient.
   * Supported: 'purple' | 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'rose' | 'emerald'
   */
  color?: 'purple' | 'blue' | 'yellow' | 'green' | 'red' | 'orange' | 'rose' | 'emerald';
}

const GRADIENTS: Record<string, string> = {
  purple:  'from-purple-500 via-violet-500 to-fuchsia-500',
  blue:    'from-blue-500 via-cyan-500 to-indigo-500',
  yellow:  'from-yellow-500 via-amber-500 to-orange-400',
  green:   'from-green-500 via-emerald-500 to-teal-500',
  red:     'from-red-500 via-rose-500 to-pink-500',
  orange:  'from-orange-500 via-amber-500 to-yellow-400',
  rose:    'from-rose-500 via-pink-500 to-fuchsia-500',
  emerald: 'from-emerald-400 via-green-500 to-teal-500',
};

const DOT_COLORS = ['#a855f7','#3b82f6','#f59e0b','#10b981','#ef4444','#ec4899','#06b6d4','#84cc16'];
const DOT_EMOJIS = ['🎯','⭐','💎','🔥','💫','✨','🎮','🏆','🍕','🚀','🦊','🌈'];

interface Splat { id: number; x: number; y: number; size: number; color: string; emoji: string; }

export const LoadingMiniGame: React.FC<LoadingMiniGameProps> = ({
  message = 'Processing…',
  color = 'purple',
}) => {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState<Splat[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const dotIdRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* --- progress simulation --- */
  useEffect(() => {
    let current = 0;
    progressTimerRef.current = setInterval(() => {
      const step = current < 30 ? 3 : current < 60 ? 1.8 : current < 85 ? 0.7 : 0.15;
      current = Math.min(93, current + step);
      setProgress(Math.round(current));
    }, 350);
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  /* --- dot spawning --- */
  useEffect(() => {
    dotTimerRef.current = setInterval(() => {
      const id = ++dotIdRef.current;
      const newDot: Splat = {
        id,
        x: 4 + Math.random() * 88,
        y: 4 + Math.random() * 88,
        size: 34 + Math.random() * 22,
        color: DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
        emoji: DOT_EMOJIS[Math.floor(Math.random() * DOT_EMOJIS.length)],
      };
      setDots(prev => [...prev.slice(-9), newDot]);
      setTimeout(() => { setDots(prev => prev.filter(d => d.id !== id)); }, 2800);
    }, 650);
    return () => {
      if (dotTimerRef.current) clearInterval(dotTimerRef.current);
    };
  }, []);

  const tapDot = (id: number) => {
    setDots(prev => prev.filter(d => d.id !== id));
    setScore(s => s + 1);
    setCombo(c => {
      const next = c + 1;
      if (next >= 3) setShowCombo(true);
      return next;
    });
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      setCombo(0);
      setShowCombo(false);
    }, 1800);
  };

  const gradient = GRADIENTS[color] ?? GRADIENTS.purple;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="w-full rounded-2xl bg-slate-900/90 border border-slate-700/80 overflow-hidden mt-6 shadow-xl"
    >
      {/* ── Progress bar ── */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full bg-gradient-to-br ${gradient} animate-pulse`} />
            {message}
          </span>
          <span className="text-sm font-extrabold text-white tabular-nums">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* ── Dot-tap mini-game ── */}
      <div className="border-t border-slate-700/60">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/60">
          <span className="text-xs font-semibold text-slate-300">🎮 Tap the dots while you wait!</span>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {showCombo && combo >= 3 && (
                <motion.span
                  key={combo}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className="text-xs font-extrabold text-yellow-400"
                >
                  {combo}x COMBO! 🔥
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-xs font-bold text-white">
              Score: <span className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>{score}</span>
            </span>
          </div>
        </div>

        <div
          className="relative w-full select-none bg-slate-950/60"
          style={{ height: 170 }}
        >
          <AnimatePresence>
            {dots.map(dot => (
              <motion.button
                key={dot.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => tapDot(dot.id)}
                style={{
                  position: 'absolute',
                  left: `${dot.x}%`,
                  top: `${dot.y}%`,
                  width: dot.size,
                  height: dot.size,
                  borderRadius: '50%',
                  background: dot.color,
                  boxShadow: `0 0 18px ${dot.color}99`,
                  border: 'none',
                  padding: 0,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: dot.size * 0.46,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
                className="hover:scale-110 active:scale-90 transition-transform"
              >
                {dot.emoji}
              </motion.button>
            ))}
          </AnimatePresence>
          {dots.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-700 select-none pointer-events-none">
              Dots incoming…
            </p>
          )}
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-slate-700/60 bg-slate-900/40">
        <p className="text-center text-xs text-slate-500">
          AI is working its magic ✨ — tap dots to pass the time!
        </p>
      </div>
    </motion.div>
  );
};
