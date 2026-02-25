export interface PVPanel {
  id: string;
  power: number;
  voltage: number;
  current: number;
  temperature: number;
  yieldToday: number;
}

export interface HoymilesData {
  powerNow: number;
  todayYield: number;
  totalYield: number;
  panels: PVPanel[];
  inverterTemp: number;
  status: 'producing' | 'idle' | 'offline';
}

export interface BatteryData {
  soc: number;
  power: number;
  voltage: number;
  current: number;
  temperature: number;
  capacityWh: number;
  status: 'charging' | 'discharging' | 'idle' | 'offline';
  cycles: number;
}

export interface BatteryPack {
  id: string;
  cells: number[];
}

export interface LiFePO4DiyData extends BatteryData {
  cellVoltages: number[];
  cellCount: number;
  bmsTemperature: number;
  balancing: boolean;
  minCellVoltage: number;
  maxCellVoltage: number;
  cellDelta: number;
  batteryPacks: BatteryPack[];
}

export interface VictronData {
  mode: 'off' | 'inverting' | 'charging' | 'passthrough';
  inputVoltage: number;
  inputFrequency: number;
  outputVoltage: number;
  outputFrequency: number;
  outputPower: number;
  loadPercent: number;
  warnings: string[];
  alarms: string[];
}

export interface ShellyPhase {
  voltage: number;
  current: number;
  power: number;
  apparentPower: number;
  powerFactor: number;
  frequency: number;
}

export interface ShellyData {
  phases: [ShellyPhase, ShellyPhase, ShellyPhase];
  totalPower: number;
  totalImportWh: number;
  totalExportWh: number;
}

export interface SystemState {
  timestamp: string;
  pv: HoymilesData;
  ms2a: BatteryData;
  lifepoDiy: LiFePO4DiyData;
  victron: VictronData;
  grid: ShellyData;
  computed: {
    selfConsumptionPercent: number;
    autarkyPercent: number;
    netGridPower: number;
    totalBatteryPower: number;
    totalBatterySoc: number;
  };
}

export interface HistoryPoint {
  timestamp: string;
  pvPower: number;
  gridPower: number;
  batteryPower: number;
  consumption: number;
  // Shelly energy totals
  gridImportWh: number;
  gridExportWh: number;
  // Battery details
  ms2aSoc: number;
  ms2aPower: number;
  lifepeSoc: number;
  lifepePower: number;
  // Victron
  victronMode: string;
}

export interface DailySummary {
  date: string;
  pvYieldKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  chargeKwh: number;
  dischargeKwh: number;
}

export interface DailyHistoryResponse {
  days: DailySummary[];
  averages: DailySummary;
}
