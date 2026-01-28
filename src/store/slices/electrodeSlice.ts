/**
 * Electrode configuration state management
 * Handles electrode placement, impedance monitoring, and channel mapping
 */

import type { StateCreator } from 'zustand';
import type {
  ElectrodeConfiguration,
  ElectrodeInfo,
  ImpedanceData,
  Position3D,
  DataSource,
} from '../../types/electrodes';

export interface ElectrodeSlice {
  // State
  electrodeConfig: ElectrodeConfiguration | null;
  channelMapping: Map<number, ElectrodeInfo>;
  impedanceValues: Map<number, number>; // channelIndex -> impedance (kΩ)
  dataSource: DataSource | null;
  isMonitoringImpedance: boolean;
  lastImpedanceUpdate: number | null;

  // Actions
  setElectrodeConfig: (config: ElectrodeConfiguration) => void;
  updateElectrodePosition: (electrodeId: string, position: Position3D) => void;
  updateImpedance: (data: ImpedanceData) => void;
  batchUpdateImpedances: (data: ImpedanceData[]) => void;
  setChannelActive: (channelIndex: number, isActive: boolean) => void;
  setDataSource: (source: DataSource | null) => void;
  setImpedanceMonitoring: (enabled: boolean) => void;
  clearElectrodeConfig: () => void;
  
  // Computed
  getElectrodeByChannel: (channelIndex: number) => ElectrodeInfo | undefined;
  getActiveElectrodes: () => ElectrodeInfo[];
  getImpedanceQuality: () => { good: number; fair: number; poor: number; disconnected: number };
}

export const createElectrodeSlice: StateCreator<ElectrodeSlice> = (set, get) => ({
  // Initial State
  electrodeConfig: null,
  channelMapping: new Map(),
  impedanceValues: new Map(),
  dataSource: null,
  isMonitoringImpedance: false,
  lastImpedanceUpdate: null,

  // Actions
  setElectrodeConfig: (config) => {
    const channelMapping = new Map<number, ElectrodeInfo>();
    config.layout.electrodes.forEach((electrode) => {
      channelMapping.set(electrode.channelIndex, electrode);
    });

    set({
      electrodeConfig: config,
      channelMapping,
    });
  },

  updateElectrodePosition: (electrodeId, position) => {
    const { electrodeConfig, channelMapping } = get();
    if (!electrodeConfig) return;

    const updatedElectrodes = electrodeConfig.layout.electrodes.map((electrode) =>
      electrode.id === electrodeId ? { ...electrode, position } : electrode
    );

    const updatedConfig: ElectrodeConfiguration = {
      ...electrodeConfig,
      layout: {
        ...electrodeConfig.layout,
        electrodes: updatedElectrodes,
      },
      updatedAt: Date.now(),
    };

    // Update channel mapping
    const newMapping = new Map(channelMapping);
    updatedElectrodes.forEach((electrode) => {
      if (electrode.id === electrodeId) {
        newMapping.set(electrode.channelIndex, electrode);
      }
    });

    set({
      electrodeConfig: updatedConfig,
      channelMapping: newMapping,
    });
  },

  updateImpedance: (data) => {
    const { electrodeConfig, channelMapping, impedanceValues } = get();
    if (!electrodeConfig) return;

    // Update impedance map
    const newImpedanceValues = new Map(impedanceValues);
    newImpedanceValues.set(data.channelId, data.impedance);

    // Update electrode quality
    const electrode = channelMapping.get(data.channelId);
    if (electrode) {
      const updatedElectrodes = electrodeConfig.layout.electrodes.map((e) =>
        e.channelIndex === data.channelId
          ? { ...e, impedance: data.impedance, quality: data.quality }
          : e
      );

      const updatedConfig: ElectrodeConfiguration = {
        ...electrodeConfig,
        layout: {
          ...electrodeConfig.layout,
          electrodes: updatedElectrodes,
        },
        updatedAt: Date.now(),
      };

      // Update channel mapping
      const newMapping = new Map(channelMapping);
      const updatedElectrode = updatedElectrodes.find(
        (e) => e.channelIndex === data.channelId
      );
      if (updatedElectrode) {
        newMapping.set(data.channelId, updatedElectrode);
      }

      set({
        electrodeConfig: updatedConfig,
        channelMapping: newMapping,
        impedanceValues: newImpedanceValues,
        lastImpedanceUpdate: data.timestamp,
      });
    } else {
      set({
        impedanceValues: newImpedanceValues,
        lastImpedanceUpdate: data.timestamp,
      });
    }
  },

  batchUpdateImpedances: (dataArray) => {
    const { electrodeConfig, impedanceValues } = get();
    if (!electrodeConfig) return;

    const newImpedanceValues = new Map(impedanceValues);
    const updatedElectrodes = [...electrodeConfig.layout.electrodes];

    dataArray.forEach((data) => {
      newImpedanceValues.set(data.channelId, data.impedance);

      const electrodeIndex = updatedElectrodes.findIndex(
        (e) => e.channelIndex === data.channelId
      );
      if (electrodeIndex !== -1) {
        updatedElectrodes[electrodeIndex] = {
          ...updatedElectrodes[electrodeIndex],
          impedance: data.impedance,
          quality: data.quality,
        };
      }
    });

    const updatedConfig: ElectrodeConfiguration = {
      ...electrodeConfig,
      layout: {
        ...electrodeConfig.layout,
        electrodes: updatedElectrodes,
      },
      updatedAt: Date.now(),
    };

    // Update channel mapping
    const newMapping = new Map<number, ElectrodeInfo>();
    updatedElectrodes.forEach((electrode) => {
      newMapping.set(electrode.channelIndex, electrode);
    });

    const latestTimestamp = Math.max(...dataArray.map((d) => d.timestamp));

    set({
      electrodeConfig: updatedConfig,
      channelMapping: newMapping,
      impedanceValues: newImpedanceValues,
      lastImpedanceUpdate: latestTimestamp,
    });
  },

  setChannelActive: (channelIndex, isActive) => {
    const { electrodeConfig, channelMapping } = get();
    if (!electrodeConfig) return;

    const updatedElectrodes = electrodeConfig.layout.electrodes.map((electrode) =>
      electrode.channelIndex === channelIndex ? { ...electrode, isActive } : electrode
    );

    const updatedConfig: ElectrodeConfiguration = {
      ...electrodeConfig,
      layout: {
        ...electrodeConfig.layout,
        electrodes: updatedElectrodes,
      },
      updatedAt: Date.now(),
    };

    // Update channel mapping
    const newMapping = new Map(channelMapping);
    const updatedElectrode = updatedElectrodes.find(
      (e) => e.channelIndex === channelIndex
    );
    if (updatedElectrode) {
      newMapping.set(channelIndex, updatedElectrode);
    }

    set({
      electrodeConfig: updatedConfig,
      channelMapping: newMapping,
    });
  },

  setDataSource: (source) => {
    set({ dataSource: source });
  },

  setImpedanceMonitoring: (enabled) => {
    set({ isMonitoringImpedance: enabled });
  },

  clearElectrodeConfig: () => {
    set({
      electrodeConfig: null,
      channelMapping: new Map(),
      impedanceValues: new Map(),
      dataSource: null,
      isMonitoringImpedance: false,
      lastImpedanceUpdate: null,
    });
  },

  // Computed
  getElectrodeByChannel: (channelIndex) => {
    return get().channelMapping.get(channelIndex);
  },

  getActiveElectrodes: () => {
    const { channelMapping } = get();
    return Array.from(channelMapping.values()).filter((e) => e.isActive);
  },

  getImpedanceQuality: () => {
    const { channelMapping } = get();
    const quality = {
      good: 0,
      fair: 0,
      poor: 0,
      disconnected: 0,
    };

    channelMapping.forEach((electrode) => {
      if (electrode.quality) {
        quality[electrode.quality]++;
      } else {
        quality.disconnected++;
      }
    });

    return quality;
  },
});
