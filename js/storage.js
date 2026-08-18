// localStorage-backed CRUD for cat and food profiles. The storage backend
// is injected so tests can swap in an in-memory mock instead of a real
// browser localStorage.

const CATS_KEY = 'catfood_cats';
const FOODS_KEY = 'catfood_foods';

function readAll(backend, key) {
  const raw = backend.getItem(key);
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeAll(backend, key, items) {
  backend.setItem(key, JSON.stringify(items));
}

function createStore(backend, key) {
  return {
    list() {
      return readAll(backend, key);
    },
    add(entry) {
      const items = readAll(backend, key);
      const withId = {
        ...entry,
        id: crypto.randomUUID(),
        erstellt: new Date().toISOString(),
      };
      items.push(withId);
      writeAll(backend, key, items);
      return withId;
    },
    update(id, changes) {
      const items = readAll(backend, key);
      const index = items.findIndex((item) => item.id === id);
      if (index === -1) {
        throw new Error(`Kein Eintrag mit id ${id} gefunden.`);
      }
      items[index] = { ...items[index], ...changes };
      writeAll(backend, key, items);
      return items[index];
    },
    remove(id) {
      const items = readAll(backend, key).filter((item) => item.id !== id);
      writeAll(backend, key, items);
    },
  };
}

export function createCatStore(backend) {
  return createStore(backend, CATS_KEY);
}

export function createFoodStore(backend) {
  return createStore(backend, FOODS_KEY);
}
