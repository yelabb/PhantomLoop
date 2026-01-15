import { memo, useState, useRef, type DragEvent } from 'react';

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
}

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
}: DraggablePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDragOver, setIsDragOver] = useState(false);
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
        <div className="flex items-center gap-2">
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
