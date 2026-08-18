import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rerKcal,
  dailyEnergyNeedKcal,
  STATUS_FACTORS,
  foodEnergyKcalPer100g,
  feedingGramsPerDay,
} from '../js/calc.js';

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

test('foodEnergyKcalPer100g computes ME for a typical wet food', () => {
  const result = foodEnergyKcalPer100g({ feuchte: 80, protein: 10, fett: 6, rohfaser: 0.5, rohasche: 2 });
  assert.ok(Math.abs(result - 95.412) < 0.01, `expected ~95.41, got ${result}`);
});

test('foodEnergyKcalPer100g rejects values that do not add up (negative NfE)', () => {
  assert.throws(
    () => foodEnergyKcalPer100g({ feuchte: 10, protein: 40, fett: 40, rohfaser: 10, rohasche: 10 }),
    /Nährwerte/
  );
});

test('foodEnergyKcalPer100g rejects out-of-range percentages', () => {
  assert.throws(
    () => foodEnergyKcalPer100g({ feuchte: 80, protein: -1, fett: 6, rohfaser: 0.5, rohasche: 2 }),
    /protein/
  );
});

test('foodEnergyKcalPer100g rejects feuchte at or above 100', () => {
  assert.throws(
    () => foodEnergyKcalPer100g({ feuchte: 100, protein: 0, fett: 0, rohfaser: 0, rohasche: 0 }),
    /Feuchte/
  );
});

test('feedingGramsPerDay combines need and food energy into grams', () => {
  const dailyNeed = dailyEnergyNeedKcal(4, 'erwachsen_kastriert');
  const kcal100g = foodEnergyKcalPer100g({ feuchte: 80, protein: 10, fett: 6, rohfaser: 0.5, rohasche: 2 });
  const grams = feedingGramsPerDay(dailyNeed, kcal100g);
  assert.ok(Math.abs(grams - 249.01) < 0.5, `expected ~249g, got ${grams}`);
});

test('feedingGramsPerDay rejects zero or negative food energy', () => {
  assert.throws(() => feedingGramsPerDay(200, 0), /Energiegehalt/);
  assert.throws(() => feedingGramsPerDay(200, -5), /Energiegehalt/);
});

test('feedingGramsPerDay rejects zero or negative daily need', () => {
  assert.throws(() => feedingGramsPerDay(0, 95), /Tagesbedarf/);
  assert.throws(() => feedingGramsPerDay(-10, 95), /Tagesbedarf/);
});
