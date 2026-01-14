// Bio-Link Cursor (Green - Ground Truth)

import { memo } from 'react';
import { Cursor } from './Cursor';
import { COLORS, VISUALIZATION } from '../utils/constants';

interface BioLinkCursorProps {
  x: number;
  y: number;
}

export const BioLinkCursor = memo(function BioLinkCursor({ x, y }: BioLinkCursorProps) {
  return (
    <Cursor 
      x={x} 
      y={y} 
      color={COLORS.BIOLINK}
      size={VISUALIZATION.BIOLINK_SIZE}
    />
  );
});
