// constants.js
export const STATES = {
  IDLE: 'idle',
  SOIL: 'soil',
  LIGHT: 'light',
  TEMP: 'temp',
  GROWTH: 'growth',
  MIRRAGE: 'mirrage',
  FLOWER: 'flower',
  TOTAL: 'total'
};

export const SUB_STATES = {
  NORMAL: 'normal',
  RECORD: 'record',
  BPM: 'bpm'
};

export const ESP_DEVICES = {
  ESP1: { id: 'esp1', name: 'ESP32-1', sensorType: 'soil' },
  ESP2: { id: 'esp2', name: 'ESP32-2', sensorType: 'light' },
  ESP3: { id: 'esp3', name: 'ESP32-3', sensorType: 'temp' }
};