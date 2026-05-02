import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { readUserScopedStorageValue } from '../services/browserStorage';
import {
  ArrowLeft,
  Type,
  Square,
  Circle,
  Star,
  Triangle,
  Diamond,
  Hexagon,
  Octagon,
  Layers,
  Download,
  X,
  Check,
  Zap,
  Settings,
  Grid,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  Sparkles,
  Figma,
  MessageCircle,
  Send,
  Loader,
  Bot,
  Wand2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stage, Layer, Rect, Circle as KonvaCircle, Star as KonvaStar, Text as KonvaText, Image as KonvaImage, RegularPolygon as KonvaRegularPolygon } from 'react-konva';
import useImage from 'use-image';

// Types
interface CanvasElement {
  id: string;
  type: 'text' | 'shape' | 'image' | 'icon';
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
  fill: string;
  opacity: number;
  visible: boolean;
  locked: boolean;
  src?: string;
  shapeType?: 'rect' | 'circle' | 'star' | 'triangle' | 'diamond' | 'pentagon' | 'hexagon';
  shadowBlur?: number;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

interface BackgroundStyle {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradientStart?: string;
  gradientEnd?: string;
  imageSrc?: string;
  overlayColor?: string;
  overlayOpacity?: number;
}

interface FilterPreset {
  id: 'fortnite' | 'cartoon' | '3d' | 'neon' | 'noir' | 'anime' | 'cinematic' | 'vaporwave' | 'realistic';
  name: string;
  description: string;
  accent: string;
  promptAliases: string[];
  background: {
    color: string;
    overlayColor?: string;
    overlayOpacity?: number;
  };
  textStyle: {
    palette: string[];
    fontFamily?: string;
    fontWeight?: string;
    shadowColor: string;
    shadowBlur: number;
    shadowOpacity: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
  };
  shapeStyle: {
    palette: string[];
    shadowColor: string;
    shadowBlur: number;
    shadowOpacity: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    opacity?: number;
  };
  imageStyle?: {
    shadowColor?: string;
    shadowBlur?: number;
    shadowOpacity?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    opacity?: number;
  };
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  emoji: string;
  previewBg: string;
  textColor: string;
  preset: (width: number, height: number) => { elements: CanvasElement[]; background: BackgroundStyle };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AICommand {
  action: 'add-text' | 'add-shape' | 'delete' | 'change-background' | 'change-property' | 'clear-all' | 'apply-filter' | 'none';
  params?: Record<string, any>;
}

interface InlineTextEditorState {
  id: string;
  value: string;
}

interface InlineTextEditorDimensions {
  width: number;
  height: number;
}

const EMOJI_FONT_FALLBACK = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const DEFAULT_TEXT_FONT_FAMILY = `Arial, ${EMOJI_FONT_FALLBACK}`;

function withEmojiFontFallback(fontFamily?: string) {
  const baseFont = fontFamily?.trim() || 'Arial';

  if (baseFont.includes('Segoe UI Emoji') || baseFont.includes('Apple Color Emoji') || baseFont.includes('Noto Color Emoji')) {
    return baseFont;
  }

  return `${baseFont}, ${EMOJI_FONT_FALLBACK}`;
}

const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'fortnite',
    name: 'Fortnite',
    description: 'Loud contrast, electric colors, and punchy gaming energy.',
    accent: '#22d3ee',
    promptAliases: ['fortnite', 'gaming filter', 'epic gaming', 'streamer'],
    background: {
      color: '#0f172a',
      overlayColor: '#0ea5e9',
      overlayOpacity: 0.18,
    },
    textStyle: {
      palette: ['#ffffff', '#fde047', '#22d3ee'],
      fontFamily: 'Impact',
      fontWeight: 'bold',
      shadowColor: '#0ea5e9',
      shadowBlur: 26,
      shadowOpacity: 0.65,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    },
    shapeStyle: {
      palette: ['#22d3ee', '#e879f9', '#fde047'],
      shadowColor: '#38bdf8',
      shadowBlur: 20,
      shadowOpacity: 0.5,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      opacity: 0.95,
    },
    imageStyle: {
      shadowColor: '#0ea5e9',
      shadowBlur: 18,
      shadowOpacity: 0.35,
      opacity: 0.97,
    },
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    description: 'Flat bright tones with bold comic-style outlines and pop.',
    accent: '#f59e0b',
    promptAliases: ['cartoon', 'comic', 'animated', 'toon'],
    background: {
      color: '#fef08a',
      overlayColor: '#fb7185',
      overlayOpacity: 0.12,
    },
    textStyle: {
      palette: ['#111827', '#2563eb', '#dc2626'],
      fontFamily: 'Impact',
      fontWeight: 'bold',
      shadowColor: '#111827',
      shadowBlur: 0,
      shadowOpacity: 0.95,
      shadowOffsetX: 5,
      shadowOffsetY: 5,
    },
    shapeStyle: {
      palette: ['#fb7185', '#38bdf8', '#facc15', '#4ade80'],
      shadowColor: '#111827',
      shadowBlur: 0,
      shadowOpacity: 0.85,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      opacity: 1,
    },
    imageStyle: {
      shadowColor: '#111827',
      shadowBlur: 10,
      shadowOpacity: 0.2,
      opacity: 1,
    },
  },
  {
    id: '3d',
    name: '3D',
    description: 'Chunky depth with heavy drop shadows and dimensional highlights.',
    accent: '#f97316',
    promptAliases: ['3d', 'three d', 'depth', 'dimensional'],
    background: {
      color: '#1f2937',
      overlayColor: '#f97316',
      overlayOpacity: 0.14,
    },
    textStyle: {
      palette: ['#ffffff', '#fdba74', '#fca5a5'],
      fontFamily: 'Impact',
      fontWeight: 'bold',
      shadowColor: '#111827',
      shadowBlur: 4,
      shadowOpacity: 0.9,
      shadowOffsetX: 8,
      shadowOffsetY: 8,
    },
    shapeStyle: {
      palette: ['#fb923c', '#60a5fa', '#fcd34d'],
      shadowColor: '#111827',
      shadowBlur: 6,
      shadowOpacity: 0.75,
      shadowOffsetX: 10,
      shadowOffsetY: 10,
      opacity: 0.96,
    },
    imageStyle: {
      shadowColor: '#111827',
      shadowBlur: 20,
      shadowOpacity: 0.4,
      shadowOffsetX: 12,
      shadowOffsetY: 12,
      opacity: 0.94,
    },
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Dark club lighting with vivid pink and cyan glow.',
    accent: '#a855f7',
    promptAliases: ['neon', 'cyberpunk', 'glow', 'synthwave'],
    background: {
      color: '#050816',
      overlayColor: '#7c3aed',
      overlayOpacity: 0.2,
    },
    textStyle: {
      palette: ['#67e8f9', '#f9a8d4', '#c084fc'],
      fontFamily: 'Impact',
      fontWeight: 'bold',
      shadowColor: '#c084fc',
      shadowBlur: 30,
      shadowOpacity: 0.7,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    },
    shapeStyle: {
      palette: ['#22d3ee', '#e879f9', '#a3e635'],
      shadowColor: '#d946ef',
      shadowBlur: 24,
      shadowOpacity: 0.65,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      opacity: 0.95,
    },
    imageStyle: {
      shadowColor: '#a855f7',
      shadowBlur: 22,
      shadowOpacity: 0.4,
      opacity: 0.95,
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Monochrome cinematic styling with restrained highlights.',
    accent: '#94a3b8',
    promptAliases: ['noir', 'black and white', 'cinematic', 'monochrome'],
    background: {
      color: '#020617',
      overlayColor: '#94a3b8',
      overlayOpacity: 0.08,
    },
    textStyle: {
      palette: ['#f8fafc', '#cbd5e1', '#94a3b8'],
      fontFamily: 'Arial',
      fontWeight: 'bold',
      shadowColor: '#000000',
      shadowBlur: 12,
      shadowOpacity: 0.75,
      shadowOffsetX: 2,
      shadowOffsetY: 4,
    },
    shapeStyle: {
      palette: ['#e2e8f0', '#94a3b8', '#475569'],
      shadowColor: '#000000',
      shadowBlur: 12,
      shadowOpacity: 0.55,
      shadowOffsetX: 2,
      shadowOffsetY: 6,
      opacity: 0.92,
    },
    imageStyle: {
      shadowColor: '#000000',
      shadowBlur: 12,
      shadowOpacity: 0.35,
      opacity: 0.9,
    },
  },
  {
    id: 'anime',
    name: 'Anime',
    description: 'Bright cel-shaded color, sharp contrast, and poster-like energy.',
    accent: '#fb7185',
    promptAliases: ['anime', 'manga', 'cel shaded', 'animation style', 'otaku'],
    background: {
      color: '#172554',
      overlayColor: '#ec4899',
      overlayOpacity: 0.14,
    },
    textStyle: {
      palette: ['#ffffff', '#fef08a', '#f9a8d4'],
      fontFamily: 'Impact',
      fontWeight: 'bold',
      shadowColor: '#0f172a',
      shadowBlur: 0,
      shadowOpacity: 0.95,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
    },
    shapeStyle: {
      palette: ['#60a5fa', '#fb7185', '#facc15', '#c084fc'],
      shadowColor: '#0f172a',
      shadowBlur: 0,
      shadowOpacity: 0.9,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      opacity: 0.98,
    },
    imageStyle: {
      shadowColor: '#1e293b',
      shadowBlur: 12,
      shadowOpacity: 0.22,
      opacity: 1,
    },
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'Moody contrast, filmic darkness, and a more dramatic screen feel.',
    accent: '#f59e0b',
    promptAliases: ['cinematic', 'movie', 'film', 'dramatic', 'hollywood'],
    background: {
      color: '#111827',
      overlayColor: '#f97316',
      overlayOpacity: 0.1,
    },
    textStyle: {
      palette: ['#f8fafc', '#fdba74', '#d1d5db'],
      fontFamily: 'Arial',
      fontWeight: 'bold',
      shadowColor: '#000000',
      shadowBlur: 18,
      shadowOpacity: 0.8,
      shadowOffsetX: 0,
      shadowOffsetY: 8,
    },
    shapeStyle: {
      palette: ['#f59e0b', '#1f2937', '#9ca3af'],
      shadowColor: '#000000',
      shadowBlur: 18,
      shadowOpacity: 0.5,
      shadowOffsetX: 0,
      shadowOffsetY: 10,
      opacity: 0.9,
    },
    imageStyle: {
      shadowColor: '#000000',
      shadowBlur: 26,
      shadowOpacity: 0.45,
      shadowOffsetX: 0,
      shadowOffsetY: 12,
      opacity: 0.92,
    },
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    description: 'Retro pink-blue gradient glow with synth-era nostalgia.',
    accent: '#f472b6',
    promptAliases: ['vaporwave', 'retro', '80s', 'outrun', 'retro wave'],
    background: {
      color: '#312e81',
      overlayColor: '#22d3ee',
      overlayOpacity: 0.16,
    },
    textStyle: {
      palette: ['#fdf2f8', '#67e8f9', '#f9a8d4'],
      fontFamily: 'Impact',
      fontWeight: 'bold',
      shadowColor: '#ec4899',
      shadowBlur: 28,
      shadowOpacity: 0.7,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    },
    shapeStyle: {
      palette: ['#22d3ee', '#f472b6', '#c084fc', '#fde047'],
      shadowColor: '#a855f7',
      shadowBlur: 24,
      shadowOpacity: 0.6,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      opacity: 0.95,
    },
    imageStyle: {
      shadowColor: '#ec4899',
      shadowBlur: 24,
      shadowOpacity: 0.35,
      opacity: 0.95,
    },
  },
  {
    id: 'realistic',
    name: 'Realistic',
    description: 'Cleaner natural tones with restrained shadow and photo-first styling.',
    accent: '#22c55e',
    promptAliases: ['realistic', 'photo', 'photoreal', 'natural', 'real photo'],
    background: {
      color: '#1f2937',
      overlayColor: '#000000',
      overlayOpacity: 0.06,
    },
    textStyle: {
      palette: ['#ffffff', '#e5e7eb', '#d1fae5'],
      fontFamily: 'Arial',
      fontWeight: 'bold',
      shadowColor: '#111827',
      shadowBlur: 10,
      shadowOpacity: 0.55,
      shadowOffsetX: 1,
      shadowOffsetY: 4,
    },
    shapeStyle: {
      palette: ['#94a3b8', '#e5e7eb', '#86efac'],
      shadowColor: '#111827',
      shadowBlur: 10,
      shadowOpacity: 0.35,
      shadowOffsetX: 1,
      shadowOffsetY: 4,
      opacity: 0.88,
    },
    imageStyle: {
      shadowColor: '#000000',
      shadowBlur: 14,
      shadowOpacity: 0.25,
      shadowOffsetX: 0,
      shadowOffsetY: 6,
      opacity: 0.98,
    },
  },
];

const FILTER_PRESET_LOOKUP = Object.fromEntries(
  FILTER_PRESETS.map((preset) => [preset.id, preset])
) as Record<FilterPreset['id'], FilterPreset>;

function pickPaletteColor(index: number, palette: string[], fallback: string) {
  if (palette.length === 0) return fallback;
  return palette[index % palette.length] || fallback;
}

function getShadowProps(element: CanvasElement) {
  return {
    shadowBlur: element.shadowBlur || 0,
    shadowColor: element.shadowColor || '#000000',
    shadowOpacity: element.shadowOpacity ?? 0,
    shadowOffsetX: element.shadowOffsetX || 0,
    shadowOffsetY: element.shadowOffsetY || 0,
  };
}

function resolveFilterPresetId(input?: string): FilterPreset['id'] | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  const direct = FILTER_PRESETS.find((preset) => preset.id === normalized);
  if (direct) return direct.id;

  const aliasMatch = FILTER_PRESETS.find((preset) =>
    preset.promptAliases.some((alias) => normalized.includes(alias))
  );

  return aliasMatch?.id || null;
}

function transformElementsForFilter(elements: CanvasElement[], preset: FilterPreset) {
  let textIndex = 0;
  let shapeIndex = 0;

  return elements.map((element) => {
    if (element.type === 'text') {
      const nextElement: CanvasElement = {
        ...element,
        fill: pickPaletteColor(textIndex, preset.textStyle.palette, element.fill),
        fontFamily: preset.textStyle.fontFamily || element.fontFamily,
        fontWeight: preset.textStyle.fontWeight || element.fontWeight,
        shadowColor: preset.textStyle.shadowColor,
        shadowBlur: preset.textStyle.shadowBlur,
        shadowOpacity: preset.textStyle.shadowOpacity,
        shadowOffsetX: preset.textStyle.shadowOffsetX,
        shadowOffsetY: preset.textStyle.shadowOffsetY,
      };
      textIndex += 1;
      return nextElement;
    }

    if (element.type === 'shape' || element.type === 'icon') {
      const nextElement: CanvasElement = {
        ...element,
        fill: pickPaletteColor(shapeIndex, preset.shapeStyle.palette, element.fill),
        opacity: preset.shapeStyle.opacity ?? element.opacity,
        shadowColor: preset.shapeStyle.shadowColor,
        shadowBlur: preset.shapeStyle.shadowBlur,
        shadowOpacity: preset.shapeStyle.shadowOpacity,
        shadowOffsetX: preset.shapeStyle.shadowOffsetX,
        shadowOffsetY: preset.shapeStyle.shadowOffsetY,
      };
      shapeIndex += 1;
      return nextElement;
    }

    if (element.type === 'image') {
      return {
        ...element,
        opacity: preset.imageStyle?.opacity ?? element.opacity,
        shadowColor: preset.imageStyle?.shadowColor || element.shadowColor,
        shadowBlur: preset.imageStyle?.shadowBlur ?? element.shadowBlur,
        shadowOpacity: preset.imageStyle?.shadowOpacity ?? element.shadowOpacity,
        shadowOffsetX: preset.imageStyle?.shadowOffsetX ?? element.shadowOffsetX,
        shadowOffsetY: preset.imageStyle?.shadowOffsetY ?? element.shadowOffsetY,
      };
    }

    return element;
  });
}

// Template Presets
const TEMPLATES: Template[] = [
  // ─── MrBeast Style ───
  {
    id: 'mrbeast',
    name: 'MrBeast Style',
    description: 'Explosive high-CTR challenge layout with loud contrast and playful chaos.',
    category: 'gaming',
    emoji: '🤑',
    previewBg: 'linear-gradient(135deg, #FFD700 0%, #FF6B00 100%)',
    textColor: '#000000',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#FFD61A' },
      elements: [
        { id: '1', type: 'shape', x: w - 310, y: -40, width: 420, height: 420, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FF5A1F', opacity: 0.96, visible: true, locked: false, shapeType: 'circle' },
        { id: '2', type: 'shape', x: w - 170, y: 430, width: 160, height: 160, rotation: 10, scaleX: 1, scaleY: 1, fill: '#22A6F2', opacity: 0.92, visible: true, locked: false, shapeType: 'star' },
        { id: '3', type: 'shape', x: 70, y: 440, width: 88, height: 88, rotation: -14, scaleX: 1, scaleY: 1, fill: '#FF1D8E', opacity: 1, visible: true, locked: false, shapeType: 'star' },
        { id: '4', type: 'shape', x: 26, y: 28, width: 170, height: 22, rotation: -4, scaleX: 1, scaleY: 1, fill: '#000000', opacity: 0.15, visible: true, locked: false, shapeType: 'rect' },
        { id: '5', type: 'text', x: 40, y: 62, width: w - 120, height: 170, rotation: -3, scaleX: 1, scaleY: 1, text: 'NO WAY!!', fontSize: 150, fontFamily: 'Impact', fontWeight: 'bold', fill: '#000000', opacity: 1, visible: true, locked: false, shadowBlur: 0, shadowColor: '#000000', shadowOpacity: 0.95, shadowOffsetX: 8, shadowOffsetY: 8 },
        { id: '6', type: 'shape', x: 42, y: 520, width: 430, height: 68, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.97, visible: true, locked: false, shapeType: 'rect' },
        { id: '7', type: 'text', x: 58, y: 532, width: 410, height: 48, rotation: 0, scaleX: 1, scaleY: 1, text: 'I DID THE IMPOSSIBLE!', fontSize: 50, fontFamily: 'Impact', fontWeight: 'bold', fill: '#111111', opacity: 1, visible: true, locked: false },
        { id: '8', type: 'shape', x: 40, y: 610, width: 260, height: 12, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00AEEF', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '9', type: 'text', x: 60, y: 462, width: 200, height: 44, rotation: -3, scaleX: 1, scaleY: 1, text: 'NEW VIDEO', fontSize: 28, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false, shadowBlur: 4, shadowColor: '#000000', shadowOpacity: 0.4, shadowOffsetX: 2, shadowOffsetY: 2 },
      ],
    }),
  },
  // ─── Horror ───
  {
    id: 'horror',
    name: 'Horror',
    description: 'Creeping cinematic horror with blood-red light, warnings, and unease.',
    category: 'horror',
    emoji: '👻',
    previewBg: 'linear-gradient(135deg, #0A0A0A 0%, #3D0000 100%)',
    textColor: '#FF0000',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#090909' },
      elements: [
        { id: '1', type: 'shape', x: w - 240, y: -80, width: 430, height: 430, rotation: 0, scaleX: 1, scaleY: 1, fill: '#610000', opacity: 0.84, visible: true, locked: false, shapeType: 'circle' },
        { id: '2', type: 'shape', x: -80, y: h - 240, width: 340, height: 340, rotation: 0, scaleX: 1, scaleY: 1, fill: '#2D0000', opacity: 0.55, visible: true, locked: false, shapeType: 'circle' },
        { id: '3', type: 'shape', x: 0, y: 0, width: w, height: 26, rotation: 0, scaleX: 1, scaleY: 1, fill: '#000000', opacity: 0.72, visible: true, locked: false, shapeType: 'rect' },
        { id: '4', type: 'text', x: 48, y: 66, width: w * 0.72, height: 130, rotation: -1, scaleX: 1, scaleY: 1, text: 'DO NOT WATCH', fontSize: 96, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FF1F1F', opacity: 1, visible: true, locked: false, shadowBlur: 26, shadowColor: '#FF0000', shadowOpacity: 0.86, shadowOffsetX: 0, shadowOffsetY: 0 },
        { id: '5', type: 'text', x: 50, y: 220, width: w * 0.68, height: 96, rotation: 0, scaleX: 1, scaleY: 1, text: 'ALONE IN THE BASEMENT', fontSize: 56, fontFamily: 'Impact', fontWeight: 'bold', fill: '#F4F4F4', opacity: 1, visible: true, locked: false, shadowBlur: 12, shadowColor: '#7A0000', shadowOpacity: 0.65, shadowOffsetX: 0, shadowOffsetY: 0 },
        { id: '6', type: 'shape', x: 48, y: 352, width: 240, height: 8, rotation: 0, scaleX: 1, scaleY: 1, fill: '#A30000', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '7', type: 'shape', x: 48, y: 528, width: 390, height: 54, rotation: -1, scaleX: 1, scaleY: 1, fill: '#111111', opacity: 0.96, visible: true, locked: false, shapeType: 'rect' },
        { id: '8', type: 'text', x: 66, y: 540, width: 370, height: 34, rotation: -1, scaleX: 1, scaleY: 1, text: '⚠ NOT FOR THE FAINT HEARTED', fontSize: 28, fontFamily: 'Arial', fontWeight: 'bold', fill: '#B7B7B7', opacity: 1, visible: true, locked: false },
        { id: '9', type: 'text', x: w - 330, y: h - 84, width: 280, height: 36, rotation: 0, scaleX: 1, scaleY: 1, text: 'real footage?', fontSize: 32, fontFamily: 'Impact', fontWeight: 'bold', fill: '#D1D1D1', opacity: 0.85, visible: true, locked: false },
      ],
    }),
  },
  // ─── Story Time ───
  {
    id: 'storytime',
    name: 'Story Time',
    description: 'Dreamy story-channel layout with spotlight framing and playful accents.',
    category: 'story',
    emoji: '📖',
    previewBg: 'linear-gradient(135deg, #7B2FF7 0%, #F107A3 100%)',
    textColor: '#FFFFFF',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#6F2CFF' },
      elements: [
        { id: '1', type: 'shape', x: w / 2 - 260, y: h / 2 - 260, width: 520, height: 520, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.08, visible: true, locked: false, shapeType: 'circle' },
        { id: '2', type: 'shape', x: 54, y: 72, width: 220, height: 44, rotation: -3, scaleX: 1, scaleY: 1, fill: '#FFE56D', opacity: 0.95, visible: true, locked: false, shapeType: 'rect' },
        { id: '3', type: 'text', x: 72, y: 81, width: 200, height: 30, rotation: -3, scaleX: 1, scaleY: 1, text: 'TRUE STORY', fontSize: 28, fontFamily: 'Impact', fontWeight: 'bold', fill: '#28115B', opacity: 1, visible: true, locked: false },
        { id: '4', type: 'text', x: 118, y: 200, width: w - 236, height: 120, rotation: -2, scaleX: 1, scaleY: 1, text: 'STORY TIME', fontSize: 120, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false, shadowBlur: 22, shadowColor: '#000000', shadowOpacity: 0.45, shadowOffsetX: 4, shadowOffsetY: 4 },
        { id: '5', type: 'text', x: 250, y: 342, width: w - 500, height: 70, rotation: 0, scaleX: 1, scaleY: 1, text: 'the ending changed everything', fontSize: 42, fontFamily: 'Arial', fontWeight: 'bold', fill: '#FFE56D', opacity: 1, visible: true, locked: false },
        { id: '6', type: 'shape', x: 84, y: 112, width: 84, height: 84, rotation: 12, scaleX: 1, scaleY: 1, fill: '#FFE56D', opacity: 0.9, visible: true, locked: false, shapeType: 'star' },
        { id: '7', type: 'shape', x: w - 144, y: 120, width: 64, height: 64, rotation: -18, scaleX: 1, scaleY: 1, fill: '#FF88D2', opacity: 0.96, visible: true, locked: false, shapeType: 'star' },
        { id: '8', type: 'shape', x: 92, y: h - 150, width: 52, height: 52, rotation: 8, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.82, visible: true, locked: false, shapeType: 'star' },
        { id: '9', type: 'shape', x: w - 180, y: h - 168, width: 88, height: 88, rotation: -8, scaleX: 1, scaleY: 1, fill: '#FFE56D', opacity: 0.86, visible: true, locked: false, shapeType: 'star' },
      ],
    }),
  },
  // ─── Travel Vlog ───
  {
    id: 'travel-vlog',
    name: 'Travel Vlog',
    description: 'Premium travel-poster composition with destination tag and postcard framing.',
    category: 'vlog',
    emoji: '✈️',
    previewBg: 'linear-gradient(135deg, #0575E6 0%, #021B79 100%)',
    textColor: '#FFFFFF',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#045FD3' },
      elements: [
        { id: '1', type: 'shape', x: w - 300, y: 54, width: 250, height: 250, rotation: 0, scaleX: 1, scaleY: 1, fill: '#79C8FF', opacity: 0.16, visible: true, locked: false, shapeType: 'circle' },
        { id: '2', type: 'shape', x: 44, y: 44, width: w - 88, height: h - 88, rotation: 0, scaleX: 1, scaleY: 1, fill: '#0E2B76', opacity: 0.26, visible: true, locked: false, shapeType: 'rect' },
        { id: '3', type: 'shape', x: 74, y: 88, width: 236, height: 42, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.96, visible: true, locked: false, shapeType: 'rect' },
        { id: '4', type: 'text', x: 92, y: 96, width: 210, height: 28, rotation: 0, scaleX: 1, scaleY: 1, text: 'NEW EPISODE', fontSize: 24, fontFamily: 'Impact', fontWeight: 'bold', fill: '#0A2A70', opacity: 1, visible: true, locked: false },
        { id: '5', type: 'text', x: 72, y: 180, width: w * 0.72, height: 160, rotation: 0, scaleX: 1, scaleY: 1, text: 'PARIS DIARY', fontSize: 110, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false, shadowBlur: 10, shadowColor: '#001A52', shadowOpacity: 0.45, shadowOffsetX: 0, shadowOffsetY: 4 },
        { id: '6', type: 'text', x: 78, y: 324, width: 460, height: 54, rotation: 0, scaleX: 1, scaleY: 1, text: '48 hours in the city of lights', fontSize: 40, fontFamily: 'Arial', fontWeight: 'bold', fill: '#BFE4FF', opacity: 1, visible: true, locked: false },
        { id: '7', type: 'shape', x: 76, y: 404, width: 220, height: 10, rotation: 0, scaleX: 1, scaleY: 1, fill: '#9AD7FF', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '8', type: 'shape', x: 72, y: h - 102, width: 280, height: 44, rotation: 0, scaleX: 1, scaleY: 1, fill: '#0B1F4D', opacity: 0.84, visible: true, locked: false, shapeType: 'rect' },
        { id: '9', type: 'text', x: 92, y: h - 92, width: 240, height: 28, rotation: 0, scaleX: 1, scaleY: 1, text: 'TRAVEL VLOG 2025', fontSize: 24, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false },
      ],
    }),
  },
  // ─── Gaming Highlights ───
  {
    id: 'gaming-stream',
    name: 'Gaming Highlights',
    description: 'Arena-energy gaming card with neon accents, center focus, and stream overlays.',
    category: 'gaming',
    emoji: '🎮',
    previewBg: 'linear-gradient(135deg, #0D0D2B 0%, #1A0033 100%)',
    textColor: '#00FF88',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#0D0D2B' },
      elements: [
        { id: '1', type: 'shape', x: w / 2 - 340, y: h / 2 - 250, width: 680, height: 500, rotation: 0, scaleX: 1, scaleY: 1, fill: '#171942', opacity: 0.72, visible: true, locked: false, shapeType: 'rect' },
        { id: '2', type: 'shape', x: w / 2 - 220, y: h / 2 - 220, width: 440, height: 440, rotation: 0, scaleX: 1, scaleY: 1, fill: '#7B00FF', opacity: 0.13, visible: true, locked: false, shapeType: 'circle' },
        { id: '3', type: 'shape', x: 72, y: 104, width: 210, height: 34, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00FF88', opacity: 0.94, visible: true, locked: false, shapeType: 'rect' },
        { id: '4', type: 'text', x: 94, y: 111, width: 180, height: 22, rotation: 0, scaleX: 1, scaleY: 1, text: 'LIVE CLIP', fontSize: 20, fontFamily: 'Impact', fontWeight: 'bold', fill: '#07131A', opacity: 1, visible: true, locked: false },
        { id: '5', type: 'shape', x: -60, y: h / 2 - 44, width: 280, height: 8, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00FF88', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '6', type: 'shape', x: w - 220, y: h / 2 - 44, width: 280, height: 8, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00FF88', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '7', type: 'text', x: 64, y: 196, width: w - 128, height: 170, rotation: 0, scaleX: 1, scaleY: 1, text: 'INSANE WIN', fontSize: 132, fontFamily: 'Impact', fontWeight: 'bold', fill: '#00FF88', opacity: 1, visible: true, locked: false, shadowBlur: 32, shadowColor: '#00FF88', shadowOpacity: 0.72, shadowOffsetX: 0, shadowOffsetY: 0 },
        { id: '8', type: 'text', x: 78, y: 414, width: w - 156, height: 68, rotation: 0, scaleX: 1, scaleY: 1, text: 'UNBELIEVABLE CLUTCH MOMENT', fontSize: 46, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 0.95, visible: true, locked: false },
        { id: '9', type: 'shape', x: 88, y: 560, width: 68, height: 68, rotation: 20, scaleX: 1, scaleY: 1, fill: '#FF00E5', opacity: 0.92, visible: true, locked: false, shapeType: 'star' },
        { id: '10', type: 'shape', x: w - 156, y: 548, width: 72, height: 72, rotation: -14, scaleX: 1, scaleY: 1, fill: '#13C8FF', opacity: 0.92, visible: true, locked: false, shapeType: 'star' },
      ],
    }),
  },
  // ─── Fitness Motivation ───
  {
    id: 'fitness',
    name: 'Fitness Motivation',
    description: 'Aggressive transformation layout with bold typography and training accents.',
    category: 'fitness',
    emoji: '💪',
    previewBg: 'linear-gradient(135deg, #1A0000 0%, #7F0000 100%)',
    textColor: '#FF6B00',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#180303' },
      elements: [
        { id: '1', type: 'shape', x: -120, y: -120, width: 600, height: 600, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FF3B00', opacity: 0.18, visible: true, locked: false, shapeType: 'circle' },
        { id: '2', type: 'shape', x: w - 240, y: h - 250, width: 440, height: 440, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FF7700', opacity: 0.16, visible: true, locked: false, shapeType: 'circle' },
        { id: '3', type: 'shape', x: 66, y: 72, width: 190, height: 34, rotation: -3, scaleX: 1, scaleY: 1, fill: '#FF5B00', opacity: 0.96, visible: true, locked: false, shapeType: 'rect' },
        { id: '4', type: 'text', x: 86, y: 79, width: 166, height: 22, rotation: -3, scaleX: 1, scaleY: 1, text: 'DAY 90', fontSize: 22, fontFamily: 'Impact', fontWeight: 'bold', fill: '#140404', opacity: 1, visible: true, locked: false },
        { id: '5', type: 'text', x: 52, y: 132, width: w - 104, height: 142, rotation: 0, scaleX: 1, scaleY: 1, text: 'NEVER', fontSize: 150, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FF5700', opacity: 1, visible: true, locked: false, shadowBlur: 18, shadowColor: '#FF5700', shadowOpacity: 0.54, shadowOffsetX: 0, shadowOffsetY: 0 },
        { id: '6', type: 'text', x: 52, y: 286, width: w - 104, height: 142, rotation: 0, scaleX: 1, scaleY: 1, text: 'QUIT', fontSize: 164, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false, shadowBlur: 8, shadowColor: '#000000', shadowOpacity: 0.35, shadowOffsetX: 4, shadowOffsetY: 4 },
        { id: '7', type: 'shape', x: 54, y: 462, width: 460, height: 8, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FF5700', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '8', type: 'shape', x: 54, y: 506, width: 340, height: 48, rotation: 0, scaleX: 1, scaleY: 1, fill: '#111111', opacity: 0.92, visible: true, locked: false, shapeType: 'rect' },
        { id: '9', type: 'text', x: 72, y: 515, width: 310, height: 26, rotation: 0, scaleX: 1, scaleY: 1, text: '90-DAY TRANSFORMATION', fontSize: 28, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FF9A2B', opacity: 1, visible: true, locked: false },
      ],
    }),
  },
  // ─── Tutorial / How-To ───
  {
    id: 'tutorial',
    name: 'Tutorial / How-To',
    description: 'Stronger explainer layout with course-card structure and visual steps.',
    category: 'educational',
    emoji: '📚',
    previewBg: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
    textColor: '#3B82F6',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#0F172A' },
      elements: [
        { id: '1', type: 'shape', x: 0, y: 0, width: 18, height: h, rotation: 0, scaleX: 1, scaleY: 1, fill: '#3B82F6', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '2', type: 'shape', x: 44, y: 54, width: w - 88, height: h - 108, rotation: 0, scaleX: 1, scaleY: 1, fill: '#111D34', opacity: 0.58, visible: true, locked: false, shapeType: 'rect' },
        { id: '3', type: 'shape', x: 76, y: 84, width: 190, height: 44, rotation: 0, scaleX: 1, scaleY: 1, fill: '#E8F2FF', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '4', type: 'text', x: 96, y: 92, width: 160, height: 28, rotation: 0, scaleX: 1, scaleY: 1, text: 'HOW TO', fontSize: 28, fontFamily: 'Impact', fontWeight: 'bold', fill: '#1D4ED8', opacity: 1, visible: true, locked: false },
        { id: '5', type: 'text', x: 74, y: 170, width: w - 160, height: 170, rotation: 0, scaleX: 1, scaleY: 1, text: 'BUILD ANYTHING', fontSize: 108, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false, shadowBlur: 8, shadowColor: '#3B82F6', shadowOpacity: 0.38, shadowOffsetX: 0, shadowOffsetY: 0 },
        { id: '6', type: 'text', x: 78, y: 372, width: 640, height: 60, rotation: 0, scaleX: 1, scaleY: 1, text: 'step-by-step beginner system', fontSize: 38, fontFamily: 'Arial', fontWeight: 'bold', fill: '#A8C4F7', opacity: 1, visible: true, locked: false },
        { id: '7', type: 'shape', x: 76, y: 462, width: 470, height: 8, rotation: 0, scaleX: 1, scaleY: 1, fill: '#3B82F6', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '8', type: 'shape', x: w - 250, y: 88, width: 150, height: 150, rotation: 0, scaleX: 1, scaleY: 1, fill: '#3B82F6', opacity: 0.12, visible: true, locked: false, shapeType: 'circle' },
        { id: '9', type: 'text', x: w - 202, y: 126, width: 84, height: 40, rotation: 0, scaleX: 1, scaleY: 1, text: '01', fontSize: 54, fontFamily: 'Impact', fontWeight: 'bold', fill: '#93C5FD', opacity: 0.9, visible: true, locked: false },
      ],
    }),
  },
  // ─── Top 10 Countdown ───
  {
    id: 'top10',
    name: 'Top 10 Countdown',
    description: 'Ranked-list composition with trophy energy, metallic contrast, and countdown drama.',
    category: 'educational',
    emoji: '🏆',
    previewBg: 'linear-gradient(135deg, #111827 0%, #000000 100%)',
    textColor: '#FFD700',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#111827' },
      elements: [
        { id: '1', type: 'shape', x: 40, y: 54, width: 260, height: 260, rotation: -5, scaleX: 1, scaleY: 1, fill: '#FFD700', opacity: 0.14, visible: true, locked: false, shapeType: 'circle' },
        { id: '2', type: 'text', x: 52, y: 62, width: 270, height: 260, rotation: -5, scaleX: 1, scaleY: 1, text: '#1', fontSize: 244, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFD700', opacity: 1, visible: true, locked: false, shadowBlur: 24, shadowColor: '#FFD700', shadowOpacity: 0.42, shadowOffsetX: 0, shadowOffsetY: 0 },
        { id: '3', type: 'shape', x: 362, y: 96, width: 362, height: 42, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFD700', opacity: 0.94, visible: true, locked: false, shapeType: 'rect' },
        { id: '4', type: 'text', x: 382, y: 102, width: 320, height: 28, rotation: 0, scaleX: 1, scaleY: 1, text: 'TOP COUNTDOWN', fontSize: 24, fontFamily: 'Impact', fontWeight: 'bold', fill: '#111827', opacity: 1, visible: true, locked: false },
        { id: '5', type: 'text', x: 360, y: 172, width: w - 420, height: 150, rotation: 0, scaleX: 1, scaleY: 1, text: "THINGS YOU DIDN'T KNOW", fontSize: 68, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false },
        { id: '6', type: 'text', x: 364, y: 320, width: w - 420, height: 70, rotation: 0, scaleX: 1, scaleY: 1, text: 'about the internet', fontSize: 42, fontFamily: 'Arial', fontWeight: 'bold', fill: '#A4ADB8', opacity: 1, visible: true, locked: false },
        { id: '7', type: 'shape', x: 362, y: 404, width: 390, height: 6, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFD700', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '8', type: 'shape', x: 82, y: 430, width: 92, height: 92, rotation: 18, scaleX: 1, scaleY: 1, fill: '#FFD700', opacity: 0.86, visible: true, locked: false, shapeType: 'star' },
        { id: '9', type: 'shape', x: w - 170, y: 560, width: 70, height: 70, rotation: -10, scaleX: 1, scaleY: 1, fill: '#FFD700', opacity: 0.72, visible: true, locked: false, shapeType: 'star' },
      ],
    }),
  },
  // ─── 24H Challenge ───
  {
    id: 'challenge',
    name: '24H Challenge',
    description: 'High-pressure challenge card with stickers, tape bars, and fast visual tension.',
    category: 'challenge',
    emoji: '⚡',
    previewBg: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
    textColor: '#000000',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#06B6D4' },
      elements: [
        { id: '1', type: 'shape', x: w / 2 - 350, y: -120, width: 700, height: 700, rotation: 0, scaleX: 1, scaleY: 1, fill: '#0E7490', opacity: 0.4, visible: true, locked: false, shapeType: 'circle' },
        { id: '2', type: 'shape', x: 54, y: 74, width: 230, height: 42, rotation: -3, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.96, visible: true, locked: false, shapeType: 'rect' },
        { id: '3', type: 'text', x: 74, y: 82, width: 210, height: 26, rotation: -3, scaleX: 1, scaleY: 1, text: 'NO STOPPING', fontSize: 24, fontFamily: 'Impact', fontWeight: 'bold', fill: '#0B1B29', opacity: 1, visible: true, locked: false },
        { id: '4', type: 'text', x: 48, y: 146, width: w - 96, height: 150, rotation: 0, scaleX: 1, scaleY: 1, text: '24 HOUR', fontSize: 138, fontFamily: 'Impact', fontWeight: 'bold', fill: '#08141F', opacity: 1, visible: true, locked: false },
        { id: '5', type: 'text', x: 48, y: 292, width: w - 96, height: 150, rotation: 0, scaleX: 1, scaleY: 1, text: 'CHALLENGE', fontSize: 138, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false, shadowBlur: 10, shadowColor: '#08141F', shadowOpacity: 0.8, shadowOffsetX: 5, shadowOffsetY: 5 },
        { id: '6', type: 'shape', x: 50, y: 486, width: 470, height: 56, rotation: 0, scaleX: 1, scaleY: 1, fill: '#08141F', opacity: 0.9, visible: true, locked: false, shapeType: 'rect' },
        { id: '7', type: 'text', x: 70, y: 497, width: 430, height: 34, rotation: 0, scaleX: 1, scaleY: 1, text: "I can't believe what happened...", fontSize: 30, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false },
        { id: '8', type: 'shape', x: w - 176, y: h - 176, width: 112, height: 112, rotation: 28, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.56, visible: true, locked: false, shapeType: 'star' },
        { id: '9', type: 'shape', x: w - 326, y: 76, width: 180, height: 38, rotation: 8, scaleX: 1, scaleY: 1, fill: '#08141F', opacity: 0.72, visible: true, locked: false, shapeType: 'rect' },
        { id: '10', type: 'text', x: w - 306, y: 85, width: 150, height: 20, rotation: 8, scaleX: 1, scaleY: 1, text: 'WATCH TO END', fontSize: 18, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false },
      ],
    }),
  },
  // ─── Reaction Video ───
  {
    id: 'reaction',
    name: 'Reaction Video',
    description: 'Cleaner reaction layout with split framing, focal text, and reaction sticker energy.',
    category: 'reaction',
    emoji: '😱',
    previewBg: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
    textColor: '#FFFFFF',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#C70039' },
      elements: [
        { id: '1', type: 'shape', x: 0, y: 0, width: w / 2, height: h, rotation: 0, scaleX: 1, scaleY: 1, fill: '#1A0A0F', opacity: 0.42, visible: true, locked: false, shapeType: 'rect' },
        { id: '2', type: 'shape', x: w / 2 - 6, y: 0, width: 12, height: h, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.4, visible: true, locked: false, shapeType: 'rect' },
        { id: '3', type: 'text', x: 42, y: 72, width: 510, height: 270, rotation: 0, scaleX: 1, scaleY: 1, text: 'REACTING\nTO THIS', fontSize: 92, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false, shadowBlur: 10, shadowColor: '#000000', shadowOpacity: 0.85, shadowOffsetX: 3, shadowOffsetY: 3 },
        { id: '4', type: 'shape', x: 678, y: 56, width: w - 744, height: h - 112, rotation: 0, scaleX: 1, scaleY: 1, fill: '#111111', opacity: 0.62, visible: true, locked: false, shapeType: 'rect' },
        { id: '5', type: 'shape', x: 710, y: 92, width: w - 808, height: h - 184, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.08, visible: true, locked: false, shapeType: 'rect' },
        { id: '6', type: 'text', x: 728, y: h / 2 - 38, width: 450, height: 76, rotation: 0, scaleX: 1, scaleY: 1, text: 'YOUR PHOTO HERE', fontSize: 36, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 0.42, visible: true, locked: false },
        { id: '7', type: 'shape', x: 40, y: h - 120, width: 110, height: 110, rotation: -14, scaleX: 1, scaleY: 1, fill: '#FFDD00', opacity: 1, visible: true, locked: false, shapeType: 'star' },
        { id: '8', type: 'shape', x: 376, y: 492, width: 196, height: 42, rotation: -5, scaleX: 1, scaleY: 1, fill: '#FFFFFF', opacity: 0.95, visible: true, locked: false, shapeType: 'rect' },
        { id: '9', type: 'text', x: 398, y: 501, width: 150, height: 22, rotation: -5, scaleX: 1, scaleY: 1, text: 'NO SCRIPTED REACTION', fontSize: 16, fontFamily: 'Impact', fontWeight: 'bold', fill: '#C70039', opacity: 1, visible: true, locked: false },
      ],
    }),
  },
  // ─── Cooking / Food ───
  {
    id: 'cooking',
    name: 'Cooking / Food',
    description: 'Food thumbnail with recipe-card structure, warmth, and menu-style highlights.',
    category: 'food',
    emoji: '🍳',
    previewBg: 'linear-gradient(135deg, #EA580C 0%, #B45309 100%)',
    textColor: '#FFFFFF',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#EA580C' },
      elements: [
        { id: '1', type: 'shape', x: w / 2 - 320, y: -120, width: 640, height: 640, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFF5D7', opacity: 0.08, visible: true, locked: false, shapeType: 'circle' },
        { id: '2', type: 'shape', x: 58, y: 64, width: 226, height: 42, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFF1CC', opacity: 0.96, visible: true, locked: false, shapeType: 'rect' },
        { id: '3', type: 'text', x: 82, y: 73, width: 180, height: 24, rotation: 0, scaleX: 1, scaleY: 1, text: 'DINNER FAVORITE', fontSize: 22, fontFamily: 'Impact', fontWeight: 'bold', fill: '#A94405', opacity: 1, visible: true, locked: false },
        { id: '4', type: 'text', x: 56, y: 140, width: w - 112, height: 110, rotation: 0, scaleX: 1, scaleY: 1, text: 'PERFECT', fontSize: 110, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false, shadowBlur: 6, shadowColor: '#000000', shadowOpacity: 0.38, shadowOffsetX: 3, shadowOffsetY: 3 },
        { id: '5', type: 'text', x: 56, y: 258, width: w - 112, height: 110, rotation: 0, scaleX: 1, scaleY: 1, text: 'RECIPE', fontSize: 118, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFF1CC', opacity: 1, visible: true, locked: false },
        { id: '6', type: 'shape', x: 58, y: 390, width: 250, height: 8, rotation: 0, scaleX: 1, scaleY: 1, fill: '#FFF1CC', opacity: 0.8, visible: true, locked: false, shapeType: 'rect' },
        { id: '7', type: 'shape', x: 58, y: 430, width: 360, height: 48, rotation: 0, scaleX: 1, scaleY: 1, fill: '#AD4406', opacity: 0.78, visible: true, locked: false, shapeType: 'rect' },
        { id: '8', type: 'text', x: 80, y: 440, width: 310, height: 26, rotation: 0, scaleX: 1, scaleY: 1, text: '⏱ READY IN 20 MINUTES', fontSize: 24, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFF4D5', opacity: 1, visible: true, locked: false },
        { id: '9', type: 'text', x: 60, y: 512, width: 340, height: 46, rotation: 0, scaleX: 1, scaleY: 1, text: 'quick • easy • creamy', fontSize: 32, fontFamily: 'Arial', fontWeight: 'bold', fill: '#FFFFFF', opacity: 0.92, visible: true, locked: false },
        { id: '10', type: 'shape', x: w - 178, y: 92, width: 110, height: 110, rotation: 18, scaleX: 1, scaleY: 1, fill: '#FFF1CC', opacity: 0.92, visible: true, locked: false, shapeType: 'star' },
      ],
    }),
  },
  // ─── Podcast / Interview ───
  {
    id: 'podcast',
    name: 'Podcast / Interview',
    description: 'Sharper interview setup with episode tag, waveform bars, and studio polish.',
    category: 'vlog',
    emoji: '🎙️',
    previewBg: 'linear-gradient(135deg, #141414 0%, #1E2A3A 100%)',
    textColor: '#00D4FF',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#141414' },
      elements: [
        { id: '1', type: 'shape', x: 0, y: 0, width: w, height: 6, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00D4FF', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '2', type: 'shape', x: 0, y: h - 6, width: w, height: 6, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00D4FF', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '3', type: 'shape', x: 58, y: 62, width: 160, height: 40, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00D4FF', opacity: 0.16, visible: true, locked: false, shapeType: 'rect' },
        { id: '4', type: 'text', x: 78, y: 70, width: 120, height: 24, rotation: 0, scaleX: 1, scaleY: 1, text: 'EP. 01', fontSize: 24, fontFamily: 'Impact', fontWeight: 'bold', fill: '#7EEBFF', opacity: 1, visible: true, locked: false },
        { id: '5', type: 'text', x: 58, y: 154, width: w - 116, height: 220, rotation: 0, scaleX: 1, scaleY: 1, text: 'EVERYTHING\nCHANGES', fontSize: 112, fontFamily: 'Impact', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false },
        { id: '6', type: 'shape', x: 60, y: 430, width: 440, height: 4, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00D4FF', opacity: 0.48, visible: true, locked: false, shapeType: 'rect' },
        { id: '7', type: 'text', x: 60, y: 462, width: 520, height: 44, rotation: 0, scaleX: 1, scaleY: 1, text: 'Full interview inside', fontSize: 34, fontFamily: 'Arial', fontWeight: 'bold', fill: '#7C8B9F', opacity: 1, visible: true, locked: false },
        { id: '8', type: 'shape', x: w - 290, y: 520, width: 18, height: 60, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00D4FF', opacity: 0.72, visible: true, locked: false, shapeType: 'rect' },
        { id: '9', type: 'shape', x: w - 258, y: 500, width: 18, height: 80, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00D4FF', opacity: 0.48, visible: true, locked: false, shapeType: 'rect' },
        { id: '10', type: 'shape', x: w - 226, y: 536, width: 18, height: 44, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00D4FF', opacity: 0.9, visible: true, locked: false, shapeType: 'rect' },
        { id: '11', type: 'shape', x: w - 194, y: 484, width: 18, height: 96, rotation: 0, scaleX: 1, scaleY: 1, fill: '#00D4FF', opacity: 0.55, visible: true, locked: false, shapeType: 'rect' },
      ],
    }),
  },
  // ─── Minimal Modern ───
  {
    id: 'minimal',
    name: 'Minimal Modern',
    description: 'Cleaner premium layout with restrained accents and stronger editorial balance.',
    category: 'minimal',
    emoji: '✨',
    previewBg: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
    textColor: '#10B981',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#1A1A1A' },
      elements: [
        { id: '1', type: 'shape', x: 60, y: 72, width: 140, height: 4, rotation: 0, scaleX: 1, scaleY: 1, fill: '#10B981', opacity: 1, visible: true, locked: false, shapeType: 'rect' },
        { id: '2', type: 'shape', x: 60, y: 98, width: 24, height: h - 196, rotation: 0, scaleX: 1, scaleY: 1, fill: '#232323', opacity: 0.82, visible: true, locked: false, shapeType: 'rect' },
        { id: '3', type: 'text', x: 118, y: h / 2 - 126, width: w - 250, height: 140, rotation: 0, scaleX: 1, scaleY: 1, text: 'Your Title Here', fontSize: 92, fontFamily: 'Arial', fontWeight: 'bold', fill: '#FFFFFF', opacity: 1, visible: true, locked: false },
        { id: '4', type: 'text', x: 122, y: h / 2 + 48, width: 460, height: 44, rotation: 0, scaleX: 1, scaleY: 1, text: 'Subtitle or tagline', fontSize: 34, fontFamily: 'Arial', fontWeight: 'bold', fill: '#7B7B7B', opacity: 1, visible: true, locked: false },
        { id: '5', type: 'shape', x: 120, y: h / 2 + 126, width: 220, height: 4, rotation: 0, scaleX: 1, scaleY: 1, fill: '#10B981', opacity: 0.9, visible: true, locked: false, shapeType: 'rect' },
        { id: '6', type: 'shape', x: w - 174, y: 86, width: 70, height: 70, rotation: 0, scaleX: 1, scaleY: 1, fill: '#10B981', opacity: 0.14, visible: true, locked: false, shapeType: 'circle' },
        { id: '7', type: 'shape', x: w - 130, y: h - 132, width: 34, height: 34, rotation: 0, scaleX: 1, scaleY: 1, fill: '#10B981', opacity: 0.82, visible: true, locked: false, shapeType: 'rect' },
      ],
    }),
  },
];

// Export Formats
const EXPORT_FORMATS = [
  { name: 'YouTube', width: 1280, height: 720 },
  { name: 'TikTok', width: 1080, height: 1920 },
  { name: 'Instagram', width: 1080, height: 1080 },
  { name: 'Custom PNG', width: 1280, height: 720 },
];

// Background Image Component for Konva (fills canvas, behind all elements)
const BackgroundImageLayer = ({ src, width, height }: { src: string; width: number; height: number }) => {
  const [image] = useImage(src, 'anonymous');
  if (!image) return null;
  return (
    <KonvaImage
      image={image}
      x={0}
      y={0}
      width={width}
      height={height}
      listening={false}
    />
  );
};

// Image Component for Konva
interface ImageComponentProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<CanvasElement>) => void;
}

const ImageComponent = ({ element, isSelected, onSelect, onUpdate }: ImageComponentProps) => {
  // Use anonymous CORS only for external http URLs; blob: URLs don't need it
  const crossOrigin = element.src?.startsWith('blob:') ? undefined : 'anonymous';
  const [image] = useImage(element.src || '', crossOrigin as any);
  
  if (!image) return null;
  
  return (
    <KonvaImage
      key={element.id}
      image={image}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      opacity={element.opacity}
      rotation={element.rotation}
      scaleX={element.scaleX}
      scaleY={element.scaleY}
      draggable={!element.locked}
      onClick={onSelect}
      onDragEnd={(e) => {
        onUpdate({ x: e.target.x(), y: e.target.y() });
      }}
    />
  );
};

const CreatorLabPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid || 'anonymous';
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);
  const textMeasureRef = useRef<HTMLDivElement>(null);

  // optional: state to hold Gemini response
  // Canvas State
  const [canvasWidth] = useState(1280);
  const [canvasHeight] = useState(720);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inlineTextEditor, setInlineTextEditor] = useState<InlineTextEditorState | null>(null);
  const [inlineTextEditorDimensions, setInlineTextEditorDimensions] = useState<InlineTextEditorDimensions | null>(null);
  const [background, setBackground] = useState<BackgroundStyle>({ type: 'solid', color: '#1a1a1a' });
  const [stageScale, setStageScale] = useState(1);

  // UI State
  const [activeTab, setActiveTab] = useState<'tools' | 'layers' | 'properties'>('tools');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ action: string; callback: () => void } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [templateCategory, setTemplateCategory] = useState('all');

  // Generate Thumbnail State
  const [showGenerate, setShowGenerate] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [gameScore, setGameScore] = useState(0);
  const [gameDots, setGameDots] = useState<{ id: number; x: number; y: number; color: string; size: number }[]>([]);
  const gameNextId = useRef(0);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! 👋 I\'m your AI thumbnail assistant. Tell me what you want to add or change, and I\'ll help you edit your thumbnail. Try something like "remove the background", "add bold text saying AWESOME", or "change background to space".',
      timestamp: Date.now(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inlineEditingElement = inlineTextEditor
    ? elements.find((element) => element.id === inlineTextEditor.id && element.type === 'text')
    : null;

  // Canvas resizing
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const parent = containerRef.current.parentElement;
      const parentWidth = parent?.clientWidth || 800;
      const parentHeight = parent?.clientHeight || 600;
      const maxWidth = parentWidth - 64;  // p-8 = 32px each side
      const maxHeight = parentHeight - 64;
      const scale = Math.min(maxWidth / canvasWidth, maxHeight / canvasHeight, 1);
      setStageScale(Math.max(scale, 0.3)); // Min scale of 0.3
    };

    handleResize();
    const timer = setTimeout(handleResize, 100);
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasWidth]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (!inlineTextEditor) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      textEditorRef.current?.focus();
      textEditorRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [inlineTextEditor]);

  useEffect(() => {
    if (!inlineTextEditor) {
      return;
    }

    const activeTextStillExists = elements.some((element) => element.id === inlineTextEditor.id && element.type === 'text');
    if (!activeTextStillExists) {
      setInlineTextEditor(null);
    }
  }, [elements, inlineTextEditor]);

  useEffect(() => {
    if (!inlineTextEditor || !inlineEditingElement || !textMeasureRef.current) {
      setInlineTextEditorDimensions(null);
      return;
    }

    const measuredWidth = Math.ceil(textMeasureRef.current.offsetWidth);
    const measuredHeight = Math.ceil(textMeasureRef.current.offsetHeight);

    setInlineTextEditorDimensions({
      width: Math.max(inlineEditingElement.width, measuredWidth + 16),
      height: Math.max(inlineEditingElement.height, measuredHeight + 12, inlineEditingElement.fontSize || 32),
    });
  }, [inlineTextEditor, inlineEditingElement]);

  // Simulated progress bar while generating
  useEffect(() => {
    if (!isGenerating) {
      return;
    }
    setGenProgress(0);
    const totalMs = 28000;
    const intervalMs = 250;
    const steps = totalMs / intervalMs;
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      const pct = Math.min(90, Math.round((1 - Math.pow(1 - current / steps, 1.8)) * 90));
      setGenProgress(pct);
      if (pct >= 90) clearInterval(timer);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Mini game dot spawner while generating
  useEffect(() => {
    if (!isGenerating) {
      setGameScore(0);
      setGameDots([]);
      return;
    }
    const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];
    const spawn = setInterval(() => {
      const id = gameNextId.current++;
      const size = 28 + Math.floor(Math.random() * 24);
      const x = 4 + Math.random() * 82;
      const y = 4 + Math.random() * 82;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      setGameDots(prev => [...prev.slice(-14), { id, x, y, color, size }]);
      setTimeout(() => setGameDots(prev => prev.filter(d => d.id !== id)), 1600);
    }, 750);
    return () => clearInterval(spawn);
  }, [isGenerating]);

  // Helper functions
  const generateId = () => `element-${Date.now()}-${Math.random()}`;

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const applyFilterPreset = (filterId: FilterPreset['id']) => {
    const preset = FILTER_PRESET_LOOKUP[filterId];
    if (!preset) return;

    setElements((prev) => transformElementsForFilter(prev, preset));
    setBackground((prev) => ({
      ...prev,
      type: prev.imageSrc ? 'image' : 'solid',
      color: preset.background.color,
      overlayColor: preset.background.overlayColor,
      overlayOpacity: preset.background.overlayOpacity,
    }));
    showNotification(`${preset.name} filter applied!`);
  };

  // AI Command Executor
  const executeCommand = (command: AICommand) => {
    const { action, params } = command;

    switch (action) {
      case 'add-text': {
        const newElement: CanvasElement = {
          id: generateId(),
          type: 'text',
          x: (params?.x) || canvasWidth / 2 - 100,
          y: (params?.y) || canvasHeight / 2 - 30,
          width: 200,
          height: 60,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          text: params?.text || 'Your Text Here',
          fontSize: params?.fontSize || 48,
          fontFamily: withEmojiFontFallback(params?.fontFamily || DEFAULT_TEXT_FONT_FAMILY),
          fontWeight: params?.fontWeight || 'bold',
          fill: params?.color || '#FFFFFF',
          opacity: 1,
          visible: true,
          locked: false,
        };
        setElements((prev) => [...prev, newElement]);
        setSelectedId(newElement.id);
        showNotification('Text added!');
        break;
      }

      case 'add-shape': {
        const newElement: CanvasElement = {
          id: generateId(),
          type: 'shape',
          x: (params?.x) || Math.random() * (canvasWidth - 200),
          y: (params?.y) || Math.random() * (canvasHeight - 200),
          width: params?.size || 150,
          height: params?.size || 150,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          fill: params?.color || '#' + Math.floor(Math.random() * 16777215).toString(16),
          opacity: 1,
          visible: true,
          locked: false,
          shapeType: params?.shapeType || 'rect',
        };
        setElements((prev) => [...prev, newElement]);
        setSelectedId(newElement.id);
        showNotification(`${params?.shapeType || 'shape'} added!`);
        break;
      }

      case 'delete': {
        if (selectedId) {
          setElements((prev) => prev.filter((el) => el.id !== selectedId));
          setSelectedId(null);
          showNotification('Element deleted');
        }
        break;
      }

      case 'change-background': {
        const bgColor = params?.color || params?.colors?.[0] || '#1a1a1a';
        setBackground({ type: params?.type || 'solid', color: bgColor });
        showNotification('Background changed!');
        break;
      }

      case 'change-property': {
        if (selectedId && params) {
          updateElement(selectedId, params);
          showNotification('Property updated!');
        }
        break;
      }

      case 'clear-all': {
        setElements([]);
        setBackground({ type: 'solid', color: '#1a1a1a', overlayColor: undefined, overlayOpacity: 0 });
        setSelectedId(null);
        showNotification('Canvas cleared!');
        break;
      }

      case 'apply-filter': {
        const filterId = resolveFilterPresetId(params?.filter || params?.style || params?.name);
        if (filterId) {
          applyFilterPreset(filterId);
        } else {
          showNotification('That filter is not available yet.', 'info');
        }
        break;
      }

      default:
        break;
    }
  };

  const executeAICommand = async (userMessage: string) => {
    setIsAIProcessing(true);

    try {
      const apiKey = readUserScopedStorageValue('app_groq_key', uid) || import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: 'I need a Groq API key to help you. Get one free at console.groq.com, then add it in Settings > Privacy > API Keys.',
            timestamp: Date.now(),
          },
        ]);
        setIsAIProcessing(false);
        return;
      }

      const systemPrompt = `You are an AI assistant helping users design YouTube thumbnails in a canvas editor. You MUST respond with ONLY a valid JSON object — no prose, no markdown, no explanation outside the JSON.

Available actions:
1. add-text — params: { text, fontSize (number), color (hex), fontFamily }
2. add-shape — params: { shapeType ("rect"|"circle"|"star"|"triangle"), color (hex), size (number) }
3. delete — no params (removes selected element)
4. change-background — params: { type: "solid", color (hex) }
5. change-property — params: { [property]: value } applied to selected element
6. clear-all — no params
7. apply-filter — params: { filter: "fortnite"|"cartoon"|"3d"|"neon"|"noir"|"anime"|"cinematic"|"vaporwave"|"realistic" }
8. none — when no canvas action is needed

Response format (STRICT — only output this JSON, nothing else):
{"action":"<action>","params":{},"explanation":"<one short friendly sentence>"}

Examples:
User: add a red circle -> {"action":"add-shape","params":{"shapeType":"circle","color":"#FF0000","size":150},"explanation":"Added a red circle to the canvas!"}
User: add bold text saying AMAZING -> {"action":"add-text","params":{"text":"AMAZING","fontSize":72,"color":"#FFFFFF","fontWeight":"bold"},"explanation":"Added bold white text saying AMAZING!"}
User: space background -> {"action":"change-background","params":{"type":"solid","color":"#0a0a2e"},"explanation":"Changed background to a deep space blue!"}
User: add a spaceship -> {"action":"add-shape","params":{"shapeType":"star","color":"#C0C0C0","size":150},"explanation":"Added a silver star shape to represent a spaceship!"}
User: add a vehicle -> {"action":"add-shape","params":{"shapeType":"rect","color":"#222222","size":200},"explanation":"Added a dark rectangle to represent a vehicle!"}
User: add fortnite filter -> {"action":"apply-filter","params":{"filter":"fortnite"},"explanation":"Applied the Fortnite look with punchy gaming colors!"}
User: make this cartoon -> {"action":"apply-filter","params":{"filter":"cartoon"},"explanation":"Applied a cartoon-style filter with bright comic contrast!"}
User: make it anime -> {"action":"apply-filter","params":{"filter":"anime"},"explanation":"Applied an anime-style look with bold cel-shaded contrast!"}
User: make this cinematic -> {"action":"apply-filter","params":{"filter":"cinematic"},"explanation":"Applied a cinematic filter with dramatic contrast and film-style depth!"}

Rules:
- NEVER write prose outside the JSON
- For space/galaxy, use dark colors like #0a0a2e, #110022, #000010
- When the user asks for a look, style, filter, vibe, or aesthetic that matches fortnite/cartoon/3d/neon/noir/anime/cinematic/vaporwave/realistic, prefer apply-filter
- Default text color is #FFFFFF, default shape size is 150`;

      // Groq API — free tier, 14,400 req/day, llama-3.3-70b
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      const aiResponse = (data.choices?.[0]?.message?.content as string | undefined);

      if (!aiResponse) {
        throw new Error('No response from AI. Check your API key or quota.');
      }

      let parsedCommand: AICommand = { action: 'none' };
      let explanation = aiResponse;

      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsedCommand = parsed;
          explanation = parsed.explanation || aiResponse;
        }
      } catch (e) {
        explanation = aiResponse;
      }

      // Fallback: if AI ignored JSON format, parse keywords from plain text
      if (parsedCommand.action === 'none') {
        const msg = userMessage.toLowerCase();
        const resp = aiResponse.toLowerCase();
        const combined = msg + ' ' + resp;
        if (/add.*text|write|title|heading|label/.test(combined)) {
          const textMatch = userMessage.match(/(?:saying|text|write|titled?)\s+["']?([A-Za-z0-9 !?]+)["']?/i);
          parsedCommand = { action: 'add-text', params: { text: textMatch?.[1] || 'TEXT', fontSize: 72, color: '#FFFFFF', fontWeight: 'bold' } };
          explanation = explanation || 'Added text to the canvas!';
        } else if (/add.*star|spaceship|space ship|rocket/.test(combined)) {
          parsedCommand = { action: 'add-shape', params: { shapeType: 'star', color: '#C0C0C0', size: 150 } };
          explanation = explanation || 'Added a star shape to the canvas!';
        } else if (/add.*circle|round/.test(combined)) {
          parsedCommand = { action: 'add-shape', params: { shapeType: 'circle', color: '#FF5555', size: 150 } };
          explanation = explanation || 'Added a circle to the canvas!';
        } else if (/add.*rect|square|box|vehicle|car|truck/.test(combined)) {
          parsedCommand = { action: 'add-shape', params: { shapeType: 'rect', color: '#333333', size: 200 } };
          explanation = explanation || 'Added a rectangle to the canvas!';
        } else if (/add.*triangle/.test(combined)) {
          parsedCommand = { action: 'add-shape', params: { shapeType: 'triangle', color: '#FFaa00', size: 150 } };
          explanation = explanation || 'Added a triangle to the canvas!';
        } else if (/background|bg/.test(combined)) {
          const colorMap: Record<string, string> = { space: '#0a0a2e', red: '#8B0000', blue: '#003366', black: '#000000', white: '#FFFFFF', green: '#003300', purple: '#1a0030', dark: '#111111' };
          let color = '#1a1a1a';
          for (const [k, v] of Object.entries(colorMap)) { if (combined.includes(k)) { color = v; break; } }
          parsedCommand = { action: 'change-background', params: { type: 'solid', color } };
          explanation = explanation || 'Changed the background!';
        } else {
          const filterId = resolveFilterPresetId(combined);
          if (filterId) {
            parsedCommand = { action: 'apply-filter', params: { filter: filterId } };
            explanation = explanation || `Applied the ${FILTER_PRESET_LOOKUP[filterId].name} filter!`;
          }
        }
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: explanation,
          timestamp: Date.now(),
        },
      ]);

      if (parsedCommand.action !== 'none') {
        executeCommand(parsedCommand);
      }
    } catch (error) {
      console.error('AI Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setChatMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: `❌ ${errorMessage}`,
          timestamp: Date.now(),
        },
      ]);
    }

    setIsAIProcessing(false);
  };

  const generateThumbnailFromPrompt = async () => {
    if (!generatePrompt.trim()) return;
    setIsGenerating(true);

    try {
      const enhancedPrompt = `youtube thumbnail, ${generatePrompt}, high quality, vivid colors, eye-catching, professional design, 16:9 ratio`;

      // Step 1: Submit job to AI Horde — 100% free, no account/key needed
      const submitRes = await fetch('https://stablehorde.net/api/v2/generate/async', {
        method: 'POST',
        headers: {
          'apikey': '0000000000',
          'Content-Type': 'application/json',
          'Client-Agent': 'TubeFlow:1.0:anonymous',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          params: {
            width: 1024,
            height: 576,
            steps: 20,
            n: 1,
            sampler_name: 'k_euler',
            cfg_scale: 7,
          },
          models: ['SDXL 1.0'],
          r2: false,
          shared: false,
        }),
      });

      if (!submitRes.ok) {
        const errData = await submitRes.json().catch(() => ({})) as { message?: string };
        throw new Error(errData.message || `Submit failed (${submitRes.status})`);
      }

      const { id } = await submitRes.json() as { id: string };
      if (!id) throw new Error('No job ID returned');

      // Step 2: Poll every 3 s until done
      let done = false;
      let faulted = false;
      let attempts = 0;

      while (!done && !faulted && attempts < 80) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;
        const checkRes = await fetch(`https://stablehorde.net/api/v2/generate/check/${id}`, {
          headers: { 'apikey': '0000000000', 'Client-Agent': 'TubeFlow:1.0:anonymous' },
        });
        const status = await checkRes.json() as { done: boolean; faulted: boolean };
        done = status.done;
        faulted = status.faulted;
      }

      if (faulted) throw new Error('Worker failed — try again');
      if (!done) throw new Error('Generation timed out — try again');

      // Step 3: Fetch final result
      const resultRes = await fetch(`https://stablehorde.net/api/v2/generate/status/${id}`, {
        headers: { 'apikey': '0000000000', 'Client-Agent': 'TubeFlow:1.0:anonymous' },
      });
      const result = await resultRes.json() as { generations?: { img: string }[] };
      const generation = result.generations?.[0];
      if (!generation?.img) throw new Error('No image in response — try again');

      // Step 4: Convert base64 / URL to blob URL
      let blobUrl: string;
      if (generation.img.startsWith('http')) {
        const imgRes = await fetch(generation.img);
        const blob = await imgRes.blob();
        blobUrl = URL.createObjectURL(blob);
      } else {
        const byteString = atob(generation.img);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: 'image/webp' });
        blobUrl = URL.createObjectURL(blob);
      }

      const imageElement: CanvasElement = {
        id: generateId(),
        type: 'image',
        x: 0,
        y: 0,
        width: canvasWidth,
        height: canvasHeight,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        fill: '#000000',
        opacity: 1,
        visible: true,
        locked: false,
        src: blobUrl,
      };

      setBackground({ type: 'solid', color: '#000000' });
      setElements([imageElement]);
      setSelectedId(null);

      setGenProgress(100);
      await new Promise(r => setTimeout(r, 400));
      showNotification('Thumbnail generated! Add text on top via the Tools tab.', 'success');
      setShowGenerate(false);
      setGeneratePrompt('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      showNotification(`❌ ${msg}`, 'info');
    }

    setIsGenerating(false);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim()) return;

    setChatMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'user',
        content: chatInput,
        timestamp: Date.now(),
      },
    ]);

    await executeAICommand(chatInput);
    setChatInput('');
  };

  const confirm = (action: string, callback: () => void) => {
    setShowConfirm({ action, callback });
  };

  // Add elements
  const addText = () => {
    confirm('Add text to thumbnail?', () => {
      const newElement: CanvasElement = {
        id: generateId(),
        type: 'text',
        x: canvasWidth / 2 - 100,
        y: canvasHeight / 2 - 30,
        width: 200,
        height: 60,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        text: 'Your Text Here',
        fontSize: 48,
        fontFamily: DEFAULT_TEXT_FONT_FAMILY,
        fontWeight: 'bold',
        fill: '#FFFFFF',
        opacity: 1,
        visible: true,
        locked: false,
      };
      setElements([...elements, newElement]);
      setSelectedId(newElement.id);
      showNotification('Text added!');
    });
  };

  const addShape = (shapeType: 'rect' | 'circle' | 'star') => {
    confirm(`Add ${shapeType} to thumbnail?`, () => {
      const newElement: CanvasElement = {
        id: generateId(),
        type: 'shape',
        x: Math.random() * (canvasWidth - 200),
        y: Math.random() * (canvasHeight - 200),
        width: 150,
        height: 150,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        fill: '#' + Math.floor(Math.random() * 16777215).toString(16),
        opacity: 1,
        visible: true,
        locked: false,
        shapeType,
      };
      setElements([...elements, newElement]);
      setSelectedId(newElement.id);
      showNotification(`${shapeType} added!`);
    });
  };

  const uploadImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event: any) => {
        // Set as background image so template content stays on top
        setBackground(prev => ({ ...prev, type: 'image', imageSrc: event.target.result }));
        showNotification('Background image set!');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    setElements(elements.map(el => (el.id === id ? { ...el, ...updates } : el)));
  };

  const startInlineTextEditing = (element: CanvasElement) => {
    if (element.type !== 'text' || element.locked) {
      setSelectedId(element.id);
      return;
    }

    setSelectedId(element.id);
    setActiveTab('properties');
    setInlineTextEditor({
      id: element.id,
      value: element.text || '',
    });
  };

  const finishInlineTextEditing = (mode: 'save' | 'cancel' = 'save') => {
    if (!inlineTextEditor) {
      return;
    }

    if (mode === 'save') {
      updateElement(inlineTextEditor.id, { text: inlineTextEditor.value });
    }

    setInlineTextEditor(null);
    setInlineTextEditorDimensions(null);
  };

  const deleteElement = (id: string) => {
    confirm('Delete this element?', () => {
      setElements(elements.filter(el => el.id !== id));
      if (selectedId === id) setSelectedId(null);
      showNotification('Element deleted');
    });
  };

  const toggleVisibility = (id: string) => {
    const element = elements.find(el => el.id === id);
    if (element) {
      updateElement(id, { visible: !element.visible });
    }
  };

  const toggleLock = (id: string) => {
    const element = elements.find(el => el.id === id);
    if (element) {
      updateElement(id, { locked: !element.locked });
    }
  };

  const reorderLayer = (id: string, direction: 'up' | 'down') => {
    const index = elements.findIndex(el => el.id === id);
    if ((direction === 'up' && index < elements.length - 1) || (direction === 'down' && index > 0)) {
      const newElements = [...elements];
      const moveIndex = direction === 'up' ? index + 1 : index - 1;
      [newElements[index], newElements[moveIndex]] = [newElements[moveIndex], newElements[index]];
      setElements(newElements);
      showNotification(`Layer moved ${direction}`);
    }
  };

  const applyTemplate = (template: Template) => {
    confirm(`Apply "${template.name}" template?`, () => {
      const { elements: templateElements, background: templateBg } = template.preset(canvasWidth, canvasHeight);
      setElements(templateElements);
      // Preserve any uploaded background image; only update color/gradient
      setBackground(prev => ({
        ...templateBg,
        ...(prev.imageSrc ? { type: 'image' as const, imageSrc: prev.imageSrc } : {}),
        overlayColor: templateBg.overlayColor,
        overlayOpacity: templateBg.overlayOpacity,
      }));
      setSelectedId(null);
      setInlineTextEditor(null);
      setShowTemplates(false);
      showNotification(`Template "${template.name}" applied!`);
    });
  };

  const exportThumbnail = (format: typeof EXPORT_FORMATS[0]) => {
    confirm(`Export as ${format.name} (${format.width}x${format.height})?`, () => {
      if (!stageRef.current) return;
      const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = uri;
      a.download = `thumbnail_${format.name}_${Date.now()}.png`;
      a.click();
      showNotification(`Exported as ${format.name}!`);
      setShowExport(false);
    });
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  // Render element in canvas
  const renderCanvasElement = (element: CanvasElement, isSelected: boolean) => {
    if (!element.visible) return null;

    if (element.type === 'text') {
      return (
        <KonvaText
          key={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          text={element.text}
          fontSize={element.fontSize}
          fontFamily={withEmojiFontFallback(element.fontFamily)}
          fontStyle={element.fontWeight}
          fill={element.fill}
          opacity={element.opacity}
          rotation={element.rotation}
          scaleX={element.scaleX}
          scaleY={element.scaleY}
          {...getShadowProps(element)}
          draggable={!element.locked}
          onClick={() => startInlineTextEditing(element)}
          onTap={() => startInlineTextEditing(element)}
          onDragEnd={(e) => {
            updateElement(element.id, { x: e.target.x(), y: e.target.y() });
          }}
        />
      );
    }

    if (element.type === 'shape') {
      if (element.shapeType === 'circle') {
        return (
          <KonvaCircle
            key={element.id}
            x={element.x}
            y={element.y}
            radius={element.width / 2}
            fill={element.fill}
            opacity={element.opacity}
            rotation={element.rotation}
            {...getShadowProps(element)}
            draggable={!element.locked}
            onClick={() => setSelectedId(element.id)}
            onDragEnd={(e) => {
              updateElement(element.id, { x: e.target.x(), y: e.target.y() });
            }}
          />
        );
      }
      if (element.shapeType === 'star') {
        return (
          <KonvaStar
            key={element.id}
            x={element.x}
            y={element.y}
            numPoints={5}
            innerRadius={30}
            outerRadius={element.width / 2}
            fill={element.fill}
            opacity={element.opacity}
            rotation={element.rotation}
            {...getShadowProps(element)}
            draggable={!element.locked}
            onClick={() => setSelectedId(element.id)}
            onDragEnd={(e) => {
              updateElement(element.id, { x: e.target.x(), y: e.target.y() });
            }}
          />
        );
      }
      if (element.shapeType === 'triangle') {
        return (
          <KonvaRegularPolygon
            key={element.id}
            x={element.x}
            y={element.y}
            sides={3}
            radius={element.width / 2}
            fill={element.fill}
            opacity={element.opacity}
            rotation={element.rotation}
            {...getShadowProps(element)}
            draggable={!element.locked}
            onClick={() => setSelectedId(element.id)}
            onDragEnd={(e) => { updateElement(element.id, { x: e.target.x(), y: e.target.y() }); }}
          />
        );
      }
      if (element.shapeType === 'diamond') {
        return (
          <KonvaRegularPolygon
            key={element.id}
            x={element.x}
            y={element.y}
            sides={4}
            radius={element.width / 2}
            fill={element.fill}
            opacity={element.opacity}
            rotation={element.rotation + 45}
            {...getShadowProps(element)}
            draggable={!element.locked}
            onClick={() => setSelectedId(element.id)}
            onDragEnd={(e) => { updateElement(element.id, { x: e.target.x(), y: e.target.y() }); }}
          />
        );
      }
      if (element.shapeType === 'pentagon') {
        return (
          <KonvaRegularPolygon
            key={element.id}
            x={element.x}
            y={element.y}
            sides={5}
            radius={element.width / 2}
            fill={element.fill}
            opacity={element.opacity}
            rotation={element.rotation}
            {...getShadowProps(element)}
            draggable={!element.locked}
            onClick={() => setSelectedId(element.id)}
            onDragEnd={(e) => { updateElement(element.id, { x: e.target.x(), y: e.target.y() }); }}
          />
        );
      }
      if (element.shapeType === 'hexagon') {
        return (
          <KonvaRegularPolygon
            key={element.id}
            x={element.x}
            y={element.y}
            sides={6}
            radius={element.width / 2}
            fill={element.fill}
            opacity={element.opacity}
            rotation={element.rotation}
            {...getShadowProps(element)}
            draggable={!element.locked}
            onClick={() => setSelectedId(element.id)}
            onDragEnd={(e) => { updateElement(element.id, { x: e.target.x(), y: e.target.y() }); }}
          />
        );
      }
      return (
        <Rect
          key={element.id}
          x={element.x}
          y={element.y}
          width={element.width}
          height={element.height}
          fill={element.fill}
          opacity={element.opacity}
          rotation={element.rotation}
          scaleX={element.scaleX}
          scaleY={element.scaleY}
          {...getShadowProps(element)}
          draggable={!element.locked}
          onClick={() => setSelectedId(element.id)}
          onDragEnd={(e) => {
            updateElement(element.id, { x: e.target.x(), y: e.target.y() });
          }}
        />
      );
    }

    if (element.type === 'image' && element.src) {
      return (
        <ImageComponent
          key={element.id}
          element={element}
          isSelected={isSelected}
          onSelect={() => setSelectedId(element.id)}
          onUpdate={(updates) => updateElement(element.id, updates)}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/studio')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <div className="relative inline-flex">
                <Figma className="w-6 h-6 text-emerald-500" />
                <span className="absolute -top-2 -right-2 px-1 py-0.5 text-[9px] font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-sm leading-none">BETA</span>
              </div>
              Thumbnail Editor
            </h1>
            <p className="text-xs text-slate-400">Advanced Thumbnail Designer</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-lg text-emerald-400 font-medium transition-colors flex items-center gap-2"
          >
            <Grid className="w-4 h-4" />
            Templates
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg text-blue-400 font-medium transition-colors flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            AI Assistant
          </button>
          <button
            onClick={() => setShowFilters(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
              <Sparkles className="w-4 h-4" />
              Filter
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Canvas Area */}
        <div className="flex-1 bg-[#0a0a0a] p-8 flex items-center justify-center overflow-auto">
          <div
            style={{
              width: `${canvasWidth * stageScale}px`,
              height: `${canvasHeight * stageScale}px`,
              flexShrink: 0,
            }}
          >
          <div
            ref={containerRef}
            className="relative bg-black rounded-lg shadow-2xl border border-slate-800"
            style={{ 
              width: `${canvasWidth}px`, 
              height: `${canvasHeight}px`,
              transform: `scale(${stageScale})`,
              transformOrigin: 'top left',
            }}
          >
            <Stage
              ref={stageRef}
              width={canvasWidth}
              height={canvasHeight}
              onMouseDown={(e) => {
                const clickedOnEmpty = e.target === e.target.getStage();
                if (clickedOnEmpty) {
                  finishInlineTextEditing('save');
                  setSelectedId(null);
                }
              }}
            >
              {/* Background color/gradient (always drawn first) */}
              <Layer>
                <Rect
                  x={0}
                  y={0}
                  width={canvasWidth}
                  height={canvasHeight}
                  fill={
                    background.type === 'gradient'
                      ? (background.gradientStart || '#1a1a1a')
                      : (background.color || '#1a1a1a')
                  }
                  opacity={background.imageSrc ? 0 : (background.type === 'gradient' ? 0.8 : 1)}
                />
              </Layer>

              {/* Uploaded background image (behind all elements) */}
              {background.imageSrc && (
                <Layer>
                  <BackgroundImageLayer
                    src={background.imageSrc}
                    width={canvasWidth}
                    height={canvasHeight}
                  />
                </Layer>
              )}

              {(background.overlayColor && (background.overlayOpacity ?? 0) > 0) && (
                <Layer>
                  <Rect
                    x={0}
                    y={0}
                    width={canvasWidth}
                    height={canvasHeight}
                    fill={background.overlayColor}
                    opacity={background.overlayOpacity}
                    listening={false}
                  />
                </Layer>
              )}

              {/* Elements (text, shapes — always on top of background image) */}
              <Layer>
                {elements.map((el) => renderCanvasElement(el, el.id === selectedId))}
              </Layer>
            </Stage>
            {inlineEditingElement && (
              <>
                <div
                  ref={textMeasureRef}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 top-0 whitespace-pre-wrap break-words px-2 py-1 opacity-0"
                  style={{
                    width: Math.max(inlineEditingElement.width, 140),
                    fontSize: inlineEditingElement.fontSize,
                    fontFamily: withEmojiFontFallback(inlineEditingElement.fontFamily),
                    fontWeight: inlineEditingElement.fontWeight as any,
                    lineHeight: 1,
                  }}
                >
                  {(inlineTextEditor?.value || ' ').replace(/\n$/g, '\n ')}
                </div>
                <textarea
                  ref={textEditorRef}
                  value={inlineTextEditor?.value || ''}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setInlineTextEditor((current) => current ? { ...current, value: nextValue } : current);
                  }}
                  onBlur={() => finishInlineTextEditing('save')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      finishInlineTextEditing('save');
                    }

                    if (e.key === 'Escape') {
                      e.preventDefault();
                      finishInlineTextEditing('cancel');
                    }
                  }}
                  className="absolute z-20 resize-none overflow-hidden border border-emerald-400/70 bg-slate-950/85 px-2 py-1 text-white outline-none"
                  style={{
                    left: inlineEditingElement.x,
                    top: inlineEditingElement.y,
                    width: inlineTextEditorDimensions?.width || Math.max(inlineEditingElement.width, 140),
                    height: inlineTextEditorDimensions?.height || Math.max(inlineEditingElement.height, inlineEditingElement.fontSize || 32),
                    fontSize: inlineEditingElement.fontSize,
                    fontFamily: withEmojiFontFallback(inlineEditingElement.fontFamily),
                    fontWeight: inlineEditingElement.fontWeight as any,
                    color: inlineEditingElement.fill,
                    lineHeight: 1,
                    opacity: inlineEditingElement.opacity,
                    transform: `rotate(${inlineEditingElement.rotation}deg) scale(${inlineEditingElement.scaleX}, ${inlineEditingElement.scaleY})`,
                    transformOrigin: 'top left',
                    boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.35)',
                  }}
                />
              </>
            )}
          </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-slate-800 bg-slate-900/50 flex flex-col">
          {/* Tabs */}
          <div className="border-b border-slate-800 flex">
            {[
              { id: 'tools', label: 'Tools', icon: Zap },
              { id: 'layers', label: 'Layers', icon: Layers },
              { id: 'properties', label: 'Properties', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <div className="space-y-3">
                <button
                  onClick={addText}
                  className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Type className="w-5 h-5 text-blue-400" />
                  <span>Add Text</span>
                </button>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400">Shapes</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: Square, type: 'rect', label: 'Rectangle' },
                      { icon: Circle, type: 'circle', label: 'Circle' },
                      { icon: Star, type: 'star', label: 'Star' },
                      { icon: Triangle, type: 'triangle', label: 'Triangle' },
                      { icon: Diamond, type: 'diamond', label: 'Diamond' },
                      { icon: Hexagon, type: 'hexagon', label: 'Hexagon' },
                      { icon: Octagon, type: 'pentagon', label: 'Pentagon' },
                    ].map((shape) => {
                      const Icon = shape.icon;
                      return (
                        <button
                          key={shape.type}
                          onClick={() => addShape(shape.type as any)}
                          className="flex flex-col items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors gap-1"
                          title={shape.label}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-[9px] text-slate-400">{shape.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  onClick={uploadImage}
                  className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                  <span>Upload Image</span>
                </button>
                <button
                  onClick={() => setShowExport(true)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5 text-blue-400" />
                  <span>Export</span>
                </button>

                {background.imageSrc && (
                  <button
                    onClick={() => setBackground(prev => {
                      const { imageSrc: _, ...rest } = prev;
                      return { ...rest, type: 'solid', overlayColor: rest.overlayColor, overlayOpacity: rest.overlayOpacity };
                    })}
                    className="w-full flex items-center gap-3 p-3 bg-slate-800 hover:bg-rose-900/40 border border-rose-500/30 rounded-lg transition-colors text-rose-400"
                  >
                    <X className="w-5 h-5" />
                    <span>Remove Background Image</span>
                  </button>
                )}

                {/* Background */}
                <div className="pt-4 border-t border-slate-700 space-y-3">
                  <p className="text-sm font-semibold">Background</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="color"
                        value={background.color || '#1a1a1a'}
                        onChange={(e) => setBackground(prev => ({ ...prev, type: prev.imageSrc ? 'image' as const : 'solid', color: e.target.value }))}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <span className="text-sm">Tint Color</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="color"
                        value={background.overlayColor || '#000000'}
                        onChange={(e) => setBackground(prev => ({ ...prev, overlayColor: e.target.value, overlayOpacity: prev.overlayOpacity ?? 0.15 }))}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <span className="text-sm">Overlay Color</span>
                    </label>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-2">Overlay Strength</label>
                      <input
                        type="range"
                        min="0"
                        max="0.6"
                        step="0.05"
                        value={background.overlayOpacity ?? 0}
                        onChange={(e) => setBackground(prev => ({ ...prev, overlayOpacity: parseFloat(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Layers Tab */}
            {activeTab === 'layers' && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {elements.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No layers yet</p>
                ) : (
                  elements.map((el, idx) => (
                    <div
                      key={el.id}
                      onClick={() => setSelectedId(el.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedId === el.id
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{el.type}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleVisibility(el.id);
                            }}
                            className="p-1 hover:bg-slate-700 rounded"
                          >
                            {el.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLock(el.id);
                            }}
                            className="p-1 hover:bg-slate-700 rounded"
                          >
                            {el.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-1 mb-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reorderLayer(el.id, 'up');
                          }}
                          className="flex-1 p-1 text-xs bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center gap-1"
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            reorderLayer(el.id, 'down');
                          }}
                          className="flex-1 p-1 text-xs bg-slate-700 hover:bg-slate-600 rounded flex items-center justify-center gap-1"
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteElement(el.id);
                        }}
                        className="w-full p-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Properties Tab */}
            {activeTab === 'properties' && selectedElement && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Color</label>
                  <input
                    type="color"
                    value={selectedElement.fill}
                    onChange={(e) => updateElement(selectedElement.id, { fill: e.target.value })}
                    className="w-full h-10 rounded cursor-pointer"
                  />
                </div>

                {selectedElement.type === 'text' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-2">Text</label>
                      <input
                        type="text"
                        value={selectedElement.text}
                        onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 block mb-2">Font Size</label>
                      <input
                        type="range"
                        min="12"
                        max="120"
                        value={selectedElement.fontSize}
                        onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })}
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={selectedElement.opacity}
                    onChange={(e) => updateElement(selectedElement.id, { opacity: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-2">Rotation</label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={selectedElement.rotation}
                    onChange={(e) => updateElement(selectedElement.id, { rotation: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {activeTab === 'properties' && !selectedElement && (
              <div className="text-center py-8">
                <p className="text-sm text-slate-500">Select an element to edit</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Thumbnail Modal */}
      <AnimatePresence>
        {showGenerate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isGenerating && setShowGenerate(false)}
              className="fixed inset-0 z-40 bg-black/70"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 rounded-2xl border border-slate-700 p-8 w-[480px] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg">
                    <Wand2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Generate Thumbnail</h3>
                    <p className="text-xs text-slate-400">100% free · No account needed · Powered by AI Horde</p>
                  </div>
                </div>
                {!isGenerating && (
                  <button onClick={() => setShowGenerate(false)} className="p-1 hover:bg-slate-800 rounded">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {isGenerating ? (
                /* ── Generating view: progress bar + mini game ── */
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Loader className="w-3 h-3 animate-spin" />
                        Generating your thumbnail…
                      </span>
                      <span className="text-xs font-bold text-violet-400">{genProgress}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500"
                        style={{ width: `${genProgress}%` }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  {/* Mini game */}
                  <div className="rounded-xl bg-slate-950 border border-slate-700 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
                      <span className="text-xs font-semibold text-slate-300">🎮 Kill time — tap the dots!</span>
                      <span className="text-xs font-bold text-yellow-400">Score: {gameScore}</span>
                    </div>
                    <div
                      className="relative w-full select-none"
                      style={{ height: 180 }}
                    >
                      <AnimatePresence>
                        {gameDots.map(dot => (
                          <motion.button
                            key={dot.id}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            onClick={() => {
                              setGameDots(prev => prev.filter(d => d.id !== dot.id));
                              setGameScore(s => s + 1);
                            }}
                            style={{
                              position: 'absolute',
                              left: `${dot.x}%`,
                              top: `${dot.y}%`,
                              width: dot.size,
                              height: dot.size,
                              borderRadius: '50%',
                              background: dot.color,
                              boxShadow: `0 0 12px ${dot.color}99`,
                              cursor: 'pointer',
                              border: 'none',
                              padding: 0,
                              transform: 'translate(-50%, -50%)',
                            }}
                          />
                        ))}
                      </AnimatePresence>
                      {gameDots.length === 0 && (
                        <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-600">Dots incoming…</p>
                      )}
                    </div>
                  </div>
                  <p className="text-center text-xs text-slate-500">Your thumbnail will be ready shortly ✨</p>
                </div>
              ) : (
                /* ── Normal prompt view ── */
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-2">Describe your thumbnail</label>
                    <textarea
                      value={generatePrompt}
                      onChange={(e) => setGeneratePrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) generateThumbnailFromPrompt();
                      }}
                      placeholder="e.g. 'A gaming thumbnail with red background, bold white text saying EPIC WIN, and a glowing effect'"
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-500 focus:border-violet-500 focus:outline-none resize-none h-28"
                    />
                    <p className="text-xs text-slate-500 mt-1">Tip: Press Ctrl+Enter to generate</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Gaming thumbnail with dark background and bold red text',
                      'Minimalist tech tutorial with clean white and blue design',
                      'Fitness motivation thumbnail with energetic orange gradient',
                      'Cooking channel with warm colors and appetizing feel',
                    ].map((example) => (
                      <button
                        key={example}
                        onClick={() => setGeneratePrompt(example)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-400 text-left transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={generateThumbnailFromPrompt}
                    disabled={!generatePrompt.trim()}
                    className="w-full py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Wand2 className="w-4 h-4" />
                    Generate Thumbnail
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Templates Modal */}
      <AnimatePresence>
        {showTemplates && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTemplates(false)}
              className="fixed inset-0 z-40 bg-black/70"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 rounded-2xl border border-slate-700 p-6 w-[780px] max-h-[85vh] flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                    YouTube Thumbnail Templates
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Inspired by real YouTube styles — click any template to apply</p>
                </div>
                <button onClick={() => setShowTemplates(false)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Category Filter */}
              <div className="flex gap-2 flex-wrap mb-4">
                {[
                  { id: 'all', label: 'All', emoji: '🎯' },
                  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
                  { id: 'horror', label: 'Horror', emoji: '👻' },
                  { id: 'story', label: 'Story Time', emoji: '📖' },
                  { id: 'vlog', label: 'Vlog', emoji: '✈️' },
                  { id: 'educational', label: 'Tutorial', emoji: '📚' },
                  { id: 'challenge', label: 'Challenge', emoji: '⚡' },
                  { id: 'reaction', label: 'Reaction', emoji: '😱' },
                  { id: 'food', label: 'Cooking', emoji: '🍳' },
                  { id: 'fitness', label: 'Fitness', emoji: '💪' },
                  { id: 'minimal', label: 'Minimal', emoji: '✨' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setTemplateCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${
                      templateCategory === cat.id
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Template Grid */}
              <div className="overflow-y-auto flex-1 pr-1">
                <div className="grid grid-cols-3 gap-3">
                  {TEMPLATES.filter(t => templateCategory === 'all' || t.category === templateCategory).map((template) => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="group bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-emerald-500/50 rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-emerald-500/10 text-left"
                    >
                      {/* Preview */}
                      <div
                        className="w-full relative overflow-hidden"
                        style={{ background: template.previewBg, height: '110px' }}
                      >
                        {/* Simulated layout bars */}
                        <div className="absolute inset-0 p-3 flex flex-col gap-1.5 justify-center">
                          <div className="h-5 rounded opacity-70 w-4/5" style={{ backgroundColor: template.textColor }} />
                          <div className="h-3 rounded opacity-40 w-3/5" style={{ backgroundColor: template.textColor }} />
                          <div className="h-2 rounded opacity-25 w-2/5" style={{ backgroundColor: template.textColor }} />
                        </div>
                        {/* Emoji badge */}
                        <div className="absolute top-2 right-2 text-2xl">{template.emoji}</div>
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors flex items-center justify-center">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                            Apply
                          </span>
                        </div>
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="font-semibold text-sm text-white">{template.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5 leading-tight">{template.description}</p>
                        <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 capitalize">
                          {template.category}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                {TEMPLATES.filter(t => templateCategory === 'all' || t.category === templateCategory).length === 0 && (
                  <div className="text-center py-12 text-slate-500">No templates in this category</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 z-40 bg-black/70"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 rounded-2xl border border-slate-700 p-6 w-[720px] max-h-[85vh] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                    Filter Styles
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Pick a look and apply it instantly to your thumbnail.</p>
                </div>
                <button onClick={() => setShowFilters(false)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  {FILTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        applyFilterPreset(preset.id);
                        setShowFilters(false);
                      }}
                      className="rounded-xl border border-slate-700 bg-slate-800/80 hover:border-emerald-500/40 hover:bg-slate-800 transition-all text-left p-4"
                    >
                      <div
                        className="h-24 rounded-lg mb-3 border border-white/5"
                        style={{
                          background: `linear-gradient(135deg, ${preset.background.color} 0%, ${preset.accent} 100%)`,
                        }}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold text-white">{preset.name}</span>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: preset.accent }} />
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExport && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExport(false)}
              className="fixed inset-0 z-40 bg-black/70"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 rounded-xl border border-slate-700 p-8 w-96"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Export Thumbnail</h3>
                <button onClick={() => setShowExport(false)} className="p-1 hover:bg-slate-800 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {EXPORT_FORMATS.map((format) => (
                  <button
                    key={format.name}
                    onClick={() => exportThumbnail(format)}
                    className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left transition-colors"
                  >
                    <p className="font-semibold text-sm">{format.name}</p>
                    <p className="text-xs text-slate-400">{format.width}x{format.height}px</p>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 rounded-xl border border-slate-700 p-8 w-80"
            >
              <p className="text-center mb-6">{showConfirm.action}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    showConfirm.callback();
                    setShowConfirm(null);
                  }}
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Confirm
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed bottom-6 right-6 z-50 px-6 py-3 rounded-lg font-medium flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {notification.type === 'success' ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Chat Sidebar */}
      <AnimatePresence>
        {showChat && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChat(false)}
              className="fixed inset-0 z-40 bg-black/40"
            />
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-96 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl"
            >
              {/* Chat Header */}
              <div className="border-b border-slate-800 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold">AI Assistant</h3>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-1 hover:bg-slate-800 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages Display */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-100 border border-slate-700'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isAIProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-slate-100 border border-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                      <Loader className="w-4 h-4 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-slate-800 p-4 space-y-3">
                <p className="text-xs text-slate-400">
                  💡 Tip: Try "add fortnite filter", "make this cartoon", "make it anime", "give it a cinematic look", or "put me in space"
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
                    placeholder="Describe your changes..."
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    disabled={isAIProcessing}
                  />
                  <button
                    onClick={handleChatSubmit}
                    disabled={isAIProcessing || !chatInput.trim()}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
};

export default CreatorLabPage;
