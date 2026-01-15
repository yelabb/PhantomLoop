// Spectral Power Panel - Frequency band analysis visualization
// Shows power in different neural frequency bands (delta, theta, alpha, beta, gamma)

import { memo, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useStore } from '../../store';

interface SpectralPowerPanelProps {
  sampleRate?: number;
}

// Frequency bands for neural signals
const FREQUENCY_BANDS = [
  { name: 'Delta', range: [0.5, 4], color: '#8b5cf6' },
  { name: 'Theta', range: [4, 8], color: '#06b6d4' },
  { name: 'Alpha', range: [8, 13], color: '#22c55e' },
  { name: 'Beta', range: [13, 30], color: '#f59e0b' },
  { name: 'Gamma', range: [30, 100], color: '#ef4444' },
] as const;

// Simple DFT for frequency analysis (in real app, use FFT library)
function computeSpectrum(signal: number[], sampleRate: number): number[] {
  const n = signal.length;
  if (n === 0) return [];
  
  const spectrum: number[] = [];
  const maxFreq = Math.min(sampleRate / 2, 100); // Nyquist limit
  
  for (let freq = 1; freq <= maxFreq; freq++) {
    let real = 0, imag = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * freq * t) / sampleRate;
      real += signal[t] * Math.cos(angle);
      imag += signal[t] * Math.sin(angle);
    }
    const power = Math.sqrt(real * real + imag * imag) / n;
    spectrum.push(power);
  }
  
  return spectrum;
}

// Calculate band power
function getBandPower(spectrum: number[], band: readonly [number, number]): number {
  let power = 0;
  for (let f = Math.floor(band[0]); f <= Math.min(Math.ceil(band[1]), spectrum.length); f++) {
    if (f > 0 && f <= spectrum.length) {
      power += spectrum[f - 1] ** 2;
    }
  }
  return Math.sqrt(power);
}

// Fullscreen portal
const FullscreenPortal = memo(function FullscreenPortal({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
    >
      {children}
    </motion.div>,
    document.body
  );
});

// Control button
const ControlButton = memo(function ControlButton({
  onClick,
  title,
  children,
  active = false,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-all text-xs ${
        active 
          ? 'bg-phantom/30 text-phantom border border-phantom/50' 
          : 'bg-gray-800/80 hover:bg-gray-700/80 text-gray-400 hover:text-white border border-gray-700/50'
      }`}
    >
      {children}
    </button>
  );
});

// Band power bar
const BandPowerBar = memo(function BandPowerBar({
  band,
  power,
  maxPower,
  isSelected,
  onClick,
}: {
  band: typeof FREQUENCY_BANDS[number];
  power: number;
  maxPower: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const percentage = maxPower > 0 ? (power / maxPower) * 100 : 0;
  
  return (
    <div 
      className={`flex flex-col gap-1 cursor-pointer transition-all ${
        isSelected ? 'scale-105' : 'hover:scale-102'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium" style={{ color: band.color }}>
          {band.name}
        </span>
        <span className="font-mono text-gray-400">
          {band.range[0]}-{band.range[1]}Hz
        </span>
      </div>
      <div className="h-4 bg-gray-800/50 rounded overflow-hidden relative">
        <motion.div
          className="h-full rounded"
          style={{ backgroundColor: band.color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.2 }}
        />
        <span className="absolute right-1 top-0 text-[9px] font-mono text-white/80 leading-4">
          {power.toFixed(2)}
        </span>
      </div>
    </div>
  );
});

export const SpectralPowerPanel = memo(function SpectralPowerPanel({
  sampleRate = 60,
}: SpectralPowerPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPacket = useStore((state) => state.currentPacket);
  
  // Signal buffer for FFT
  const signalBufferRef = useRef<number[]>([]);
  const bufferSize = 256;
  
  // State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedBand, setSelectedBand] = useState<string | null>(null);
  const [showSpectrum, setShowSpectrum] = useState(true);
  const [logScale, setLogScale] = useState(true);
  const [bandPowers, setBandPowers] = useState<Record<string, number>>({});
  const [sampleCount, setSampleCount] = useState(0);
  
  // Dimensions
  const getCanvasDimensions = useCallback(() => {
    if (isFullscreen) {
      return { width: window.innerWidth - 200, height: 300 };
    }
    return { width: 350, height: 120 };
  }, [isFullscreen]);
  
  const { width, height } = getCanvasDimensions();
  
  // Update signal buffer
  useEffect(() => {
    if (!currentPacket || isPaused) return;
    
    const spikes = currentPacket.data?.spikes?.spike_counts || [];
    if (spikes.length === 0) return;
    
    // Average all neurons for population signal
    const avgSignal = spikes.reduce((a, b) => a + b, 0) / spikes.length;
    signalBufferRef.current.push(avgSignal);
    
    if (signalBufferRef.current.length > bufferSize) {
      signalBufferRef.current.shift();
    }
  }, [currentPacket, isPaused]);
  
  // Compute spectrum and render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const signal = signalBufferRef.current;
    
    // Update sample count for display
    setSampleCount(signal.length);
    
    // Clear
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);
    
    if (signal.length < 32) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Collecting samples...', width / 2, height / 2);
      return;
    }
    
    // Compute spectrum
    const spectrum = computeSpectrum(signal, sampleRate);
    if (spectrum.length === 0) return;
    
    // Calculate band powers
    const powers: Record<string, number> = {};
    FREQUENCY_BANDS.forEach(band => {
      powers[band.name] = getBandPower(spectrum, band.range);
    });
    setBandPowers(powers);
    
    if (!showSpectrum) return;
    
    // Draw spectrum
    const maxPower = Math.max(...spectrum, 0.01);
    const plotLeft = 40;
    const plotRight = width - 20;
    const plotTop = 20;
    const plotBottom = height - 30;
    const plotWidth = plotRight - plotLeft;
    const plotHeight = plotBottom - plotTop;
    
    // Draw grid
    ctx.strokeStyle = 'rgba(75, 85, 99, 0.2)';
    ctx.lineWidth = 0.5;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = plotTop + (i / 4) * plotHeight;
      ctx.beginPath();
      ctx.moveTo(plotLeft, y);
      ctx.lineTo(plotRight, y);
      ctx.stroke();
    }
    
    // Frequency band backgrounds
    FREQUENCY_BANDS.forEach(band => {
      const x1 = plotLeft + (band.range[0] / 100) * plotWidth;
      const x2 = plotLeft + (band.range[1] / 100) * plotWidth;
      
      ctx.fillStyle = band.name === selectedBand 
        ? `${band.color}30`
        : `${band.color}10`;
      ctx.fillRect(x1, plotTop, x2 - x1, plotHeight);
    });
    
    // Draw spectrum line
    ctx.beginPath();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    
    for (let f = 0; f < spectrum.length && f < 100; f++) {
      const x = plotLeft + (f / 100) * plotWidth;
      const power = logScale 
        ? Math.log10(spectrum[f] + 0.001) - Math.log10(0.001)
        : spectrum[f];
      const maxP = logScale 
        ? Math.log10(maxPower + 0.001) - Math.log10(0.001)
        : maxPower;
      const y = plotBottom - (power / maxP) * plotHeight;
      
      if (f === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    
    // Fill under curve
    ctx.lineTo(plotRight, plotBottom);
    ctx.lineTo(plotLeft, plotBottom);
    ctx.closePath();
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
    ctx.fill();
    
    // Axis labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    
    // X axis (frequency)
    for (let f = 0; f <= 100; f += 20) {
      const x = plotLeft + (f / 100) * plotWidth;
      ctx.fillText(`${f}Hz`, x, plotBottom + 15);
    }
    
    // Y axis (power)
    ctx.textAlign = 'right';
    ctx.fillText('Power', plotLeft - 5, plotTop + 10);
    
    // Title
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Spectral Power Density', plotLeft, 12);
    
  }, [currentPacket, width, height, sampleRate, showSpectrum, logScale, selectedBand, isPaused]);
  
  // Max power for bars
  const maxBandPower = useMemo(() => {
    return Math.max(...Object.values(bandPowers), 0.01);
  }, [bandPowers]);
  
  // Dominant band
  const dominantBand = useMemo(() => {
    let max = 0;
    let dominant = '';
    Object.entries(bandPowers).forEach(([name, power]) => {
      if (power > max) {
        max = power;
        dominant = name;
      }
    });
    return dominant;
  }, [bandPowers]);
  
  // Toolbar JSX
  const toolbarContent = (
    <div className="flex items-center gap-2 flex-wrap">
      <ControlButton onClick={() => setIsPaused(!isPaused)} title={isPaused ? 'Resume' : 'Pause'} active={isPaused}>
        {isPaused ? '▶' : '⏸'}
      </ControlButton>
      
      <ControlButton onClick={() => setShowSpectrum(!showSpectrum)} title="Toggle Spectrum" active={showSpectrum}>
        📈
      </ControlButton>
      
      <ControlButton onClick={() => setLogScale(!logScale)} title="Toggle Log Scale" active={logScale}>
        log
      </ControlButton>
      
      <div className="border-l border-gray-700/50 pl-2">
        <ControlButton onClick={() => setIsFullscreen(!isFullscreen)} title="Fullscreen">
          ⛶
        </ControlButton>
      </div>
    </div>
  );
  
  return (
    <>
      <div className={`flex flex-col gap-3 ${isFullscreen ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Spectral Analysis
          </h3>
          {toolbarContent}
        </div>
        
        {/* Spectrum canvas */}
        {showSpectrum && (
          <div className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="block"
            />
            
            {isPaused && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 text-[10px] font-mono">
                PAUSED
              </div>
            )}
          </div>
        )}
        
        {/* Band power bars */}
        <div className="grid grid-cols-1 gap-2">
          {FREQUENCY_BANDS.map(band => (
            <BandPowerBar
              key={band.name}
              band={band}
              power={bandPowers[band.name] || 0}
              maxPower={maxBandPower}
              isSelected={selectedBand === band.name}
              onClick={() => setSelectedBand(selectedBand === band.name ? null : band.name)}
            />
          ))}
        </div>
        
        {/* Dominant band indicator */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">
            {sampleCount} samples • {sampleRate}Hz
          </span>
          <span className="font-mono">
            Dominant: <span className="text-green-400 font-bold">{dominantBand}</span>
          </span>
        </div>
      </div>
      
      {/* Fullscreen */}
      <AnimatePresence>
        <FullscreenPortal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)}>
          <div className="flex-1 flex flex-col p-6 gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Spectral Power Analysis</h2>
              {toolbarContent}
            </div>
            
            <div className="flex-1 flex flex-col gap-4">
              {/* Large spectrum */}
              <div className="relative overflow-hidden bg-gray-950 border border-gray-700/50 rounded flex-1">
                <canvas
                  ref={canvasRef}
                  width={width}
                  height={height}
                  className="block w-full"
                />
              </div>
              
              {/* Band powers in row */}
              <div className="grid grid-cols-5 gap-4">
                {FREQUENCY_BANDS.map(band => (
                  <div 
                    key={band.name}
                    className={`p-4 rounded border transition-all cursor-pointer ${
                      selectedBand === band.name 
                        ? 'border-white/30 bg-white/5' 
                        : 'border-gray-700/50 hover:border-gray-600/50'
                    }`}
                    onClick={() => setSelectedBand(selectedBand === band.name ? null : band.name)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: band.color }} />
                      <span className="font-bold text-white">{band.name}</span>
                    </div>
                    <div className="text-2xl font-mono font-bold" style={{ color: band.color }}>
                      {(bandPowers[band.name] || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {band.range[0]}-{band.range[1]} Hz
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="text-gray-500 text-sm">
              <span className="font-mono">{sampleCount} samples</span>
              <span className="mx-2">•</span>
              <span>Dominant: <span className="text-green-400 font-bold">{dominantBand}</span></span>
            </div>
          </div>
        </FullscreenPortal>
      </AnimatePresence>
    </>
  );
});
