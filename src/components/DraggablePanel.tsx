import { memo, useState, useRef, useEffect, type DragEvent } from 'react';
import { createPortal } from 'react-dom';

interface DraggablePanelProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (targetId: string) => void;
  isDragging?: boolean;
  defaultOpen?: boolean;
  isLocked?: boolean;
  onToggleLock?: (id: string) => void;
  helpText?: string;
}

// Help modal component - Educational popup with proper styling
const HelpModal = memo(function HelpModal({ 
  title,
  text, 
  isVisible,
  onClose,
}: { 
  title: string;
  text: string; 
  isVisible: boolean;
  onClose: () => void;
}) {
  // Close on escape key
  useEffect(() => {
    if (!isVisible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, onClose]);

  if (!isVisible || !text) return null;

  // Parse text into sections for better presentation
  const sections = text.split('\n\n').map((section, idx) => {
    const lines = section.split('\n');
    const firstLine = lines[0];
    const isHeader = !firstLine.startsWith('•') && !firstLine.startsWith('-') && lines.length === 1 && firstLine.length < 60;
    
    if (isHeader && idx > 0) {
      return (
        <div key={idx} className="mt-4">
          <h4 className="text-sm font-semibold text-blue-400 mb-2">{firstLine}</h4>
        </div>
      );
    }
    
    // Check if it's a bullet list
    const hasBullets = lines.some(line => line.trim().startsWith('•') || line.trim().startsWith('-'));
    
    if (hasBullets) {
      return (
        <ul key={idx} className="space-y-1.5 mb-3">
          {lines.map((line, lineIdx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
              const content = trimmed.slice(1).trim();
              // Check for key:value pattern
              const colonIdx = content.indexOf(':');
              if (colonIdx > 0 && colonIdx < 30) {
                const key = content.slice(0, colonIdx);
                const value = content.slice(colonIdx + 1);
                return (
                  <li key={lineIdx} className="flex items-start gap-2 text-sm">
                    <span className="text-purple-400 mt-0.5">›</span>
                    <span>
                      <span className="font-medium text-white">{key}:</span>
                      <span className="text-gray-300">{value}</span>
                    </span>
                  </li>
                );
              }
              return (
                <li key={lineIdx} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-purple-400 mt-0.5">›</span>
                  <span>{content}</span>
                </li>
              );
            }
            return <p key={lineIdx} className="text-sm text-gray-300 mb-2">{trimmed}</p>;
          })}
        </ul>
      );
    }
    
    return <p key={idx} className="text-sm text-gray-300 leading-relaxed mb-3">{section}</p>;
  });
  
  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-md bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-600/50 rounded-2xl shadow-2xl shadow-black/50 animate-fade-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {sections}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-700/50 flex items-center justify-between">
          <span className="text-xs text-gray-500">Press ESC to close</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-500 hover:to-blue-500 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
});

export const DraggablePanel = memo(function DraggablePanel({
  id,
  title,
  children,
  onDragStart,
  onDragEnd,
  onDrop,
  isDragging = false,
  defaultOpen = true,
  isLocked = true,
  onToggleLock,
  helpText,
}: DraggablePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', id);
    onDragStart(id);
  };

  const handleDragEnd = () => {
    onDragEnd();
    setIsDragOver(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragging) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!isDragging) {
      onDrop(id);
    }
  };

  const handleLockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleLock?.(id);
  };

  return (
    <div
      ref={dragRef}
      className={`bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isDragOver ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/50' : ''} ${
        !isLocked ? 'ring-1 ring-amber-500/50' : ''
      }`}
      draggable={!isLocked}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={`w-full flex items-center justify-between p-3 hover:bg-gray-800/30 transition-colors ${
          isLocked ? 'cursor-pointer' : 'cursor-move'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          {!isLocked && (
            <span className="text-amber-500 text-base cursor-grab active:cursor-grabbing hover:text-amber-400 transition-colors">
              ⋮⋮
            </span>
          )}
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2 relative">
          {/* Help button */}
          {helpText && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowHelp(true);
              }}
              className="p-1 rounded transition-colors text-gray-500 hover:text-blue-400 hover:bg-gray-700/50"
              title="Show help"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
          <HelpModal 
            title={title} 
            text={helpText || ''} 
            isVisible={showHelp} 
            onClose={() => setShowHelp(false)} 
          />
          <button
            onClick={handleLockClick}
            className={`p-1 rounded transition-colors ${
              isLocked 
                ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50' 
                : 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10'
            }`}
            title={isLocked ? 'Unlock to drag' : 'Lock panel'}
          >
            {isLocked ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <span className="text-gray-500 text-sm">
            {isOpen ? '−' : '+'}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="px-3 pb-3">{children}</div>
      )}
    </div>
  );
});
