// Grid Floor Component

import { COLORS, VISUALIZATION } from '../utils/constants';

export function GridFloor() {
  return (
    <gridHelper 
      args={[
        VISUALIZATION.GRID_SIZE,
        VISUALIZATION.GRID_DIVISIONS,
        COLORS.GRID,
        COLORS.GRID
      ]}
      position={[0, -1, 0]}
    />
  );
}
