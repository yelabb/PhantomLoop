// Visualization settings slice

import type { StateCreator } from 'zustand';

export interface VisualizationSlice {
  showPhantom: boolean;
  showBioLink: boolean;
  showLoopBack: boolean;
  showTrails: boolean;
  showTarget: boolean;
  showGrid: boolean;
  cameraMode: 'top' | 'perspective' | 'side';
  
  togglePhantom: () => void;
  toggleBioLink: () => void;
  toggleLoopBack: () => void;
  toggleTrails: () => void;
  toggleTarget: () => void;
  toggleGrid: () => void;
  setCameraMode: (mode: 'top' | 'perspective' | 'side') => void;
}

export const createVisualizationSlice: StateCreator<
  VisualizationSlice,
  [],
  [],
  VisualizationSlice
> = (set) => ({
  showPhantom: true,
  showBioLink: true,
  showLoopBack: true,
  showTrails: true,
  showTarget: true,
  showGrid: true,
  cameraMode: 'perspective',

  togglePhantom: () => set((state) => ({ showPhantom: !state.showPhantom })),
  toggleBioLink: () => set((state) => ({ showBioLink: !state.showBioLink })),
  toggleLoopBack: () => set((state) => ({ showLoopBack: !state.showLoopBack })),
  toggleTrails: () => set((state) => ({ showTrails: !state.showTrails })),
  toggleTarget: () => set((state) => ({ showTarget: !state.showTarget })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  
  setCameraMode: (mode: 'top' | 'perspective' | 'side') => {
    console.log(`[PhantomLoop] Camera mode: ${mode}`);
    set({ cameraMode: mode });
  },
});
