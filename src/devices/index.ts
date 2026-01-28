/**
 * Universal EEG Device Support
 * 
 * Central export for all device-related utilities, profiles, and adapters.
 */

// Device profiles and registry
export {
  DEVICE_PROFILES,
  BRAINFLOW_BOARD_IDS,
  getDeviceProfile,
  listDeviceProfiles,
  getDevicesByManufacturer,
  getBrainflowCompatibleDevices,
  getBrainflowBoardId,
  getScaleFactorUV,
  getDefaultChannelLabels,
  supportsProtocol,
} from './deviceProfiles';

export type {
  DeviceProfile,
  DeviceProtocol,
  DeviceManufacturer,
  DeviceCapabilities,
  DefaultMontage,
  ADCChip,
} from './deviceProfiles';
