// Combined Zustand store

import { create } from 'zustand';
import type { ConnectionSlice } from './slices/connectionSlice';
import type { StreamSlice } from './slices/streamSlice';
import type { DecoderSlice } from './slices/decoderSlice';
import type { VisualizationSlice } from './slices/visualSlice';
import type { MetricsSlice } from './slices/metricsSlice';
import { createConnectionSlice } from './slices/connectionSlice';
import { createStreamSlice } from './slices/streamSlice';
import { createDecoderSlice } from './slices/decoderSlice';
import { createVisualizationSlice } from './slices/visualSlice';
import { createMetricsSlice } from './slices/metricsSlice';

export type StoreState = ConnectionSlice &
  StreamSlice &
  DecoderSlice &
  VisualizationSlice &
  MetricsSlice;

export const useStore = create<StoreState>()((...a) => ({
  ...createConnectionSlice(...a),
  ...createStreamSlice(...a),
  ...createDecoderSlice(...a),
  ...createVisualizationSlice(...a),
  ...createMetricsSlice(...a),
}));
