/**
 * Loading Components - Cinematic loading states
 */

import { memo } from 'react';

/**
 * Neural network loading animation - shows brain activity pattern
 */
export const NeuralLoader = memo(function NeuralLoader({ 
  message = 'Initializing...',
  size = 'md',
}: { 
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`relative ${sizeClasses[size]}`}>
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-phantom/30 animate-ping" />
        
        {/* Middle ring */}
        <div className="absolute inset-1 rounded-full border-2 border-loopback/40 animate-pulse" />
        
        {/* Inner core */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-phantom via-loopback to-biolink animate-spin-slow" 
          style={{ animationDuration: '3s' }} 
        />
        
        {/* Neural spikes */}
        <svg className="absolute inset-0 w-full h-full animate-pulse" viewBox="0 0 100 100">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <line
              key={angle}
              x1="50"
              y1="50"
              x2={50 + 40 * Math.cos((angle * Math.PI) / 180)}
              y2={50 + 40 * Math.sin((angle * Math.PI) / 180)}
              stroke={i % 2 === 0 ? '#FFD700' : '#0080FF'}
              strokeWidth="1"
              opacity={0.6}
              className="animate-neural-spike"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </svg>
      </div>
      
      {message && (
        <p className="text-sm text-gray-400 animate-pulse font-mono">{message}</p>
      )}
    </div>
  );
});

/**
 * Decoder loading overlay - shows when switching decoders
 * Uses a portal to render at document root for immediate visibility
 */
export const DecoderLoadingOverlay = memo(function DecoderLoadingOverlay({
  decoderName,
  isVisible,
}: {
  decoderName: string;
  isVisible: boolean;
}) {
  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md"
      style={{ 
        // Force immediate render with will-change
        willChange: 'opacity',
        contain: 'layout style paint',
      }}
    >
      <div className="flex flex-col items-center gap-6 p-10 rounded-2xl bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-700/50 shadow-2xl animate-slide-up">
        {/* Neural loader animation */}
        <div className="relative w-20 h-20">
          {/* Outer glow */}
          <div className="absolute inset-0 rounded-full bg-loopback/20 blur-xl animate-pulse" />
          
          {/* Spinning rings */}
          <div className="absolute inset-0 rounded-full border-2 border-loopback/30 animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-2 rounded-full border-2 border-phantom/40 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
          <div className="absolute inset-4 rounded-full border-2 border-biolink/50 animate-spin" style={{ animationDuration: '1.5s' }} />
          
          {/* Center core */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-loopback via-phantom to-biolink animate-pulse" />
        </div>
        
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2 tracking-wide">
            Loading Decoder
          </h3>
          <p className="text-loopback font-mono text-lg">{decoderName}</p>
          <p className="text-sm text-gray-500 mt-3">
            Building neural network architecture...
          </p>
        </div>
        
        {/* Animated progress bar */}
        <div className="w-72 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-phantom via-loopback to-biolink rounded-full"
            style={{
              animation: 'loading-bar 1.5s ease-in-out infinite',
            }}
          />
        </div>
        
        {/* Status text */}
        <p className="text-xs text-gray-600 font-mono animate-pulse">
          Compiling TensorFlow.js model...
        </p>
      </div>
    </div>
  );
});

/**
 * Connection loading state
 */
export const ConnectionLoader = memo(function ConnectionLoader({
  status,
}: {
  status: 'connecting' | 'reconnecting' | 'waiting';
}) {
  const messages = {
    connecting: 'Connecting to PhantomLink...',
    reconnecting: 'Reconnecting...',
    waiting: 'Waiting for neural stream...',
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-800/80 border border-gray-700">
      <div className="relative w-4 h-4">
        <div className="absolute inset-0 rounded-full bg-yellow-500/50 animate-ping" />
        <div className="absolute inset-0.5 rounded-full bg-yellow-500 animate-pulse" />
      </div>
      <span className="text-sm text-gray-300">{messages[status]}</span>
    </div>
  );
});

/**
 * Inline spinner for small loading states
 */
export const Spinner = memo(function Spinner({
  size = 'sm',
  color = 'phantom',
}: {
  size?: 'xs' | 'sm' | 'md';
  color?: 'phantom' | 'loopback' | 'biolink' | 'white';
}) {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
  };
  
  const colorClasses = {
    phantom: 'border-phantom',
    loopback: 'border-loopback',
    biolink: 'border-biolink',
    white: 'border-white',
  };

  return (
    <div 
      className={`${sizeClasses[size]} rounded-full border-2 border-t-transparent animate-spin ${colorClasses[color]}`} 
    />
  );
});

/**
 * Skeleton loader for content
 */
export const Skeleton = memo(function Skeleton({
  className = '',
}: {
  className?: string;
}) {
  return (
    <div className={`animate-pulse bg-gray-700/50 rounded ${className}`} />
  );
});

/**
 * Initial app loading screen
 */
export const AppLoader = memo(function AppLoader() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black">
      {/* Logo */}
      <div className="mb-8">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-phantom via-loopback to-biolink bg-clip-text text-transparent animate-pulse">
          PHANTOM LOOP
        </h1>
        <p className="text-center text-gray-500 mt-2">Neural Gauntlet Arena</p>
      </div>
      
      <NeuralLoader size="lg" message="Initializing TensorFlow.js..." />
      
      {/* Animated dots */}
      <div className="flex gap-1 mt-8">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-gray-600 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
});
