import { memo, useState, DragEvent, useRef } from 'react';
import { motion } from 'framer-motion';

interface DraggablePanelProps {
  id: string;
  title: string;
  children: React.ReactNode;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (targetId: string) => void;
  isDragging?: boolean;
  defaultOpen?: boolean;
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
}: DraggablePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
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

  return (
    <motion.div
      ref={dragRef}
      className={`dashboard-card overflow-hidden transition-all duration-200 mb-4 ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${isDragOver ? 'ring-2 ring-blue-500 shadow-lg shadow-blue-500/50' : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      layout
    >
      <div
        className="w-full flex items-center justify-between p-3 hover:bg-gray-800/30 transition-colors cursor-move"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-base cursor-grab active:cursor-grabbing hover:text-blue-400 transition-colors">
            ⋮⋮
          </span>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            {title}
          </span>
        </div>
        <span className="text-gray-500 text-sm">
          {isOpen ? '−' : '+'}
        </span>
      </div>

      <motion.div
        initial={false}
        animate={{ 
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0
        }}
        transition={{ duration: 0.2 }}
        style={{ overflow: 'hidden' }}
      >
        <div className="p-3 pt-0">{children}</div>
      </motion.div>
    </motion.div>
  );
});
