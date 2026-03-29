import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Type,
  Square,
  Circle,
  Star,
  Upload,
  Palette,
  Layers,
  Download,
  Save,
  X,
  Check,
  Zap,
  Settings,
  Grid,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Plus,
  Image as ImageIcon,
  Maximize2,
  Volume2,
  Sparkles,
  Figma,
  MessageCircle,
  Send,
  Loader,
  Bot,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Stage, Layer, Rect, Circle as KonvaCircle, Star as KonvaStar, Text as KonvaText, Image as KonvaImage, Transformer } from 'react-konva';
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
  shapeType?: 'rect' | 'circle' | 'star';
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
}

interface Template {
  id: string;
  name: string;
  description: string;
  preset: (width: number, height: number) => { elements: CanvasElement[]; background: BackgroundStyle };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AICommand {
  action: 'add-text' | 'add-shape' | 'delete' | 'change-background' | 'change-property' | 'clear-all' | 'none';
  params?: Record<string, any>;
}

// Template Presets
const TEMPLATES: Template[] = [
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Bold gaming thumbnail style',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#FF0000' },
      elements: [
        {
          id: '1',
          type: 'text',
          x: w / 2 - 150,
          y: h / 2 - 50,
          width: 300,
          height: 100,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          text: 'INSANE',
          fontSize: 72,
          fontFamily: 'Impact',
          fontWeight: 'bold',
          fill: '#FFFFFF',
          opacity: 1,
          visible: true,
          locked: false,
          shadowBlur: 5,
          shadowColor: '#000000',
          shadowOpacity: 0.8,
          shadowOffsetX: 2,
          shadowOffsetY: 2,
        },
      ],
    }),
  },
  {
    id: 'vlog',
    name: 'Vlog Style',
    description: 'Clean vlog layout',
    preset: (w, h) => ({
      background: { type: 'gradient', gradientStart: '#667eea', gradientEnd: '#764ba2' },
      elements: [
        {
          id: '1',
          type: 'shape',
          x: w / 2 - 100,
          y: h / 2 - 100,
          width: 200,
          height: 200,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          fill: '#FFFFFF',
          opacity: 0.1,
          visible: true,
          locked: false,
          shapeType: 'circle',
        },
      ],
    }),
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Minimal modern design',
    preset: (w, h) => ({
      background: { type: 'solid', color: '#1a1a1a' },
      elements: [],
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

// Image Component for Konva
interface ImageComponentProps {
  element: CanvasElement;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<CanvasElement>) => void;
}

const ImageComponent = ({ element, isSelected, onSelect, onUpdate }: ImageComponentProps) => {
  const [image] = useImage(element.src || '', 'anonymous');
  
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
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);

  // optional: state to hold Gemini response
  // Canvas State
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const [canvasHeight, setCanvasHeight] = useState(720);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundStyle>({ type: 'solid', color: '#1a1a1a' });
  const [stageScale, setStageScale] = useState(1);

  // UI State
  const [activeTab, setActiveTab] = useState<'tools' | 'layers' | 'properties'>('tools');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showConfirm, setShowConfirm] = useState<{ action: string; callback: () => void } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

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

  // Canvas resizing
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const parentWidth = containerRef.current.parentElement?.clientWidth || 800;
      const maxWidth = parentWidth - 32; // Account for padding
      const scale = Math.min(maxWidth / canvasWidth, 1);
      setStageScale(Math.max(scale, 0.4)); // Min scale of 0.4
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

  // Helper functions
  const generateId = () => `element-${Date.now()}-${Math.random()}`;

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
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
          fontFamily: params?.fontFamily || 'Arial',
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
        setBackground({ type: 'solid', color: '#1a1a1a' });
        setSelectedId(null);
        showNotification('Canvas cleared!');
        break;
      }

      default:
        break;
    }
  };

  const executeAICommand = async (userMessage: string) => {
    setIsAIProcessing(true);

    try {
      const apiKey = localStorage.getItem('app_gemini_key') || process.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: 'I need your Gemini API key to help you. Please add it in Settings > Privacy > API Keys.',
            timestamp: Date.now(),
          },
        ]);
        setIsAIProcessing(false);
        return;
      }

      const systemPrompt = `You are an AI assistant helping users design YouTube thumbnails in a canvas editor.
You have access to these tools:
1. add-text: Add text to the thumbnail (params: text, fontSize, color, fontFamily)
2. add-shape: Add shapes like rectangle, circle, or star (params: shapeType, color, size)
3. delete: Remove the selected element 
4. change-background: Change the background (params: type 'solid', color)
5. change-property: Modify element properties (params: property, value)
6. clear-all: Remove everything from canvas

When the user describes what they want, interpret their request and respond with EXACTLY this JSON format (no markdown, pure JSON only):
{
  "action": "add-text" | "add-shape" | "delete" | "change-background" | "change-property" | "clear-all" | "none",
  "params": {...},
  "explanation": "Human-friendly explanation of what you did"
}

Rules:
- Be concise and friendly
- If the user says "remove", use delete or clear-all
- If they mention space/galaxy/stars background, use solid color with space theme colors (dark blue, black, purple)
- Default colors: white text, bold font, center position for text
- Extract colors from descriptions (red, blue, white, gold, space, galaxy, etc.)
- Always confirm what you're about to do
- For text colors: white for bright backgrounds, black/gold for dark backgrounds`;

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              parts: [
                {
                  text: userMessage,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`API Error: ${data.error.message}`);
      }

      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
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
        fontFamily: 'Arial',
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
      const reader = new FileReader();
      reader.onload = (event: any) => {
        confirm('Add image to thumbnail?', () => {
          const newElement: CanvasElement = {
            id: generateId(),
            type: 'image',
            x: Math.random() * (canvasWidth - 200),
            y: Math.random() * (canvasHeight - 200),
            width: 300,
            height: 300,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            fill: '#FFFFFF',
            opacity: 1,
            visible: true,
            locked: false,
            src: event.target.result,
          };
          setElements([...elements, newElement]);
          setSelectedId(newElement.id);
          showNotification('Image added!');
        });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    setElements(elements.map(el => (el.id === id ? { ...el, ...updates } : el)));
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
      setBackground(templateBg);
      setSelectedId(null);
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
          fontFamily={element.fontFamily}
          fontStyle={element.fontWeight}
          fill={element.fill}
          opacity={element.opacity}
          rotation={element.rotation}
          scaleX={element.scaleX}
          scaleY={element.scaleY}
          draggable={!element.locked}
          onClick={() => setSelectedId(element.id)}
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
            draggable={!element.locked}
            onClick={() => setSelectedId(element.id)}
            onDragEnd={(e) => {
              updateElement(element.id, { x: e.target.x(), y: e.target.y() });
            }}
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
              <Figma className="w-6 h-6 text-emerald-500" />
              Creator Lab
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
            onClick={() => setShowExport(true)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Canvas Area */}
        <div className="flex-1 bg-[#0a0a0a] p-8 flex items-center justify-center overflow-auto">
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
                if (clickedOnEmpty) setSelectedId(null);
              }}
            >
              {/* Background */}
              <Layer>
                {background.type === 'solid' && (
                  <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill={background.color || '#1a1a1a'} />
                )}
                {background.type === 'gradient' && (
                  <Rect
                    x={0}
                    y={0}
                    width={canvasWidth}
                    height={canvasHeight}
                    fill={background.gradientStart}
                    opacity={0.8}
                  />
                )}
              </Layer>

              {/* Elements */}
              <Layer>
                {elements.map((el) => renderCanvasElement(el, el.id === selectedId))}
              </Layer>
            </Stage>
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
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: Square, type: 'rect', label: 'Rectangle' },
                      { icon: Circle, type: 'circle', label: 'Circle' },
                      { icon: Star, type: 'star', label: 'Star' },
                    ].map((shape) => {
                      const Icon = shape.icon;
                      return (
                        <button
                          key={shape.type}
                          onClick={() => addShape(shape.type as any)}
                          className="flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                          title={shape.label}
                        >
                          <Icon className="w-5 h-5" />
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

                {/* Background */}
                <div className="pt-4 border-t border-slate-700 space-y-3">
                  <p className="text-sm font-semibold">Background</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="color"
                        value={background.color || '#1a1a1a'}
                        onChange={(e) => setBackground({ type: 'solid', color: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer"
                      />
                      <span className="text-sm">Solid Color</span>
                    </label>
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-slate-900 rounded-xl border border-slate-700 p-8 w-96"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Templates</h3>
                <button onClick={() => setShowTemplates(false)} className="p-1 hover:bg-slate-800 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-left transition-colors"
                  >
                    <p className="font-semibold">{template.name}</p>
                    <p className="text-xs text-slate-400">{template.description}</p>
                  </button>
                ))}
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
                  💡 Tip: Tell me what you want! Try "remove the background", "add golden text", or "put me in space"
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
