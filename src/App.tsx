/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Trash2,
  FileText,
  Type,
  Image as ImageIcon,
  Move,
  ZoomIn,
  Zap,
  CheckCircle2,
  AlertCircle,
  Hash,
  Activity,
  Box,
  Layout as LayoutIcon,
  MousePointer2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AppState, 
  DEFAULT_TEXT, 
  RenderingMode, 
  CharacterInfo 
} from './types';
import { computeLayout } from './lib/textEngine';
import { prepareMaskBuffer, computeAutoThreshold, getLuminance } from './lib/imageEngine';

// --- Components ---

const Header = ({ glyphs, resolution, imageLoaded }: { glyphs: number; resolution: string; imageLoaded: boolean }) => (
  <header className="h-12 border-b border-brand-border bg-brand-header flex items-center justify-between px-4 z-50 shrink-0">
    <div className="flex items-center gap-3">
      <div className="text-[12px] font-bold tracking-[0.15em] text-brand-muted uppercase flex items-center gap-1.5">
        CAMO<span className="text-white">TYPE</span> 
        <span className="opacity-30 mx-1">—</span> 
        <span className="text-[10px] font-mono tracking-widest bg-brand-border/50 px-1.5 py-0.5 rounded text-brand-deep-muted font-normal">ENGINE V1.4.2</span>
      </div>
    </div>
    
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <StatBadge label="RESOL" value={resolution} />
        <StatBadge label="GLYPHS" value={glyphs.toLocaleString()} />
        {imageLoaded && (
          <div className="flex items-center gap-2 ml-2 pr-4 border-r border-brand-border h-6">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
            <span className="text-[9px] font-mono text-brand-accent uppercase tracking-widest">Live Engine</span>
          </div>
        )}
      </div>
    </div>
  </header>
);

const StatBadge = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[#222] px-2 py-1 rounded-sm border border-white/5 flex items-center gap-2">
    <span className="text-[9px] font-mono text-brand-deep-muted uppercase">{label}</span>
    <span className="text-[10px] font-mono text-brand-muted">{value}</span>
  </div>
);

export default function App() {
  const [state, setState] = useState<AppState>({
    text: DEFAULT_TEXT,
    image: null,
    maskData: null,
    maskWidth: 0,
    maskHeight: 0,
    transform: { x: 0, y: 0, scale: 1, rotation: 0 },
    threshold: 142,
    backgroundOpacity: 0.1,
    mode: 'black-white',
    debugMode: false,
    autoThreshold: true,
    noiseIntensity: 0,
    invertMask: false,
  });

  const [layout, setLayout] = useState<CharacterInfo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [imageWarning, setImageWarning] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const VIRTUAL_WIDTH = 1480;
  const VIRTUAL_HEIGHT = 2100;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageWarning(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < 800 || img.height < 800) setImageWarning("Resolution < 800px; clarity may be affected");
        setState(prev => ({ 
          ...prev, 
          image: img, 
          transform: { ...prev.transform, scale: Math.min(VIRTUAL_WIDTH / img.width, VIRTUAL_HEIGHT / img.height) * 0.8 } 
        }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const updateLayout = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const chars = computeLayout(state.text, ctx, {
      width: VIRTUAL_WIDTH,
      height: VIRTUAL_HEIGHT,
      marginTop: 200,
      marginBottom: 200,
      marginLeft: 250,
      marginRight: 200,
      fontSize: 48,
      lineHeight: 63,
      charsPerLine: 65,
      indent: 80,
    });
    setLayout(chars);
  }, [state.text]);

  useEffect(() => { updateLayout(); }, [updateLayout]);

  useEffect(() => {
    if (!state.image) return;
    const { data, w, h } = prepareMaskBuffer(state.image, VIRTUAL_WIDTH, VIRTUAL_HEIGHT, state.transform);
    let threshold = state.threshold;
    if (state.autoThreshold) threshold = computeAutoThreshold(data);
    setState(prev => ({ 
      ...prev, maskData: data, maskWidth: w, maskHeight: h,
      threshold: state.autoThreshold ? threshold : prev.threshold
    }));
  }, [state.image, state.transform, state.autoThreshold, state.threshold]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let bgColor = '#ffffff';
    let textColor = '#000000';
    if (state.mode === 'white-black') { bgColor = '#000000'; textColor = '#ffffff'; }
    else if (state.mode === 'dramatic-red') { bgColor = '#0a0000'; textColor = '#ff0000'; }

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    if (state.debugMode && state.maskData) {
      const debugImageData = ctx.createImageData(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
      for (let i = 0; i < state.maskData.length; i += 4) {
        const l = getLuminance(state.maskData[i], state.maskData[i+1], state.maskData[i+2]);
        const isActive = state.invertMask ? l < state.threshold : l >= state.threshold;
        const val = isActive ? 255 : 0;
        debugImageData.data[i] = val;
        debugImageData.data[i+1] = val;
        debugImageData.data[i+2] = val;
        debugImageData.data[i+3] = 255;
      }
      ctx.putImageData(debugImageData, 0, 0);
      return;
    }

    ctx.font = '48px "EB Garamond", Garamond, Baskerville, serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    for (const char of layout) {
      if (!state.maskData) {
        ctx.fillStyle = textColor;
        ctx.globalAlpha = 1.0;
        ctx.fillText(char.char, char.x, char.y);
        continue;
      }

      const ix = Math.floor(char.x + 12); 
      const iy = Math.floor(char.y - 18);
      if (ix < 0 || iy < 0 || ix >= VIRTUAL_WIDTH || iy >= VIRTUAL_HEIGHT) {
        ctx.fillStyle = textColor;
        ctx.globalAlpha = state.backgroundOpacity;
        ctx.fillText(char.char, char.x, char.y);
        continue;
      }

      const idx = (iy * VIRTUAL_WIDTH + ix) * 4;
      const l = getLuminance(state.maskData[idx], state.maskData[idx + 1], state.maskData[idx + 2]);
      const isActive = state.invertMask ? l < state.threshold : l >= state.threshold;

      if (isActive) {
        ctx.fillStyle = textColor;
        // Jitter logic: apply random opacity variation to create "grain"
        const jitter = state.noiseIntensity > 0 ? (Math.random() * state.noiseIntensity) : 0;
        ctx.globalAlpha = Math.max(0, 1.0 - jitter);
      } else {
        ctx.fillStyle = state.mode === 'grayscale' ? `rgb(${l},${l},${l})` : textColor;
        ctx.globalAlpha = state.backgroundOpacity;
      }
      ctx.fillText(char.char, char.x, char.y);
    }
  }, [layout, state.maskData, state.threshold, state.mode, state.backgroundOpacity, state.debugMode, state.noiseIntensity, state.invertMask]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!state.image) return;
    setDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !state.image) return;
    const dx = (e.clientX - lastMousePos.x) * 2;
    const dy = (e.clientY - lastMousePos.y) * 2;
    setState(prev => ({ ...prev, transform: { ...prev.transform, x: prev.transform.x + dx, y: prev.transform.y + dy } }));
    setLastMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (!state.image) return;
    setState(prev => ({ ...prev, transform: { ...prev.transform, scale: Math.max(0.1, prev.transform.scale - e.deltaY * 0.001) } }));
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `typomask-export-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const exportSVG = () => {
    let svgContent = `<svg width="${VIRTUAL_WIDTH}" height="${VIRTUAL_HEIGHT}" viewBox="0 0 ${VIRTUAL_WIDTH} ${VIRTUAL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<rect width="100%" height="100%" fill="${state.mode === 'white-black' ? 'black' : state.mode === 'dramatic-red' ? '#0a0000' : 'white'}" />`;
    const textColor = (state.mode === 'white-black') ? 'white' : (state.mode === 'dramatic-red' ? 'red' : 'black');
    layout.forEach(char => {
      const ix = Math.floor(char.x + 12);
      const iy = Math.floor(char.y - 18);
      let opacity = 1.0;
      let fill = textColor;
      if (state.maskData && ix >= 0 && iy >= 0 && ix < VIRTUAL_WIDTH && iy < VIRTUAL_HEIGHT) {
        const idx = (iy * VIRTUAL_WIDTH + ix) * 4;
        const l = getLuminance(state.maskData[idx], state.maskData[idx + 1], state.maskData[idx + 2]);
        
        const isMasked = state.invertMask ? l < state.threshold : l >= state.threshold;
        if (isMasked) {
          fill = textColor;
          opacity = state.noiseIntensity > 0 ? Math.max(0, 1.0 - Math.random() * state.noiseIntensity) : 1.0;
        } else {
          opacity = state.backgroundOpacity;
          if (state.mode === 'grayscale') { fill = `rgb(${l},${l},${l})`; opacity = 1.0; }
        }
      }
      svgContent += `<text x="${char.x}" y="${char.y}" font-family="EB Garamond, Garamond, Baskerville, serif" font-size="48" fill="${fill}" opacity="${opacity}">${char.char.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
    });
    svgContent += `</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.download = `typomask-export-${Date.now()}.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden selection:bg-brand-accent/30">
      <Header 
        glyphs={layout.length} 
        resolution={`${VIRTUAL_WIDTH}x${VIRTUAL_HEIGHT}PX`} 
        imageLoaded={!!state.image} 
      />
      
      <main className="flex-1 flex overflow-hidden">
        {/* SIDEBAR LEFT: INPUT */}
        <aside className="w-[260px] bg-brand-surface border-r border-brand-border flex flex-col overflow-y-auto custom-scrollbar p-5 gap-8 shrink-0">
          <Section label="Source Typography" icon={<Type className="w-3.5 h-3.5" />}>
            <div className="space-y-3">
              <textarea 
                value={state.text}
                onChange={e => setState(p => ({ ...p, text: e.target.value }))}
                className="w-full h-40 bg-black border border-brand-border rounded-sm p-2.5 text-[11px] font-mono leading-relaxed text-brand-muted focus:outline-none focus:border-brand-accent/50 resize-none custom-scrollbar"
                placeholder="Narrative source..."
              />
              <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-wider">
                <span className="text-zinc-600 truncate">Book Layout: 1755 C/PG</span>
                <button onClick={() => setState(p => ({ ...p, text: DEFAULT_TEXT }))} className="text-brand-accent hover:underline shrink-0">Reset</button>
              </div>
            </div>
          </Section>

          <Section label="Reference Mask" icon={<ImageIcon className="w-3.5 h-3.5" />}>
            <div className="space-y-4">
              <label className="relative group block cursor-pointer">
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                <div className="h-28 rounded-sm border border-dashed border-brand-border bg-black/50 flex flex-col items-center justify-center gap-2 transition-all hover:bg-black group-hover:border-brand-accent/50">
                  <AnimatePresence mode="wait">
                    {state.image ? (
                      <motion.div key="loaded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-brand-accent" />
                        <span className="text-[10px] font-mono uppercase text-brand-accent">Ready</span>
                        <div className="text-[9px] text-zinc-600 font-mono mt-1">{state.image.width}x{state.image.height} | 72 DPI</div>
                      </motion.div>
                    ) : (
                      <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-1">
                        <Upload className="w-4 h-4 text-brand-deep-muted group-hover:text-brand-accent transition-colors" />
                        <span className="text-[10px] font-mono text-brand-deep-muted uppercase">Upload Mask</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </label>

              {imageWarning && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-sm flex items-center gap-2 text-amber-500">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <p className="text-[9px] uppercase tracking-wider leading-tight">{imageWarning}</p>
                </div>
              )}

              {state.image && (
                <div className="flex gap-2">
                  <button onClick={() => setState(p => ({ ...p, image: null }))} className="flex-1 h-8 bg-transparent border border-brand-border text-brand-text hover:bg-red-500/10 hover:border-red-500/50 rounded-sm text-[10px] font-mono uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors">
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
              )}
            </div>
          </Section>

          <Section label="Export Configuration" icon={<Download className="w-3.5 h-3.5" />}>
            <div className="space-y-2">
              <button 
                onClick={exportPNG} 
                className="w-full h-9 bg-white text-black hover:bg-zinc-200 active:scale-[0.98] transition-all rounded-sm text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
              >
                Export PNG
              </button>
              <button 
                onClick={exportSVG} 
                className="w-full h-9 bg-transparent border border-brand-border text-brand-text hover:bg-white/5 active:scale-[0.98] transition-all rounded-sm text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
              >
                Export SVG
              </button>
            </div>
          </Section>
        </aside>

        {/* VIEWPORT: PREVIEW AREA */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-auto bg-brand-canvas bg-dot-grid flex items-center justify-center p-12 cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div 
            className="relative shadow-[0_0_60px_rgba(0,0,0,0.8)] bg-white"
            style={{ 
              width: 'max-content', height: 'max-content',
              transform: `scale(${containerRef.current ? Math.min(0.8, (containerRef.current.clientHeight * 0.8) / VIRTUAL_HEIGHT) : 0.4})`,
              transformOrigin: 'center center'
            }}
          >
            <canvas ref={canvasRef} width={VIRTUAL_WIDTH} height={VIRTUAL_HEIGHT} className="block" />
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.5)] bg-[radial-gradient(circle_at_50%_50%,transparent_40%,rgba(0,0,0,0.3)_90%)]" />
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 bg-black/80 backdrop-blur border border-brand-border rounded flex text-[10px] font-mono tracking-wider uppercase">
             <div className="flex items-center gap-2 pr-3 border-r border-white/10 opacity-70">
              <MousePointer2 className="w-3.5 h-3.5 text-brand-accent" /> SPACE + DRAG TO POSITION
             </div>
             <div className="flex items-center gap-2 opacity-70">
              <LayoutIcon className="w-3.5 h-3.5 text-brand-accent" /> ALT + SCROLL TO ZOOM
             </div>
          </div>
        </div>

        {/* SIDEBAR RIGHT: CONTROLS */}
        <aside className="w-[260px] bg-brand-surface border-l border-brand-border flex flex-col overflow-y-auto custom-scrollbar p-5 gap-8 shrink-0 border-r-0">
          <Section label="Segmentation" icon={<Zap className="w-3.5 h-3.5" />}>
            <div className="space-y-6">
              <ControlGroup label="Threshold" value={Math.round(state.threshold)} unit="L">
                <input 
                  type="range" min="0" max="255" step="1" 
                  value={state.threshold} disabled={state.autoThreshold}
                  onChange={e => setState(p => ({ ...p, threshold: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-white focus:outline-none"
                />
              </ControlGroup>

              <ControlGroup label="Camo Noise" value={Math.round(state.noiseIntensity * 100)} unit="%">
                <input 
                  type="range" min="0" max="1" step="0.01" 
                  value={state.noiseIntensity}
                  onChange={e => setState(p => ({ ...p, noiseIntensity: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-white focus:outline-none"
                />
              </ControlGroup>
              
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-brand-deep-muted">Auto Optimizer</label>
                  <Switch checked={state.autoThreshold} onChange={val => setState(p => ({ ...p, autoThreshold: val }))} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-brand-deep-muted">Invert Mask</label>
                  <Switch checked={state.invertMask} onChange={val => setState(p => ({ ...p, invertMask: val }))} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-brand-deep-muted">Debug Mask</label>
                  <button 
                    onClick={() => setState(p => ({ ...p, debugMode: !p.debugMode }))}
                    className={`p-1.5 rounded transition-colors ${state.debugMode ? 'bg-brand-accent text-white' : 'bg-black text-brand-deep-muted hover:bg-black/80'}`}
                  >
                    {state.debugMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </Section>



          <Section label="Transform" icon={<Box className="w-3.5 h-3.5" />}>
            <div className="space-y-5">
              <ControlGroup label="Scale" value={state.transform.scale.toFixed(2)} unit="X">
                <input 
                  type="range" min="0.1" max="5" step="0.01" 
                  value={state.transform.scale}
                  onChange={e => setState(p => ({ ...p, transform: { ...p.transform, scale: parseFloat(e.target.value) } }))}
                  className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-white focus:outline-none"
                />
              </ControlGroup>

              <ControlGroup label="Rotation" value={Math.round(state.transform.rotation)} unit="°">
                <input 
                  type="range" min="-180" max="180" step="1" 
                  value={state.transform.rotation}
                  onChange={e => setState(p => ({ ...p, transform: { ...p.transform, rotation: parseInt(e.target.value) } }))}
                  className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-white focus:outline-none"
                />
              </ControlGroup>

              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="bg-black border border-brand-border p-2 rounded-sm text-brand-deep-muted uppercase">X: {Math.round(state.transform.x)}PX</div>
                <div className="bg-black border border-brand-border p-2 rounded-sm text-brand-deep-muted uppercase">Y: {Math.round(state.transform.y)}PX</div>
              </div>
              
              <button 
                onClick={() => setState(p => ({ ...p, transform: { x:0,y:0,scale:1,rotation:0 } }))} 
                className="w-full h-8 bg-transparent border border-brand-border text-brand-deep-muted hover:text-white hover:border-brand-accent transition-all rounded-sm text-[9px] font-mono uppercase tracking-widest shadow-sm active:translate-y-px"
              >
                Reset Transform
              </button>
            </div>
          </Section>
          <Section label="Render Mode" icon={<Activity className="w-3.5 h-3.5" />}>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2">
                {(['black-white', 'white-black', 'grayscale', 'dramatic-red'] as RenderingMode[]).map(m => (
                  <button 
                    key={m}
                    onClick={() => setState(p => ({ ...p, mode: m }))}
                    className={`h-11 border rounded-sm text-[9px] font-mono uppercase tracking-widest flex items-center justify-center transition-all ${state.mode === m ? 'bg-brand-accent border-brand-accent text-white shadow-[0_0_15px_rgba(0,122,255,0.4)]' : 'bg-black border-brand-border text-brand-deep-muted hover:border-brand-muted'}`}
                  >
                    {m.replace('-', ' ')}
                  </button>
                ))}
              </div>

              <ControlGroup label="BKG Density" value={Math.round(state.backgroundOpacity * 100)} unit="%">
                <input 
                  type="range" min="0" max="1" step="0.01" 
                  value={state.backgroundOpacity} 
                  onChange={e => setState(p => ({ ...p, backgroundOpacity: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-brand-border rounded-lg appearance-none cursor-pointer accent-white focus:outline-none"
                />
              </ControlGroup>
            </div>
          </Section>

          <Section label="Metrics" icon={<Hash className="w-3.5 h-3.5" />}>
            <div className="space-y-1.5">
             <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-widest text-brand-deep-muted">
                  <span>Page Target</span>
                  <span className="text-zinc-400">A5 / 27 L</span>
                </div>
                <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-widest text-brand-deep-muted">
                  <span>Line Height</span>
                  <span className="text-zinc-400">1.3 PT</span>
                </div>
                <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-widest text-brand-deep-muted">
                  <span>Char Density</span>
                  <span className="text-zinc-400">~65 CPL</span>
                </div>
                
                <div className="h-10 bg-black mt-4 border border-white/5 rounded-sm flex items-end p-1 gap-1 overflow-hidden">
                   {Array.from({length: 12}).map((_, i) => (
                     <motion.div 
                       key={i} 
                       initial={{ height: 0 }}
                       animate={{ height: `${Math.random() * 80 + 20}%` }}
                       transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse', delay: i * 0.1 }}
                       className={`flex-1 ${i % 3 === 0 ? 'bg-brand-accent/60' : 'bg-brand-border/40'}`} 
                      />
                   ))}
                </div>
                <div className="text-[8px] text-zinc-700 font-mono uppercase text-center mt-1.5 tracking-tighter">Real-time Signal Map</div>
             </div>
            </div>
          </Section>
        </aside>
      </main>
    </div>
  );
}

// --- UI Helpers ---

const Section = ({ label, children, icon }: { label: string; children: React.ReactNode; icon: React.ReactNode }) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-deep-muted border-b border-brand-border pb-2 mb-1">
      <span className="opacity-50">{icon}</span>
      {label}
    </div>
    {children}
  </div>
);

const ControlGroup = ({ label, value, unit, children }: { label: string; value: number | string; unit: string; children: React.ReactNode }) => (
  <div className="space-y-3 font-mono">
    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-brand-deep-muted">
      <span>{label}</span>
      <span className="text-brand-text">{value}<span className="text-brand-deep-muted ml-0.5">{unit}</span></span>
    </div>
    {children}
  </div>
);

const Switch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button 
    onClick={() => onChange(!checked)}
    className={`w-7 h-3.5 rounded-full relative transition-colors ${checked ? 'bg-brand-accent' : 'bg-black border border-brand-border'}`}
  >
    <motion.div 
      className="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full shadow-sm"
      animate={{ x: checked ? 14 : 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
);

