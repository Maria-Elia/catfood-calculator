import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rerKcal, dailyEnergyNeedKcal, STATUS_FACTORS } from '../js/calc.js';

test('rerKcal computes resting energy requirement for a 4kg cat', () => {
  const result = rerKcal(4);
  assert.ok(Math.abs(result - 197.9899) < 0.01, `expected ~197.99, got ${result}`);
});

test('rerKcal rejects non-positive weight', () => {
  assert.throws(() => rerKcal(0), /Gewicht/);
  assert.throws(() => rerKcal(-2), /Gewicht/);
});

test('dailyEnergyNeedKcal applies the neutered adult factor', () => {
  const result = dailyEnergyNeedKcal(4, 'erwachsen_kastriert');
  assert.ok(Math.abs(result - 237.588) < 0.01, `expected ~237.59, got ${result}`);
});

test('dailyEnergyNeedKcal applies the intact adult factor and differs from neutered', () => {
  const neutered = dailyEnergyNeedKcal(4, 'erwachsen_kastriert');
  const intact = dailyEnergyNeedKcal(4, 'erwachsen_unkastriert');
  assert.ok(intact > neutered, 'intact adult should need more kcal than neutered');
  const expectedDiff = rerKcal(4) * (STATUS_FACTORS.erwachsen_unkastriert - STATUS_FACTORS.erwachsen_kastriert);
  assert.ok(Math.abs((intact - neutered) - expectedDiff) < 0.001);
});

test('dailyEnergyNeedKcal rejects an unknown status', () => {
  assert.throws(() => dailyEnergyNeedKcal(4, 'nicht_vorhanden'), /Unbekannter Status/);
});
