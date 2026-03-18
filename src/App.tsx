import React, { useState, useRef, useEffect } from 'react';
import { 
  Youtube, 
  Upload, 
  Search, 
  Copy, 
  Download, 
  Share2, 
  Check, 
  Clock, 
  FileText, 
  Tag, 
  Star, 
  Image as ImageIcon,
  ChevronRight,
  Loader2,
  Sparkles,
  Play,
  Music,
  Video,
  MessageSquare,
  Type as TypeIcon,
  DownloadCloud,
  X,
  Send,
  History as HistoryIcon,
  Trophy,
  Gamepad2,
  RotateCcw,
  PlusCircle,
  Plus,
  Layers,
  Settings2,
  Square,
  Circle,
  MousePointer2,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Undo2,
  Redo2,
  Maximize2,
  Palette,
  Sun,
  Contrast,
  Droplets,
  Focus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stage, Layer, Rect, Circle as KonvaCircle, Star as KonvaStar, Text as KonvaText, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import { analyzeYouTubeVideo, analyzeUploadedVideo, generateThumbnail, editThumbnail, VideoAnalysis } from './services/geminiService';

// --- Types ---

interface CanvasLayer {
  id: string;
  type: 'image' | 'text' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  fill?: string;
  opacity: number;
  visible: boolean;
  locked: boolean;
  src?: string;
  shapeType?: 'rect' | 'circle' | 'star';
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
}

interface HistoryItem {
  id: string;
  timestamp: number;
  title: string;
  results: VideoAnalysis;
  thumbnail: string | null;
}

// --- Components ---

const Navbar = ({ onShowHistory }: { onShowHistory: () => void }) => (
  <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-black/50 backdrop-blur-md border-b border-white/5">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
        <Play className="w-5 h-5 text-black fill-current" />
      </div>
      <span className="text-xl font-bold tracking-tight">Video<span className="text-emerald-500">Helper</span></span>
    </div>
    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
      <a href="#features" className="hover:text-white transition-colors">Features</a>
      <button onClick={onShowHistory} className="flex items-center gap-2 hover:text-white transition-colors">
        <HistoryIcon className="w-4 h-4" />
        History
      </button>
      <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
    </div>
    <button className="px-4 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-zinc-200 transition-colors">
      Get Started
    </button>
  </nav>
);

const MiniGame = () => {
  const [isActive, setIsActive] = useState(false);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('vh_game_highscore') || 0));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  
  // Game constants
  const GRAVITY = 0.22;
  const JUMP_STRENGTH = -4.8;
  const PIPE_SPEED = 2.2;
  const PIPE_SPAWN_RATE = 110; 
  const PIPE_WIDTH = 55;
  const GAP_HEIGHT = 115;
  const BIRD_SIZE = 28;

  // Game state refs
  const birdY = useRef(150);
  const birdVelocity = useRef(0);
  const pipes = useRef<{ x: number, top: number, passed: boolean }[]>([]);
  const frameCount = useRef(0);
  const particles = useRef<{ x: number, y: number, vx: number, vy: number, life: number, color: string, size: number }[]>([]);
  const clouds = useRef<{ x: number, y: number, speed: number, size: number }[]>([]);
  const shake = useRef(0);
  const flash = useRef(0);

  // Sound Synthesis
  const playSound = (type: 'jump' | 'score' | 'hit') => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtx.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'jump') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'score') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'hit') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  };

  const spawnParticles = (x: number, y: number, count: number, color: string, spread = 5) => {
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * spread,
        vy: (Math.random() - 0.5) * spread,
        life: 1.0,
        color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    birdY.current = 150;
    birdVelocity.current = 0;
    pipes.current = [];
    frameCount.current = 0;
    particles.current = [];
    shake.current = 0;
    flash.current = 0;
    
    // Initial clouds
    clouds.current = Array.from({ length: 5 }, () => ({
      x: Math.random() * 400,
      y: Math.random() * 150,
      speed: Math.random() * 0.5 + 0.2,
      size: Math.random() * 40 + 20
    }));
  };

  const jump = () => {
    if (gameState === 'playing') {
      birdVelocity.current = JUMP_STRENGTH;
      playSound('jump');
      spawnParticles(50, birdY.current, 5, '#10b981', 2);
    } else if (gameState === 'start' || gameState === 'gameover') {
      startGame();
    }
  };

  const update = () => {
    if (gameState !== 'playing') {
      // Still update clouds and particles for background movement
      clouds.current.forEach(c => {
        c.x -= c.speed;
        if (c.x + c.size < 0) c.x = 400 + c.size;
      });
      particles.current.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
      });
      particles.current = particles.current.filter(p => p.life > 0);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Update bird
    birdVelocity.current += GRAVITY;
    birdY.current += birdVelocity.current;

    // Trail particles
    if (frameCount.current % 3 === 0) {
      particles.current.push({
        x: 50, y: birdY.current,
        vx: -1, vy: (Math.random() - 0.5) * 0.5,
        life: 0.8,
        color: 'rgba(16, 185, 129, 0.3)',
        size: Math.random() * 3 + 1
      });
    }

    // Collision with floor/ceiling
    if (birdY.current + BIRD_SIZE/2 > canvas.height - 20 || birdY.current - BIRD_SIZE/2 < 0) {
      endGame();
    }

    // Update pipes
    frameCount.current++;
    if (frameCount.current % PIPE_SPAWN_RATE === 0) {
      const minPipeHeight = 40;
      const maxPipeHeight = canvas.height - GAP_HEIGHT - minPipeHeight - 20;
      const topHeight = Math.floor(Math.random() * (maxPipeHeight - minPipeHeight + 1)) + minPipeHeight;
      pipes.current.push({ x: canvas.width, top: topHeight, passed: false });
    }

    pipes.current.forEach((pipe) => {
      pipe.x -= PIPE_SPEED;

      // Collision detection
      const birdLeft = 50 - BIRD_SIZE/2 + 4;
      const birdRight = 50 + BIRD_SIZE/2 - 4;
      const birdTop = birdY.current - BIRD_SIZE/2 + 4;
      const birdBottom = birdY.current + BIRD_SIZE/2 - 4;

      if (birdRight > pipe.x && birdLeft < pipe.x + PIPE_WIDTH) {
        if (birdTop < pipe.top || birdBottom > pipe.top + GAP_HEIGHT) {
          endGame();
        }
      }

      // Scoring
      if (!pipe.passed && pipe.x + PIPE_WIDTH < 50) {
        pipe.passed = true;
        setScore(s => s + 1);
        playSound('score');
        spawnParticles(50, birdY.current - 40, 10, '#fbbf24', 8);
      }
    });

    // Update particles
    particles.current.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.02;
    });
    particles.current = particles.current.filter(p => p.life > 0);

    // Update clouds
    clouds.current.forEach(c => {
      c.x -= c.speed;
      if (c.x + c.size < 0) c.x = 400 + c.size;
    });

    // Remove off-screen pipes
    pipes.current = pipes.current.filter(p => p.x + PIPE_WIDTH > 0);
    
    if (shake.current > 0) shake.current -= 1;
    if (flash.current > 0) flash.current -= 0.1;
  };

  const endGame = () => {
    if (gameState === 'gameover') return;
    setGameState('gameover');
    playSound('hit');
    shake.current = 15;
    flash.current = 1.0;
    spawnParticles(50, birdY.current, 20, '#ef4444', 10);
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('vh_game_highscore', score.toString());
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.save();
    if (shake.current > 0) {
      ctx.translate((Math.random() - 0.5) * shake.current, (Math.random() - 0.5) * shake.current);
    }

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    clouds.current.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size, 0, Math.PI * 2);
      ctx.arc(c.x + c.size * 0.6, c.y - c.size * 0.2, c.size * 0.8, 0, Math.PI * 2);
      ctx.arc(c.x - c.size * 0.6, c.y - c.size * 0.2, c.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Particles
    particles.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;
    
    // Draw pipes
    pipes.current.forEach(pipe => {
      // Top pipe
      const gradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + PIPE_WIDTH, 0);
      gradient.addColorStop(0, '#059669');
      gradient.addColorStop(0.5, '#10b981');
      gradient.addColorStop(1, '#059669');
      
      ctx.fillStyle = gradient;
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(16, 185, 129, 0.2)';
      
      // Top pipe body
      ctx.beginPath();
      ctx.roundRect(pipe.x, 0, PIPE_WIDTH, pipe.top, [0, 0, 4, 4]);
      ctx.fill();
      
      // Bottom pipe body
      ctx.beginPath();
      ctx.roundRect(pipe.x, pipe.top + GAP_HEIGHT, PIPE_WIDTH, canvas.height - (pipe.top + GAP_HEIGHT) - 20, [4, 4, 0, 0]);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      // Pipe caps
      ctx.fillStyle = '#34d399';
      ctx.fillRect(pipe.x - 4, pipe.top - 15, PIPE_WIDTH + 8, 15);
      ctx.fillRect(pipe.x - 4, pipe.top + GAP_HEIGHT, PIPE_WIDTH + 8, 15);
    });

    // Ground
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
    ctx.fillStyle = '#10b981';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, canvas.height - 20, canvas.width, 2);
    ctx.globalAlpha = 1.0;

    // Draw bird (VideoHelper Logo)
    ctx.save();
    ctx.translate(50, birdY.current);
    const rotation = Math.min(Math.PI / 3, Math.max(-Math.PI / 4, birdVelocity.current * 0.12));
    ctx.rotate(rotation);
    
    // Squash and stretch
    const scaleY = 1 - Math.abs(birdVelocity.current) * 0.02;
    const scaleX = 1 + Math.abs(birdVelocity.current) * 0.02;
    ctx.scale(scaleX, scaleY);

    // Glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#10b981';
    
    // Logo square
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.roundRect(-BIRD_SIZE/2, -BIRD_SIZE/2, BIRD_SIZE, BIRD_SIZE, 8);
    ctx.fill();
    
    ctx.shadowBlur = 0;

    // Play triangle
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    const triSize = BIRD_SIZE * 0.45;
    ctx.moveTo(-triSize/2 + 2, -triSize/2);
    ctx.lineTo(-triSize/2 + 2, triSize/2);
    ctx.lineTo(triSize/2 + 2, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();

    // Flash effect
    if (flash.current > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flash.current * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();

    // UI Overlay
    if (gameState === 'start') {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#10b981';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('FLAPPY HELPER', canvas.width/2, canvas.height/2 - 20);
      
      ctx.shadowBlur = 0;
      ctx.font = '500 14px Inter';
      ctx.fillStyle = '#10b981';
      ctx.fillText('CLICK TO START', canvas.width/2, canvas.height/2 + 25);
      
      ctx.font = '10px Inter';
      ctx.fillStyle = '#4b5563';
      ctx.fillText('AVOID THE VIDEO REELS', canvas.width/2, canvas.height/2 + 50);
    } else if (gameState === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 32px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 30);
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Inter';
      ctx.fillText(`Score: ${score}`, canvas.width/2, canvas.height/2 + 10);
      
      if (score >= highScore && score > 0) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 12px Inter';
        ctx.fillText('NEW HIGH SCORE!', canvas.width/2, canvas.height/2 + 35);
      } else {
        ctx.fillStyle = '#6b7280';
        ctx.font = '12px Inter';
        ctx.fillText(`Best: ${highScore}`, canvas.width/2, canvas.height/2 + 35);
      }
      
      ctx.fillStyle = '#10b981';
      ctx.font = '500 14px Inter';
      ctx.fillText('CLICK TO TRY AGAIN', canvas.width/2, canvas.height/2 + 70);
    }
  };

  const loop = () => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    if (isActive) {
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isActive, gameState, score]);

  if (!isActive) {
    return (
      <div className="mt-8 p-8 glass-card border-emerald-500/30 bg-emerald-500/5 max-w-sm mx-auto text-center group">
        <div className="relative">
          <Gamepad2 className="w-16 h-16 text-emerald-500 mx-auto mb-6 group-hover:scale-110 transition-transform duration-500" />
          <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full -z-10" />
        </div>
        <h3 className="text-2xl font-bold mb-2">Bored waiting?</h3>
        <p className="text-sm text-zinc-400 mb-8 leading-relaxed">Challenge yourself to a game of "Flappy Helper" while we process your video!</p>
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setIsActive(true)}
            className="btn-primary w-full py-4 text-sm font-black flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20"
          >
            <Play className="w-5 h-5 fill-current" />
            PLAY NOW
          </button>
          {highScore > 0 && (
            <div className="flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 bg-white/5 py-2 rounded-full">
              <Trophy className="w-4 h-4 text-yellow-500" />
              ALL-TIME BEST: {highScore}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col items-center">
      <div className="relative w-full max-w-md aspect-[4/3] rounded-3xl overflow-hidden border-2 border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
        <canvas 
          ref={canvasRef}
          width={400}
          height={300}
          onClick={jump}
          className="w-full h-full cursor-pointer"
        />
        
        <div className="absolute top-6 left-6 flex items-center gap-3 pointer-events-none">
          <div className="bg-black/40 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3 shadow-2xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-lg font-black text-white tracking-tighter">{score}</span>
          </div>
        </div>

        <button 
          onClick={() => setIsActive(false)}
          className="absolute top-6 right-6 p-2.5 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 text-zinc-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {gameState === 'playing' && (
          <div className="absolute bottom-8 left-0 right-0 pointer-events-none flex flex-col items-center gap-2">
            <div className="text-[10px] text-zinc-400 uppercase tracking-[0.4em] font-bold">Tap to Jump</div>
            <div className="w-1 h-4 bg-emerald-500/20 rounded-full overflow-hidden">
              <div className="w-full h-full bg-emerald-500 animate-[bounce_1s_infinite]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ToolCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <div className="glass-card p-6 hover:border-emerald-500/50 transition-all group cursor-pointer">
    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
      <Icon className="w-6 h-6 text-emerald-500" />
    </div>
    <h3 className="text-lg font-bold mb-2">{title}</h3>
    <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
  </div>
);

const getYouTubeThumbnail = (url: string) => {
  const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
  return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
};

const CanvasImage = ({ layer, isSelected, onSelect, onChange }: { layer: CanvasLayer, isSelected: boolean, onSelect: () => void, onChange: (newAttrs: any) => void }) => {
  const [image] = useImage(layer.src || '', 'anonymous');
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        {...layer}
        draggable={!layer.locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...layer,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && !layer.locked && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

const CanvasText = ({ layer, isSelected, onSelect, onChange }: { layer: CanvasLayer, isSelected: boolean, onSelect: () => void, onChange: (newAttrs: any) => void }) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaText
        ref={shapeRef}
        {...layer}
        draggable={!layer.locked}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...layer,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...layer,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      />
      {isSelected && !layer.locked && (
        <Transformer
          ref={trRef}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            newBox.width = Math.max(30, newBox.width);
            return newBox;
          }}
        />
      )}
    </>
  );
};

const CanvasShape = ({ layer, isSelected, onSelect, onChange }: { layer: CanvasLayer, isSelected: boolean, onSelect: () => void, onChange: (newAttrs: any) => void }) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const ShapeComponent = layer.shapeType === 'circle' ? KonvaCircle : layer.shapeType === 'star' ? KonvaStar : Rect;

  const shapeProps: any = {
    ...layer,
    draggable: !layer.locked,
    onClick: onSelect,
    onTap: onSelect,
    onDragEnd: (e: any) => {
      onChange({
        ...layer,
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    onTransformEnd: (e: any) => {
      const node = shapeRef.current;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        ...layer,
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * scaleX),
        height: Math.max(5, node.height() * scaleY),
        rotation: node.rotation(),
      });
    },
  };

  if (layer.shapeType === 'star') {
    shapeProps.numPoints = 5;
    shapeProps.innerRadius = (layer.width || 50) / 2.5;
    shapeProps.outerRadius = (layer.width || 50) / 2;
  }

  return (
    <>
      <ShapeComponent
        ref={shapeRef}
        {...shapeProps}
      />
      {isSelected && !layer.locked && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

const ResultSection = ({ title, icon: Icon, children, onCopy }: { title: string, icon: any, children: React.ReactNode, onCopy?: () => void }) => (
  <div className="glass-card p-6 mb-6">
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-emerald-500" />
        </div>
        <h3 className="text-xl font-bold">{title}</h3>
      </div>
      {onCopy && (
        <button onClick={onCopy} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white">
          <Copy className="w-4 h-4" />
        </button>
      )}
    </div>
    <div className="text-zinc-300 leading-relaxed">
      {children}
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showDragPrompt, setShowDragPrompt] = useState(false);
  const [results, setResults] = useState<VideoAnalysis | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [baseThumbnail, setBaseThumbnail] = useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [showThumbnailStudio, setShowThumbnailStudio] = useState(false);
  const [thumbnailChat, setThumbnailChat] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [thumbnailChatInput, setThumbnailChatInput] = useState('');
  const [isEditingThumbnail, setIsEditingThumbnail] = useState(false);
  const [thumbnailText, setThumbnailText] = useState('');
  const [thumbnailTextColor, setThumbnailTextColor] = useState('#ffffff');
  const [thumbnailTextSize, setThumbnailTextSize] = useState(72);
  const [thumbnailTextFont, setThumbnailTextFont] = useState('font-black');
  const [thumbnailFontFamily, setThumbnailFontFamily] = useState('Inter');
  const [thumbnailFontWeight, setThumbnailFontWeight] = useState('font-black');
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [objectPrompt, setObjectPrompt] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    const saved = localStorage.getItem('vh_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 1280, height: 720, scale: 1 });

  // Canvas State
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasHistory, setCanvasHistory] = useState<CanvasLayer[][]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [aiCommand, setAiCommand] = useState('');

  // Handle Stage Resizing
  useEffect(() => {
    if (!containerRef.current || !showThumbnailStudio) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        const scale = width / 1280;
        setStageSize({
          width: width,
          height: width * (720 / 1280),
          scale: scale
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [showThumbnailStudio]);

  const handleAIEdit = async () => {
    if (!aiCommand || layers.length === 0) return;
    
    setIsAIProcessing(true);
    setThumbnailChat(prev => [...prev, { role: 'user', text: aiCommand }]);
    
    try {
      // Find the base image layer
      const baseLayer = layers.find(l => l.type === 'image');
      if (!baseLayer || !baseLayer.src) throw new Error("No base image found");

      const newImg = await editThumbnail(baseLayer.src, aiCommand);
      
      const newLayers = layers.map(l => {
        if (l.id === baseLayer.id) {
          return { ...l, src: newImg };
        }
        return l;
      });
      
      saveToCanvasHistory(newLayers);
      setLayers(newLayers);
      setThumbnailChat(prev => [...prev, { role: 'ai', text: "I've updated the thumbnail based on your command!" }]);
      setAiCommand('');
    } catch (err) {
      console.error(err);
      setThumbnailChat(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't process that edit. Try a different command." }]);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const saveToCanvasHistory = (newLayers: CanvasLayer[]) => {
    const newHistory = canvasHistory.slice(0, historyStep + 1);
    newHistory.push(JSON.parse(JSON.stringify(newLayers)));
    setCanvasHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setLayers(JSON.parse(JSON.stringify(canvasHistory[prevStep])));
      setHistoryStep(prevStep);
    }
  };

  const redo = () => {
    if (historyStep < canvasHistory.length - 1) {
      const nextStep = historyStep + 1;
      setLayers(JSON.parse(JSON.stringify(canvasHistory[nextStep])));
      setHistoryStep(nextStep);
    }
  };

  const addTextLayer = () => {
    const newLayer: CanvasLayer = {
      id: `text-${Date.now()}`,
      type: 'text',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      text: 'NEW TEXT',
      fontSize: 40,
      fontFamily: 'Inter',
      fontWeight: 'bold',
      fill: '#ffffff',
      opacity: 1,
      visible: true,
      locked: false,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0
    };
    const newLayers = [...layers, newLayer];
    setLayers(newLayers);
    saveToCanvasHistory(newLayers);
    setSelectedId(newLayer.id);
  };

  const addShapeLayer = (shapeType: 'rect' | 'circle' | 'star') => {
    const newLayer: CanvasLayer = {
      id: `shape-${Date.now()}`,
      type: 'shape',
      shapeType,
      x: 150,
      y: 150,
      width: 100,
      height: 100,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      fill: '#10b981',
      opacity: 0.8,
      visible: true,
      locked: false,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      blur: 0
    };
    const newLayers = [...layers, newLayer];
    setLayers(newLayers);
    saveToCanvasHistory(newLayers);
    setSelectedId(newLayer.id);
  };

  const deleteLayer = (id: string) => {
    const newLayers = layers.filter(l => l.id !== id);
    setLayers(newLayers);
    saveToCanvasHistory(newLayers);
    setSelectedId(null);
  };

  const updateLayer = (id: string, attrs: Partial<CanvasLayer>) => {
    const newLayers = layers.map(l => l.id === id ? { ...l, ...attrs } : l);
    setLayers(newLayers);
    // Debounce history save for properties? For now just save.
    saveToCanvasHistory(newLayers);
  };

  const reorderLayers = (id: string, direction: 'up' | 'down') => {
    const index = layers.findIndex(l => l.id === id);
    if (index === -1) return;
    const newLayers = [...layers];
    if (direction === 'up' && index < layers.length - 1) {
      [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    } else if (direction === 'down' && index > 0) {
      [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
    }
    setLayers(newLayers);
    saveToCanvasHistory(newLayers);
  };

  const handleAnalyze = async (type?: 'audio' | 'video') => {
    if (!url) return;
    
    // If it's a URL and no type is selected yet, show the modal
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      if (!type) {
        setShowDownloadModal(true);
        return;
      }
    }

    setShowDownloadModal(false);
    setIsDownloading(true);
    setDownloadProgress(0);

    // Start actual download from backend
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&type=${type}`;
    
    // Create a hidden link and click it to trigger the browser's native download
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = ''; // Browser will use the filename from Content-Disposition header
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Simulate progress bar while the browser handles the download
    const duration = 5000; // 5 seconds for a more realistic feel
    const interval = 50;
    const steps = duration / interval;
    const increment = 100 / steps;

    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, interval));
      setDownloadProgress(Math.min(100, Math.round(i * increment)));
    }

    setDownloadProgress(100);
    await new Promise(resolve => setTimeout(resolve, 500));

    setIsDownloading(false);
    setShowDragPrompt(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    setShowDragPrompt(false);
    setIsAnalyzing(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        const data = await analyzeUploadedVideo(base64, file.type);
        setResults(data);
        
        // Initialize Canvas with generated thumbnail or placeholder
        const img = await generateThumbnail(data.summary);
        const baseLayer: CanvasLayer = {
          id: 'base-image',
          type: 'image',
          x: 0,
          y: 0,
          width: 1280,
          height: 720,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          src: img,
          opacity: 1,
          visible: true,
          locked: true,
          brightness: 0,
          contrast: 0,
          saturation: 0,
          blur: 0
        };
        setLayers([baseLayer]);
        saveToCanvasHistory([baseLayer]);

        // Add to history
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          title: data.titles[0] || file.name,
          results: data,
          thumbnail: null
        };
        const newHistory = [newItem, ...history].slice(0, 20);
        setHistory(newHistory);
        localStorage.setItem('vh_history', JSON.stringify(newHistory));
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to process video file.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateThumbnail = async () => {
    if (!results) return;
    setIsGeneratingThumbnail(true);
    try {
      const img = await generateThumbnail(results.summary);
      setThumbnail(img);
      setBaseThumbnail(img);
      setShowThumbnailStudio(true);
      
      // Initialize Canvas layers
      const baseLayer: CanvasLayer = {
        id: 'base-image',
        type: 'image',
        x: 0,
        y: 0,
        width: 1280,
        height: 720,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        src: img,
        opacity: 1,
        visible: true,
        locked: true,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0
      };
      setLayers([baseLayer]);
      saveToCanvasHistory([baseLayer]);

      // Update history item with thumbnail
      const updatedHistory = history.map(item => {
        if (item.results.summary === results.summary) {
          return { ...item, thumbnail: img };
        }
        return item;
      });
      setHistory(updatedHistory);
      localStorage.setItem('vh_history', JSON.stringify(updatedHistory));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const handleEditThumbnail = async (overridePrompt?: string) => {
    const userMsg = overridePrompt || thumbnailChatInput;
    if (!thumbnail || !userMsg) return;
    
    setThumbnailChat(prev => [...prev, { role: 'user', text: userMsg }]);
    setThumbnailChatInput('');
    setIsEditingThumbnail(true);
    
    try {
      const newImg = await editThumbnail(thumbnail, userMsg);
      setThumbnail(newImg);
      setThumbnailChat(prev => [...prev, { role: 'ai', text: "I've updated the thumbnail for you! How does it look?" }]);
      
      // Update history item with edited thumbnail
      if (results) {
        const updatedHistory = history.map(item => {
          if (item.results.summary === results.summary) {
            return { ...item, thumbnail: newImg };
          }
          return item;
        });
        setHistory(updatedHistory);
        localStorage.setItem('vh_history', JSON.stringify(updatedHistory));
      }
    } catch (err) {
      console.error(err);
      setThumbnailChat(prev => [...prev, { role: 'ai', text: "Sorry, I had trouble editing that. Could you try again?" }]);
    } finally {
      setIsEditingThumbnail(false);
    }
  };

  const handleRevertThumbnail = () => {
    if (baseThumbnail) {
      setThumbnail(baseThumbnail);
      setThumbnailChat(prev => [...prev, { role: 'ai', text: "Reverted to the original generated thumbnail." }]);
      
      // Update history
      if (results) {
        const updatedHistory = history.map(item => {
          if (item.results.summary === results.summary) {
            return { ...item, thumbnail: baseThumbnail };
          }
          return item;
        });
        setHistory(updatedHistory);
        localStorage.setItem('vh_history', JSON.stringify(updatedHistory));
      }
    }
  };

  const downloadThumbnail = () => {
    if (!stageRef.current) return;
    
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const a = document.createElement('a');
    a.href = uri;
    const userName = "ZASCK";
    a.download = `${userName}_thumbnail_${Date.now()}.png`;
    a.click();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast here
  };

  const downloadTranscript = () => {
    if (!results?.transcript) return;
    const blob = new Blob([results.transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const userName = "ZASCK";
    a.download = `${userName}_transcript_${Date.now()}.txt`;
    a.click();
  };

  const selectedLayer = layers.find(l => l.id === selectedId);

  return (
    <div className="min-h-screen pb-20 bg-[#020202]">
      <Navbar onShowHistory={() => setShowHistory(true)} />

      {/* History Slide-over */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-[120] w-full max-w-md bg-zinc-950 border-l border-white/5 shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <HistoryIcon className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-xl font-bold">Project History</h2>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-20">
                    <HistoryIcon className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                    <p className="text-zinc-500">No projects yet. Start by analyzing a video!</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setResults(item.results);
                        setThumbnail(item.thumbnail);
                        setShowHistory(false);
                      }}
                      className="glass-card p-4 hover:border-emerald-500/50 transition-all cursor-pointer group"
                    >
                      <div className="flex gap-4">
                        <div className="w-24 aspect-video bg-zinc-900 rounded-lg overflow-hidden flex-shrink-0 border border-white/5">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="w-4 h-4 text-zinc-700" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm truncate group-hover:text-emerald-500 transition-colors">{item.title}</h4>
                          <p className="text-[10px] text-zinc-500 mt-1">
                            {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-6 border-t border-white/5">
                <button 
                  onClick={() => {
                    if (confirm('Clear all history?')) {
                      setHistory([]);
                      localStorage.removeItem('vh_history');
                    }
                  }}
                  className="w-full py-3 text-xs text-zinc-500 hover:text-red-400 transition-colors"
                >
                  Clear History
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Thumbnail Studio Modal */}
      <AnimatePresence>
        {showThumbnailStudio && thumbnail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
          >
            <div className="max-w-6xl w-full h-full flex flex-col glass-card border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-black" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Thumbnail Studio</h2>
                    <p className="text-xs text-zinc-500">AI-Powered YouTube Style Thumbnails</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowThumbnailStudio(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Preview Area */}
                <div className="flex-[2] bg-zinc-950 p-6 flex flex-col items-center justify-center gap-6 overflow-y-auto">
                  <div 
                    ref={containerRef}
                    className="relative group w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/10 border border-white/10 bg-black"
                  >
                    <Stage
                      ref={stageRef}
                      width={stageSize.width}
                      height={stageSize.height}
                      scaleX={stageSize.scale}
                      scaleY={stageSize.scale}
                      onMouseDown={(e) => {
                        // deselect when clicked on empty area
                        const clickedOnEmpty = e.target === e.target.getStage();
                        if (clickedOnEmpty) {
                          setSelectedId(null);
                        }
                      }}
                    >
                      <Layer>
                        {layers.map((layer) => {
                          if (layer.type === 'image') {
                            return (
                              <CanvasImage
                                key={layer.id}
                                layer={layer}
                                isSelected={layer.id === selectedId}
                                onSelect={() => setSelectedId(layer.id)}
                                onChange={(newAttrs) => updateLayer(layer.id, newAttrs)}
                              />
                            );
                          } else if (layer.type === 'text') {
                            return (
                              <CanvasText
                                key={layer.id}
                                layer={layer}
                                isSelected={layer.id === selectedId}
                                onSelect={() => setSelectedId(layer.id)}
                                onChange={(newAttrs) => updateLayer(layer.id, newAttrs)}
                              />
                            );
                          } else if (layer.type === 'shape') {
                            return (
                              <CanvasShape
                                key={layer.id}
                                layer={layer}
                                isSelected={layer.id === selectedId}
                                onSelect={() => setSelectedId(layer.id)}
                                onChange={(newAttrs) => updateLayer(layer.id, newAttrs)}
                              />
                            );
                          }
                          return null;
                        })}
                      </Layer>
                    </Stage>

                    <div className="absolute bottom-4 left-4 flex gap-2">
                      <button 
                        onClick={undo}
                        disabled={historyStep <= 0}
                        className="p-2 bg-black/50 backdrop-blur-md rounded-lg text-white hover:bg-emerald-500/20 disabled:opacity-30 transition-all"
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={redo}
                        disabled={historyStep >= canvasHistory.length - 1}
                        className="p-2 bg-black/50 backdrop-blur-md rounded-lg text-white hover:bg-emerald-500/20 disabled:opacity-30 transition-all"
                      >
                        <Redo2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="absolute top-4 right-4 flex flex-col gap-2">
                      <button 
                        onClick={addTextLayer}
                        className="p-3 bg-emerald-500 text-black rounded-xl hover:scale-110 transition-transform shadow-lg"
                      >
                        <TypeIcon className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => addShapeLayer('rect')}
                        className="p-3 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-all"
                      >
                        <Square className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => addShapeLayer('circle')}
                        className="p-3 bg-white/10 backdrop-blur-md text-white rounded-xl hover:bg-white/20 transition-all"
                      >
                        <Circle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={downloadThumbnail}
                      className="btn-primary flex items-center gap-2 px-8 py-3"
                    >
                      <DownloadCloud className="w-5 h-5" />
                      Download Final Thumbnail
                    </button>
                    <button 
                      onClick={handleRevertThumbnail}
                      disabled={!baseThumbnail || thumbnail === baseThumbnail || isEditingThumbnail}
                      className="btn-secondary flex items-center gap-2 px-6 py-3 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Revert
                    </button>
                    <button 
                      onClick={handleGenerateThumbnail}
                      className="btn-secondary flex items-center gap-2 px-6 py-3"
                    >
                      <Sparkles className="w-4 h-4" />
                      New Base
                    </button>
                  </div>
                </div>

                {/* Chat & Controls Area */}
                <div className="flex-1 border-l border-white/5 bg-zinc-900/50 flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-white/5">
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      Layers & Properties
                    </h3>
                    
                    {selectedLayer ? (
                      <div className="space-y-6">
                        {/* Content Section */}
                        {selectedLayer.type === 'text' && (
                          <div className="space-y-4">
                            <div>
                              <label className="text-[10px] text-zinc-500 uppercase font-bold mb-2 block">Text Content</label>
                              <input 
                                type="text"
                                value={selectedLayer.text}
                                onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-2 block">Font Size</label>
                                <input 
                                  type="number"
                                  value={selectedLayer.fontSize}
                                  onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-zinc-500 uppercase font-bold mb-2 block">Font Family</label>
                                <select 
                                  value={selectedLayer.fontFamily}
                                  onChange={(e) => updateLayer(selectedLayer.id, { fontFamily: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs outline-none"
                                >
                                  <option value="Inter">Inter</option>
                                  <option value="Arial">Arial</option>
                                  <option value="Courier New">Mono</option>
                                  <option value="Georgia">Serif</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Style Controls Section */}
                        <div className="pt-4 border-t border-white/5 space-y-4">
                          <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-2">
                            <Palette className="w-3 h-3 text-emerald-500" />
                            Style Controls
                          </label>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] text-zinc-400 uppercase font-bold mb-2 block">Fill Color</label>
                              <div className="flex gap-2">
                                <input 
                                  type="color"
                                  value={selectedLayer.fill || '#ffffff'}
                                  onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                                  className="w-8 h-8 bg-black/40 border border-white/10 rounded-lg cursor-pointer"
                                />
                                <input 
                                  type="text"
                                  value={selectedLayer.fill || '#ffffff'}
                                  onChange={(e) => updateLayer(selectedLayer.id, { fill: e.target.value })}
                                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 text-[10px] outline-none text-zinc-400 font-mono"
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] text-zinc-400 uppercase font-bold">Opacity</label>
                                <span className="text-[10px] text-emerald-500 font-mono">{Math.round((selectedLayer.opacity || 1) * 100)}%</span>
                              </div>
                              <input 
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={selectedLayer.opacity || 1}
                                onChange={(e) => updateLayer(selectedLayer.id, { opacity: parseFloat(e.target.value) })}
                                className="w-full accent-emerald-500"
                              />
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] text-zinc-400 uppercase font-bold flex items-center gap-1">
                                  <Sun className="w-3 h-3" />
                                  Glow Intensity
                                </label>
                                <span className="text-[10px] text-emerald-500 font-mono">{selectedLayer.shadowBlur || 0}px</span>
                              </div>
                              <input 
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={selectedLayer.shadowBlur || 0}
                                onChange={(e) => {
                                  const blur = parseInt(e.target.value);
                                  updateLayer(selectedLayer.id, { 
                                    shadowBlur: blur,
                                    shadowColor: selectedLayer.shadowColor || '#ffffff',
                                    shadowOpacity: blur > 0 ? 1 : 0,
                                    shadowOffsetX: 0,
                                    shadowOffsetY: 0
                                  });
                                }}
                                className="w-full accent-emerald-500"
                              />
                            </div>
                            { (selectedLayer.shadowBlur || 0) > 0 && (
                              <div>
                                <label className="text-[10px] text-zinc-400 uppercase font-bold mb-2 block">Glow Color</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="color"
                                    value={selectedLayer.shadowColor || '#ffffff'}
                                    onChange={(e) => updateLayer(selectedLayer.id, { shadowColor: e.target.value })}
                                    className="w-8 h-8 bg-black/40 border border-white/10 rounded-lg cursor-pointer"
                                  />
                                  <input 
                                    type="text"
                                    value={selectedLayer.shadowColor || '#ffffff'}
                                    onChange={(e) => updateLayer(selectedLayer.id, { shadowColor: e.target.value })}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 text-[10px] outline-none text-zinc-400 font-mono"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Layer Actions */}
                        <div className="pt-4 border-t border-white/5 space-y-3">
                          <label className="text-[10px] text-zinc-500 uppercase font-bold block">Arrangement</label>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => reorderLayers(selectedLayer.id, 'up')}
                              className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase transition-all"
                            >
                              Bring Forward
                            </button>
                            <button 
                              onClick={() => reorderLayers(selectedLayer.id, 'down')}
                              className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold uppercase transition-all"
                            >
                              Send Backward
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <button 
                              onClick={() => updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}
                              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2 ${selectedLayer.locked ? 'bg-emerald-500 text-black' : 'bg-white/5 text-zinc-400'}`}
                            >
                              {selectedLayer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                              {selectedLayer.locked ? 'Locked' : 'Lock'}
                            </button>
                            <button 
                              onClick={() => deleteLayer(selectedLayer.id)}
                              className="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-2xl">
                        <MousePointer2 className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                        <p className="text-[10px] text-zinc-600 uppercase font-bold">Select a layer to edit</p>
                      </div>
                    )}

                    <div className="mt-6">
                      <label className="text-[10px] text-zinc-500 uppercase font-bold mb-3 block">Layer List</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {layers.slice().reverse().map((layer) => (
                          <div 
                            key={layer.id}
                            onClick={() => setSelectedId(layer.id)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${layer.id === selectedId ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-black/20 border-white/5 hover:border-white/10'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
                                {layer.type === 'image' ? <ImageIcon className="w-4 h-4 text-zinc-500" /> : 
                                 layer.type === 'text' ? <TypeIcon className="w-4 h-4 text-zinc-500" /> : 
                                 <Square className="w-4 h-4 text-zinc-500" />}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-white capitalize">{layer.type}</p>
                                <p className="text-[10px] text-zinc-500">{layer.id.split('-')[0]}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {layer.locked && <Lock className="w-3 h-3 text-zinc-500" />}
                              {!layer.visible && <EyeOff className="w-3 h-3 text-zinc-500" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-b border-white/5">
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <PlusCircle className="w-4 h-4" />
                      Magic Add Objects
                    </h3>
                    <div className="space-y-4">
                      <p className="text-[10px] text-zinc-500 leading-relaxed">
                        Prompt the AI to generate and seamlessly blend new elements into your thumbnail.
                      </p>
                      <div>
                        <div className="relative mb-3">
                          <input 
                            type="text"
                            value={objectPrompt}
                            onChange={(e) => setObjectPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && objectPrompt && handleEditThumbnail(objectPrompt)}
                            placeholder="e.g., 'Add a red sports car'..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                          />
                          <button 
                            onClick={() => {
                              handleEditThumbnail(objectPrompt);
                              setObjectPrompt('');
                            }}
                            disabled={!objectPrompt || isEditingThumbnail}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-black rounded-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                          >
                            {isEditingThumbnail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            'Red Arrow', 'Explosion', 'Money', 'Fire', 'Shocked Face', 
                            'Sunglasses', 'Microphone', 'Thumbs Up', 'Trophy', 'Game Controller',
                            'AI Text'
                          ].map(item => (
                            <button
                              key={item}
                              onClick={() => {
                                if (item === 'AI Text') {
                                  const text = prompt("What text should the AI add to the image?");
                                  if (text) handleEditThumbnail(`Add the text "${text}" in a cool, vibrant style`);
                                } else {
                                  handleEditThumbnail(`Add a ${item.toLowerCase()}`);
                                }
                              }}
                              disabled={isEditingThumbnail}
                              className="px-3 py-1.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 rounded-full text-[10px] text-zinc-400 hover:text-emerald-400 transition-all disabled:opacity-50"
                            >
                              + {item}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 pb-2">
                      <h3 className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">AI History & Chat</h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {thumbnailChat.length === 0 && (
                        <div className="text-center py-6">
                          <MessageSquare className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                          <p className="text-[10px] text-zinc-600 uppercase tracking-tighter">No AI edits yet</p>
                        </div>
                      )}
                      {thumbnailChat.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${msg.role === 'user' ? 'bg-emerald-500 text-black font-medium' : 'bg-white/5 text-zinc-400'}`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {isEditingThumbnail && (
                        <div className="flex justify-start">
                          <div className="bg-white/5 p-3 rounded-2xl">
                            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-6 border-t border-white/5">
                      <div className="relative">
                        <input 
                          type="text"
                          value={thumbnailChatInput}
                          onChange={(e) => setThumbnailChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEditThumbnail()}
                          placeholder="Chat with AI Stylist..."
                          className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                        <button 
                          onClick={() => handleEditThumbnail()}
                          disabled={!thumbnailChatInput || isEditingThumbnail}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            Understand Any Video <br />
            <span className="gradient-text">Instantly</span>
          </h1>
          <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto">
            Paste a YouTube link or upload a video and let AI analyze it in seconds. 
            Get summaries, chapters, transcripts, and SEO tools.
          </p>

          <div className="max-w-3xl mx-auto glass-card p-2 flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                placeholder="Paste YouTube link here..."
                className="w-full bg-transparent border-none focus:ring-0 pl-12 pr-4 py-4 text-white placeholder:text-zinc-600"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={(e) => {
                  const pastedData = e.clipboardData.getData('text');
                  if (pastedData.includes('youtube.com') || pastedData.includes('youtu.be')) {
                    setUrl(pastedData);
                    setShowDownloadModal(true);
                  }
                }}
              />
            </div>
            <div className="flex gap-2 p-1">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-2 whitespace-nowrap"
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
              <button 
                onClick={() => handleAnalyze()}
                disabled={isAnalyzing || !url}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download
              </button>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="video/*" 
              onChange={handleFileUpload}
            />
          </div>
          
          {error && (
            <p className="mt-4 text-red-400 text-sm">{error}</p>
          )}
        </motion.div>
      </section>

      {/* Download Type Modal */}
      <AnimatePresence>
        {showDownloadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card max-w-md w-full p-8 text-center"
            >
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Download className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Ready to Download?</h2>
              <p className="text-zinc-400 mb-8">
                Since I can't read the video directly from the link, I need to download the content first. Would you like to download the audio or video?
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleAnalyze('audio')}
                  className="p-6 rounded-2xl bg-zinc-900 border border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
                >
                  <Music className="w-8 h-8 text-emerald-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <span className="block font-bold">Download Audio</span>
                  <span className="text-xs text-zinc-500">Fast analysis</span>
                </button>
                <button
                  onClick={() => handleAnalyze('video')}
                  className="p-6 rounded-2xl bg-zinc-900 border border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
                >
                  <Video className="w-8 h-8 text-emerald-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <span className="block font-bold">Download Video</span>
                  <span className="text-xs text-zinc-500">Full visual analysis</span>
                </button>
              </div>
              
              <button 
                onClick={() => setShowDownloadModal(false)}
                className="mt-8 text-zinc-500 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Downloading State */}
      <AnimatePresence>
        {isDownloading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden mb-6">
              <motion.div 
                className="h-full bg-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${downloadProgress}%` }}
              />
            </div>
            <h2 className="text-2xl font-bold mb-2">Downloading Content...</h2>
            <p className="text-zinc-400 mb-4">{downloadProgress}% complete</p>
            <MiniGame />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drag and Drop Prompt */}
      <AnimatePresence>
        {showDragPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-emerald-500/10 backdrop-blur-xl flex items-center justify-center p-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFileUpload(e);
            }}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="glass-card max-w-lg w-full p-12 text-center border-2 border-dashed border-emerald-500/50"
            >
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                <Upload className="w-10 h-10 text-black" />
              </div>
              <h2 className="text-3xl font-bold mb-4 text-white">Download Complete!</h2>
              <p className="text-xl text-emerald-400 font-medium mb-6">
                Now, drag the downloaded file here to start the AI analysis.
              </p>
              <p className="text-zinc-500 text-sm mb-8">
                Since I can't read the video directly from the link, I need you to provide the file you just downloaded.
              </p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary px-8 py-4 text-lg"
              >
                Or Select File Manually
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-24 h-24 relative mb-8">
              <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
              <Play className="absolute inset-0 m-auto w-8 h-8 text-emerald-500 fill-current" />
            </div>
            <h2 className="text-3xl font-bold mb-4">AI is Analyzing Your Video</h2>
            <p className="text-zinc-400 max-w-md mb-4">
              We're extracting chapters, generating a summary, and preparing SEO tools. This usually takes 10-20 seconds.
            </p>
            <MiniGame />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Section */}
      {results && !isAnalyzing && (
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          <div className="lg:col-span-2">
            <ResultSection title="Video Summary" icon={FileText} onCopy={() => copyToClipboard(results.summary)}>
              <p>{results.summary}</p>
            </ResultSection>

            <ResultSection title="Smart Chapters" icon={Clock}>
              <div className="space-y-4">
                {results.chapters.map((chapter, i) => (
                  <div key={i} className="flex items-center gap-4 group cursor-pointer p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <span className="font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded text-sm">{chapter.timestamp}</span>
                    <span className="font-medium">{chapter.title}</span>
                    <ChevronRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </ResultSection>

            <ResultSection title="Key Topics" icon={Tag}>
              <div className="flex flex-wrap gap-2">
                {results.topics.map((topic, i) => (
                  <span key={i} className="px-3 py-1 bg-zinc-800 rounded-full text-sm border border-white/5">
                    {topic}
                  </span>
                ))}
              </div>
            </ResultSection>

            <ResultSection title="Highlights" icon={Star}>
              <div className="space-y-4">
                {results.highlights.map((h, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="font-mono text-emerald-500 text-sm mt-1">{h.timestamp}</span>
                    <p className="text-zinc-300">{h.description}</p>
                  </div>
                ))}
              </div>
            </ResultSection>

            <ResultSection title="Transcript" icon={FileText} onCopy={() => copyToClipboard(results.transcript)}>
              <div className="max-h-96 overflow-y-auto pr-4 text-sm text-zinc-400 whitespace-pre-wrap">
                {results.transcript}
              </div>
              <button 
                onClick={downloadTranscript}
                className="mt-6 flex items-center gap-2 text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Full Transcript
              </button>
            </ResultSection>
          </div>

          <div className="space-y-8">
            <div className="glass-card p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                AI Thumbnail
              </h3>
              {thumbnail ? (
                <div className="space-y-4">
                  <img src={thumbnail} alt="Generated Thumbnail" className="w-full aspect-video object-cover rounded-xl border border-white/10" referrerPolicy="no-referrer" />
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setShowThumbnailStudio(true)}
                      className="btn-primary flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Studio
                    </button>
                    <button 
                      onClick={downloadThumbnail}
                      className="btn-secondary flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                  <p className="text-sm text-zinc-500 mb-6">Generate a high-quality thumbnail based on video content.</p>
                  <button 
                    onClick={handleGenerateThumbnail}
                    disabled={isGeneratingThumbnail}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {isGeneratingThumbnail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate with AI
                  </button>
                </div>
              )}
            </div>

            <div className="glass-card p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-500" />
                SEO & Metadata
              </h3>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Suggested Titles</label>
                  <div className="space-y-2">
                    {results.titles.map((t, i) => (
                      <div key={i} className="p-3 bg-zinc-800/50 rounded-lg text-sm border border-white/5 flex justify-between items-center group">
                        <span>{t}</span>
                        <button onClick={() => copyToClipboard(t)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Keywords</label>
                  <div className="flex flex-wrap gap-2">
                    {results.keywords.map((k, i) => (
                      <span key={i} className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded border border-emerald-500/20">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => copyToClipboard(results.description)}
                  className="w-full btn-secondary flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy YouTube Description
                </button>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-500" />
                Social Media
              </h3>
              <div className="space-y-4">
                {results.socialCaptions.map((c, i) => (
                  <div key={i} className="p-4 bg-zinc-800/50 rounded-xl text-sm italic text-zinc-400 border border-white/5 relative group">
                    "{c}"
                    <button onClick={() => copyToClipboard(c)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/50 rounded">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Tools Section */}
      {!results && (
        <section id="tools" className="px-6 max-w-7xl mx-auto pt-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">AI Video Helper Tools</h2>
            <p className="text-zinc-400">Everything you need to optimize your video content in one place.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ToolCard icon={Clock} title="Auto Chapters" description="Generate smart timestamps for your YouTube videos automatically." />
            <ToolCard icon={FileText} title="AI Summary" description="Get a concise summary of any video content in seconds." />
            <ToolCard icon={Tag} title="Topic Detector" description="Identify the main subjects and themes discussed in the video." />
            <ToolCard icon={Star} title="Highlight Finder" description="Automatically find the most engaging moments for shorts or reels." />
            <ToolCard icon={Search} title="SEO Generator" description="Generate optimized titles, descriptions, and keywords." />
            <ToolCard icon={ImageIcon} title="Thumbnail AI" description="Create eye-catching thumbnails using generative AI." />
            <ToolCard icon={FileText} title="Transcript Gen" description="Convert video speech to accurate text transcripts." />
            <ToolCard icon={Share2} title="Social Captions" description="Create engaging captions for Twitter, Instagram, and more." />
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-32 border-t border-white/5 pt-12 px-6 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-zinc-500 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center">
            <Play className="w-4 h-4 text-black fill-current" />
          </div>
          <span className="text-white font-bold">VideoHelper</span>
        </div>
        <div className="flex gap-8">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Contact</a>
        </div>
        <p>© 2026 VideoHelper AI. All rights reserved.</p>
      </footer>
    </div>
  );
}
