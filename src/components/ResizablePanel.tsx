import { memo, useState, useRef, useEffect, ReactNode } from 'react';

interface ResizablePanelProps {
  children: ReactNode;
  side: 'left' | 'right';
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  className?: string;
  onPanelDragOver?: () => void;
  onPanelDragLeave?: () => void;
  isDragTarget?: boolean;
}

export const ResizablePanel = memo(function ResizablePanel({
  children,
  side,
  minWidth = 200,
  maxWidth = 600,
  defaultWidth = 320,
  className = '',
  onPanelDragOver,
  onPanelDragLeave,
  isDragTarget = false,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(`phantomloop-${side}-width`);
    return saved ? parseInt(saved, 10) : defaultWidth;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);
  
  // Persist width to localStorage
  useEffect(() => {
    localStorage.setItem(`phantomloop-${side}-width`, width.toString());
  }, [width, side]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const delta = side === 'left' 
        ? e.clientX - startXRef.current 
        : startXRef.current - e.clientX;
      
      const newWidth = Math.min(
        Math.max(startWidthRef.current + delta, minWidth),
        maxWidth
      );
      
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, side, minWidth, maxWidth, width]);

  return (
    <aside
      ref={panelRef}
      className={`dashboard-sidebar shrink-0 overflow-y-auto relative transition-all duration-200 ${className} ${
        isDragTarget ? 'bg-blue-500/10 border-blue-500' : ''
      }`}
      style={{ width: `${width}px` }}
      onDragOver={(e) => {
        e.preventDefault();
        onPanelDragOver?.();
      }}
      onDragLeave={onPanelDragLeave}
    >
      {children}
      
      {/* Resize handle */}
      <div
        className={`absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors group ${
          side === 'left' ? 'right-0' : 'left-0'
        } ${isResizing ? 'bg-blue-500' : 'bg-transparent'}`}
        onMouseDown={handleMouseDown}
      >
        <div className={`absolute top-1/2 -translate-y-1/2 w-1 h-12 bg-gray-600 group-hover:bg-blue-500 transition-colors ${
          side === 'left' ? 'right-0' : 'left-0'
        } ${isResizing ? 'bg-blue-500' : ''}`} />
      </div>
    </aside>
  );
});
