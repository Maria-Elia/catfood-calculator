// localStorage-backed CRUD for cat and food profiles. The storage backend
// is injected so tests can swap in an in-memory mock instead of a real
// browser localStorage.

const CATS_KEY = "catfood_cats";
const FOODS_KEY = "catfood_foods";
const MEALS_KEY = "catfood_meals";

function readAll(backend, key) {
  const raw = backend.getItem(key);
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeAll(backend, key, items) {
  backend.setItem(key, JSON.stringify(items));
}

// crypto.randomUUID() only works in secure contexts (HTTPS or localhost)
function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
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
        id: generateId(),
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

function readMeals(backend) {
  const raw = backend.getItem(MEALS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function writeMeals(backend, meals) {
  backend.setItem(MEALS_KEY, JSON.stringify(meals));
}

export function createMealStore(backend) {
  return {
    list(catId) {
      const meals = readMeals(backend);
      return meals[catId] || [];
    },
    add(catId, entry) {
      const meals = readMeals(backend);
      const catMeals = meals[catId] || [];
      const withId = { ...entry, id: generateId() };
      meals[catId] = [...catMeals, withId];
      writeMeals(backend, meals);
      return withId;
    },
    update(catId, mealId, changes) {
      const meals = readMeals(backend);
      const catMeals = meals[catId] || [];
      const index = catMeals.findIndex((meal) => meal.id === mealId);
      if (index === -1) {
        throw new Error(`Kein Tagesplan mit id ${mealId} gefunden.`);
      }
      catMeals[index] = { ...catMeals[index], ...changes };
      meals[catId] = catMeals;
      writeMeals(backend, meals);
      return catMeals[index];
    },
    remove(catId, mealId) {
      const meals = readMeals(backend);
      const catMeals = meals[catId] || [];
      meals[catId] = catMeals.filter((meal) => meal.id !== mealId);
      writeMeals(backend, meals);
    },
  };
}
