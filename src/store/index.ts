// Combined Zustand store

import { create } from 'zustand';
import type { ConnectionSlice } from './slices/connectionSlice';
import type { StreamSlice } from './slices/streamSlice';
import type { UnifiedStreamSlice } from './slices/unifiedStreamSlice';
import type { DecoderSlice } from './slices/decoderSlice';
import type { MetricsSlice } from './slices/metricsSlice';
import type { ElectrodeSlice } from './slices/electrodeSlice';
import type { UISlice } from './slices/uiSlice';
import { createConnectionSlice } from './slices/connectionSlice';
import { createStreamSlice } from './slices/streamSlice';
import { createUnifiedStreamSlice } from './slices/unifiedStreamSlice';
import { createDecoderSlice } from './slices/decoderSlice';
import { createMetricsSlice } from './slices/metricsSlice';
import { createElectrodeSlice } from './slices/electrodeSlice';
import { createUISlice } from './slices/uiSlice';

export type StoreState = ConnectionSlice &
  StreamSlice &
  UnifiedStreamSlice &
  DecoderSlice &
  MetricsSlice &
  ElectrodeSlice &
  UISlice;

export const useStore = create<StoreState>()((...a) => ({
  ...createConnectionSlice(...a),
  ...createStreamSlice(...a),
  ...createUnifiedStreamSlice(...a),
  ...createDecoderSlice(...a),
  ...createMetricsSlice(...a),
  ...createElectrodeSlice(...a),
  ...createUISlice(...a),
}));
