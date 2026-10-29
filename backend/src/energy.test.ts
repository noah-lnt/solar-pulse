import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEnergyFlows } from './energy';

test('Victron OFF, night: everything comes from the Linky', () => {
  assert.deepEqual(computeEnergyFlows(0, 800, 'off'), {
    consumption: 800, linkyPower: 800, consumptionSource: 'linky', selfConsumptionPercent: 0, autarkyPercent: 0,
  });
});

test('Victron OFF, PV surplus exported to the Linky', () => {
  const f = computeEnergyFlows(3000, -1000, 'off');
  assert.equal(f.consumption, 2000);
  assert.equal(f.linkyPower, -1000);
  assert.equal(f.selfConsumptionPercent, 67);
  assert.equal(f.autarkyPercent, 100);
});

test('Victron OFF, PV covers part of the load', () => {
  const f = computeEnergyFlows(500, 1500, 'off');
  assert.equal(f.consumption, 2000);
  assert.equal(f.autarkyPercent, 25);
  assert.equal(f.selfConsumptionPercent, 100);
});

test('Victron ON, battery feeds the house: no Linky energy, battery not counted twice', () => {
  const f = computeEnergyFlows(0, 900, 'inverting');
  assert.equal(f.consumption, 900);
  assert.equal(f.linkyPower, 0);
  assert.equal(f.consumptionSource, 'solar_battery');
  assert.equal(f.autarkyPercent, 100);
});

test('Victron ON, PV surplus charges the battery: fully self-consumed', () => {
  const f = computeEnergyFlows(3000, -2000, 'passthrough');
  assert.equal(f.consumption, 1000);
  assert.equal(f.linkyPower, 0);
  assert.equal(f.selfConsumptionPercent, 100);
  assert.equal(f.autarkyPercent, 100);
});
