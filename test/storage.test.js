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

test('meal store returns an empty list for a cat with no saved meal', () => {
  const store = createMealStore(createMemoryBackend());
  assert.deepEqual(store.getComponents('cat-1'), []);
});

test('meal store setComponents() persists components scoped to a cat', () => {
  const store = createMealStore(createMemoryBackend());
  store.setComponents('cat-1', [{ foodId: 'food-a', grams: 100 }]);
  assert.deepEqual(store.getComponents('cat-1'), [{ foodId: 'food-a', grams: 100 }]);
});

test('meal store keeps components separate per cat', () => {
  const store = createMealStore(createMemoryBackend());
  store.setComponents('cat-1', [{ foodId: 'food-a', grams: 100 }]);
  store.setComponents('cat-2', [{ foodId: 'food-b', grams: 50 }]);
  assert.deepEqual(store.getComponents('cat-1'), [{ foodId: 'food-a', grams: 100 }]);
  assert.deepEqual(store.getComponents('cat-2'), [{ foodId: 'food-b', grams: 50 }]);
});

test("meal store setComponents() overwrites a cat's previous components", () => {
  const store = createMealStore(createMemoryBackend());
  store.setComponents('cat-1', [{ foodId: 'food-a', grams: 100 }]);
  store.setComponents('cat-1', [{ foodId: 'food-b', grams: 50 }]);
  assert.deepEqual(store.getComponents('cat-1'), [{ foodId: 'food-b', grams: 50 }]);
});

test('meal store persists independently from the cat/food stores on the same backend', () => {
  const backend = createMemoryBackend();
  const cats = createCatStore(backend);
  const meals = createMealStore(backend);
  cats.add({ name: 'Mia', gewicht: 4, status: 'erwachsen_kastriert' });
  assert.deepEqual(meals.getComponents('anything'), []);
  assert.equal(cats.list().length, 1);
});
