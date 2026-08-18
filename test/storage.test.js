import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCatStore, createFoodStore, createMealStore } from '../js/storage.js';

function createMemoryBackend() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

test('cat store starts empty', () => {
  const store = createCatStore(createMemoryBackend());
  assert.deepEqual(store.list(), []);
});

test('cat store add() persists a cat with a generated id and timestamp', () => {
  const store = createCatStore(createMemoryBackend());
  const cat = store.add({ name: 'Mia', gewicht: 4, status: 'erwachsen_kastriert' });
  assert.equal(cat.name, 'Mia');
  assert.ok(cat.id, 'expected a generated id');
  assert.ok(cat.erstellt, 'expected a created timestamp');
  assert.equal(store.list().length, 1);
});

test('cat store add() falls back to crypto.getRandomValues when randomUUID is unavailable', () => {
  // Mirrors a real device on plain HTTP over a LAN IP (not localhost/HTTPS),
  // where crypto.randomUUID is undefined but getRandomValues still works.
  const original = crypto.randomUUID;
  crypto.randomUUID = undefined;
  try {
    const store = createCatStore(createMemoryBackend());
    const cat = store.add({ name: 'Mia', gewicht: 4, status: 'erwachsen_kastriert' });
    assert.match(cat.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    crypto.randomUUID = original;
  }
});

test('cat store update() changes an existing cat', () => {
  const store = createCatStore(createMemoryBackend());
  const cat = store.add({ name: 'Mia', gewicht: 4, status: 'erwachsen_kastriert' });
  const updated = store.update(cat.id, { gewicht: 4.5 });
  assert.equal(updated.gewicht, 4.5);
  assert.equal(store.list()[0].gewicht, 4.5);
});

test('cat store update() throws for an unknown id', () => {
  const store = createCatStore(createMemoryBackend());
  assert.throws(() => store.update('nope', { gewicht: 1 }), /Kein Eintrag/);
});

test('cat store remove() deletes a cat', () => {
  const store = createCatStore(createMemoryBackend());
  const cat = store.add({ name: 'Mia', gewicht: 4, status: 'erwachsen_kastriert' });
  store.remove(cat.id);
  assert.deepEqual(store.list(), []);
});

test('cat store and food store persist independently on the same backend', () => {
  const backend = createMemoryBackend();
  const cats = createCatStore(backend);
  const foods = createFoodStore(backend);
  cats.add({ name: 'Mia', gewicht: 4, status: 'erwachsen_kastriert' });
  assert.equal(cats.list().length, 1);
  assert.equal(foods.list().length, 0);
});

test('food store add() persists a food profile', () => {
  const store = createFoodStore(createMemoryBackend());
  const food = store.add({
    name: 'Marke X',
    typ: 'nass',
    feuchte: 80,
    protein: 10,
    fett: 6,
    rohfaser: 0.5,
    rohasche: 2,
  });
  assert.equal(food.typ, 'nass');
  assert.equal(store.list().length, 1);
});

test('meal store list() returns an empty array for a cat with no saved meals', () => {
  const store = createMealStore(createMemoryBackend());
  assert.deepEqual(store.list('cat-1'), []);
});

test('meal store add() persists a named meal with a generated id, scoped to a cat', () => {
  const store = createMealStore(createMemoryBackend());
  const meal = store.add('cat-1', { name: 'Frühstück', components: [{ foodId: 'food-a', grams: 100 }] });
  assert.equal(meal.name, 'Frühstück');
  assert.ok(meal.id, 'expected a generated id');
  assert.deepEqual(store.list('cat-1'), [meal]);
});

test('meal store keeps meals separate per cat', () => {
  const store = createMealStore(createMemoryBackend());
  store.add('cat-1', { name: 'A', components: [] });
  store.add('cat-2', { name: 'B', components: [] });
  assert.equal(store.list('cat-1').length, 1);
  assert.equal(store.list('cat-2').length, 1);
  assert.equal(store.list('cat-1')[0].name, 'A');
  assert.equal(store.list('cat-2')[0].name, 'B');
});

test('meal store add() appends without overwriting existing meals for the same cat', () => {
  const store = createMealStore(createMemoryBackend());
  store.add('cat-1', { name: 'Frühstück', components: [] });
  store.add('cat-1', { name: 'Abendessen', components: [] });
  const names = store.list('cat-1').map((meal) => meal.name);
  assert.deepEqual(names, ['Frühstück', 'Abendessen']);
});

test('meal store update() changes an existing meal', () => {
  const store = createMealStore(createMemoryBackend());
  const meal = store.add('cat-1', { name: 'Frühstück', components: [] });
  const updated = store.update('cat-1', meal.id, { name: 'Abendessen' });
  assert.equal(updated.name, 'Abendessen');
  assert.equal(store.list('cat-1')[0].name, 'Abendessen');
});

test('meal store update() throws for an unknown meal id', () => {
  const store = createMealStore(createMemoryBackend());
  assert.throws(() => store.update('cat-1', 'nope', { name: 'x' }), /Keine Mahlzeit/);
});

test('meal store remove() deletes a meal', () => {
  const store = createMealStore(createMemoryBackend());
  const meal = store.add('cat-1', { name: 'Frühstück', components: [] });
  store.remove('cat-1', meal.id);
  assert.deepEqual(store.list('cat-1'), []);
});

test('meal store persists independently from the cat/food stores on the same backend', () => {
  const backend = createMemoryBackend();
  const cats = createCatStore(backend);
  const meals = createMealStore(backend);
  cats.add({ name: 'Mia', gewicht: 4, status: 'erwachsen_kastriert' });
  assert.deepEqual(meals.list('anything'), []);
  assert.equal(cats.list().length, 1);
});
