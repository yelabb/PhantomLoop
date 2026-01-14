// Loop-Back Cursor (Blue - Decoder Output)

import { memo } from 'react';
import { Cursor } from './Cursor';
import { COLORS, VISUALIZATION } from '../utils/constants';

interface LoopBackCursorProps {
  x: number;
  y: number;
}

export const LoopBackCursor = memo(function LoopBackCursor({ x, y }: LoopBackCursorProps) {
  return (
    <Cursor 
      x={x} 
      y={y} 
      color={COLORS.LOOPBACK}
      size={VISUALIZATION.LOOPBACK_SIZE}
    />
  );
});
