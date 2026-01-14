// Phantom Cursor (Yellow - Intention)

import { Cursor } from './Cursor';
import { COLORS, VISUALIZATION } from '../utils/constants';

interface PhantomCursorProps {
  x: number;
  y: number;
}

export function PhantomCursor({ x, y }: PhantomCursorProps) {
  return (
    <Cursor 
      x={x} 
      y={y} 
      color={COLORS.PHANTOM}
      size={VISUALIZATION.PHANTOM_SIZE}
      emissiveIntensity={0.8}
    />
  );
}
