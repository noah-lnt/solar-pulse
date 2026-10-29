import { VictronData } from './collectors/types';

export interface EnergyFlows {
  consumption: number;
  linkyPower: number;
  consumptionSource: 'linky' | 'solar_battery';
  selfConsumptionPercent: number;
  autarkyPercent: number;
}

function percent(part: number, whole: number): number {
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

// The PV sits on the house side of the Shelly. Victron OFF: the Shelly measures the Linky.
// Victron ON: a switch isolates the house from the Linky and the Shelly measures the Victron line.
export function computeEnergyFlows(pvPower: number, shellyPower: number, victronMode: VictronData['mode']): EnergyFlows {
  const victronOn = victronMode !== 'off';
  const consumption = Math.max(0, pvPower + shellyPower);
  const linkyPower = victronOn ? 0 : shellyPower;
  const linkyImport = Math.max(0, linkyPower);
  const linkyExport = Math.max(0, -linkyPower);

  return {
    consumption: Math.round(consumption),
    linkyPower: Math.round(linkyPower),
    consumptionSource: victronOn ? 'solar_battery' : 'linky',
    selfConsumptionPercent: pvPower > 0 ? percent(pvPower - Math.min(pvPower, linkyExport), pvPower) : 0,
    autarkyPercent: consumption > 0 ? percent(consumption - linkyImport, consumption) : 0,
  };
}
