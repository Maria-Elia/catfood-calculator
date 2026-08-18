import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rerKcal,
  dailyEnergyNeedKcal,
  STATUS_FACTORS,
  FOOD_TYPE_LABELS,
  foodEnergyKcalPer100g,
  feedingGramsPerDay,
  dailyWaterNeedMl,
  foodWaterGramsPerDay,
  mealTotalKcal,
  mealTotalWaterMl,
  mealStatus,
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

test('dailyWaterNeedMl scales linearly with weight at 50ml/kg', () => {
  assert.equal(dailyWaterNeedMl(4), 200);
  assert.equal(dailyWaterNeedMl(2), 100);
});

test('dailyWaterNeedMl rejects non-positive weight', () => {
  assert.throws(() => dailyWaterNeedMl(0), /Gewicht/);
  assert.throws(() => dailyWaterNeedMl(-2), /Gewicht/);
});

test('foodWaterGramsPerDay derives water content from feeding grams and moisture', () => {
  assert.equal(foodWaterGramsPerDay(250, 80), 200);
  assert.equal(foodWaterGramsPerDay(100, 10), 10);
});

test('foodWaterGramsPerDay rejects invalid inputs', () => {
  assert.throws(() => foodWaterGramsPerDay(0, 80), /Futtermenge/);
  assert.throws(() => foodWaterGramsPerDay(250, -1), /Feuchte/);
  assert.throws(() => foodWaterGramsPerDay(250, 101), /Feuchte/);
});

test('FOOD_TYPE_LABELS includes trocken, nass, and leckerli', () => {
  assert.equal(FOOD_TYPE_LABELS.trocken, 'Trockenfutter');
  assert.equal(FOOD_TYPE_LABELS.nass, 'Nassfutter');
  assert.equal(FOOD_TYPE_LABELS.leckerli, 'Leckerli');
});

test('mealTotalKcal sums kcal contributions across components', () => {
  const foods = [
    { id: 'a', feuchte: 80, protein: 10, fett: 6, rohfaser: 0.5, rohasche: 2 },
    { id: 'b', feuchte: 8, protein: 30, fett: 15, rohfaser: 2, rohasche: 7 },
  ];
  const kcalB = foodEnergyKcalPer100g(foods[1]);
  const components = [
    { foodId: 'a', grams: 200 },
    { foodId: 'b', grams: 50 },
  ];
  const expected = 2 * 95.412 + (50 / 100) * kcalB;
  const result = mealTotalKcal(components, foods);
  assert.ok(Math.abs(result - expected) < 0.01, `expected ~${expected}, got ${result}`);
});

test('mealTotalKcal skips components referencing a missing food', () => {
  const foods = [{ id: 'a', feuchte: 80, protein: 10, fett: 6, rohfaser: 0.5, rohasche: 2 }];
  const components = [
    { foodId: 'a', grams: 100 },
    { foodId: 'missing', grams: 999 },
  ];
  const result = mealTotalKcal(components, foods);
  assert.ok(Math.abs(result - 95.412) < 0.01, `expected ~95.41, got ${result}`);
});

test('mealTotalWaterMl sums moisture-derived water across components', () => {
  const foods = [
    { id: 'a', feuchte: 80, protein: 10, fett: 6, rohfaser: 0.5, rohasche: 2 },
    { id: 'b', feuchte: 10, protein: 30, fett: 15, rohfaser: 2, rohasche: 7 },
  ];
  const components = [
    { foodId: 'a', grams: 250 },
    { foodId: 'b', grams: 100 },
  ];
  assert.equal(mealTotalWaterMl(components, foods), 210);
});

test('mealTotalWaterMl skips components referencing a missing food', () => {
  const foods = [{ id: 'a', feuchte: 80, protein: 10, fett: 6, rohfaser: 0.5, rohasche: 2 }];
  const components = [
    { foodId: 'a', grams: 250 },
    { foodId: 'missing', grams: 999 },
  ];
  assert.equal(mealTotalWaterMl(components, foods), 200);
});

test('mealStatus returns gruen within 5% of daily need', () => {
  const over = mealStatus(210, 200);
  assert.equal(over.status, 'gruen');
  assert.ok(Math.abs(over.deviationPercent - 5) < 0.001);

  const under = mealStatus(190, 200);
  assert.equal(under.status, 'gruen');
});

test('mealStatus returns gelb between 5% and 10% deviation', () => {
  const over = mealStatus(220, 200);
  assert.equal(over.status, 'gelb');

  const under = mealStatus(180, 200);
  assert.equal(under.status, 'gelb');
});

test('mealStatus returns rot beyond 10% deviation', () => {
  const over = mealStatus(230, 200);
  assert.equal(over.status, 'rot');

  const under = mealStatus(170, 200);
  assert.equal(under.status, 'rot');
});

test('mealStatus rejects a non-positive daily need', () => {
  assert.throws(() => mealStatus(100, 0), /Tagesbedarf/);
  assert.throws(() => mealStatus(100, -5), /Tagesbedarf/);
});
