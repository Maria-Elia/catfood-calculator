import { createCatStore, createFoodStore } from "./storage.js";
import {
  STATUS_LABELS,
  dailyEnergyNeedKcal,
  foodEnergyKcalPer100g,
  feedingGramsPerDay,
} from "./calc.js";

const catStore = createCatStore(window.localStorage);
const foodStore = createFoodStore(window.localStorage);

// ---- Cats ----

const catForm = document.getElementById("cat-form");
const catIdField = document.getElementById("cat-id");
const catNameField = document.getElementById("cat-name");
const catWeightField = document.getElementById("cat-weight");
const catStatusField = document.getElementById("cat-status");
const catFormError = document.getElementById("cat-form-error");
const catList = document.getElementById("cat-list");
const catEmpty = document.getElementById("cat-empty");

function resetCatForm() {
  catForm.reset();
  // Empty id means "add" on next submit; edit fills this back in.
  catIdField.value = "";
  catFormError.hidden = true;
}

function renderCatList() {
  const cats = catStore.list();
  catList.innerHTML = "";
  catEmpty.hidden = cats.length > 0;

  for (const cat of cats) {
    const li = document.createElement("li");
    li.className = "profile-card";
    li.dataset.id = cat.id;

    const kcal = dailyEnergyNeedKcal(cat.gewicht, cat.status);

    li.innerHTML = `
      <div class="profile-card__main">
        <span class="profile-card__name">${cat.name}</span>
        <span class="profile-card__meta">${cat.gewicht} kg &middot; ${STATUS_LABELS[cat.status]}</span>
        <span class="profile-card__kcal">${Math.round(kcal)} kcal/Tag</span>
      </div>
      <div class="profile-card__actions">
        <button type="button" class="btn-text" data-action="edit">Bearbeiten</button>
        <button type="button" class="btn-text" data-action="delete">Löschen</button>
      </div>
    `;
    catList.appendChild(li);
  }
}

catForm.addEventListener("submit", (event) => {
  event.preventDefault();
  catFormError.hidden = true;

  const entry = {
    name: catNameField.value.trim(),
    gewicht: Number(catWeightField.value),
    status: catStatusField.value,
  };

  // Reuse calc.js's own validation instead of duplicating range checks here
  try {
    dailyEnergyNeedKcal(entry.gewicht, entry.status);
  } catch (error) {
    catFormError.textContent = error.message;
    catFormError.hidden = false;
    return;
  }

  if (!entry.name) {
    catFormError.textContent = "Name darf nicht leer sein.";
    catFormError.hidden = false;
    return;
  }

  const id = catIdField.value;
  if (id) {
    catStore.update(id, entry);
  } else {
    catStore.add(entry);
  }

  resetCatForm();
  renderCatList();
  renderCatOptions();
  updateResult();
});

// One delegated listener, the list is rebuilt on every render
catList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const li = button.closest(".profile-card");
  const id = li.dataset.id;

  if (button.dataset.action === "edit") {
    const cat = catStore.list().find((item) => item.id === id);
    catIdField.value = cat.id;
    catNameField.value = cat.name;
    catWeightField.value = cat.gewicht;
    catStatusField.value = cat.status;
    catNameField.focus();
  }

  if (button.dataset.action === "delete") {
    catStore.remove(id);
    renderCatList();
    renderCatOptions();
    updateResult();
  }
});

renderCatList();

// ---- Foods ----

// UI copy for the typ tag
const FOOD_TYPE_LABELS = {
  trocken: "Trockenfutter",
  nass: "Nassfutter",
};

const foodForm = document.getElementById("food-form");
const foodIdField = document.getElementById("food-id");
const foodNameField = document.getElementById("food-name");
const foodTypeField = document.getElementById("food-type");
const foodFeuchteField = document.getElementById("food-feuchte");
const foodProteinField = document.getElementById("food-protein");
const foodFettField = document.getElementById("food-fett");
const foodRohfaserField = document.getElementById("food-rohfaser");
const foodRohascheField = document.getElementById("food-rohasche");
const foodFormError = document.getElementById("food-form-error");
const foodList = document.getElementById("food-list");
const foodEmpty = document.getElementById("food-empty");

function resetFoodForm() {
  foodForm.reset();
  foodIdField.value = "";
  foodFormError.hidden = true;
}

function renderFoodList() {
  const foods = foodStore.list();
  foodList.innerHTML = "";
  foodEmpty.hidden = foods.length > 0;

  for (const food of foods) {
    const li = document.createElement("li");
    li.className = "profile-card";
    li.dataset.id = food.id;

    const kcal100g = foodEnergyKcalPer100g(food);

    li.innerHTML = `
      <div class="profile-card__main">
        <span class="profile-card__name">${food.name}</span>
        <span class="profile-card__meta">${FOOD_TYPE_LABELS[food.typ]}</span>
        <span class="profile-card__kcal">${kcal100g.toFixed(1)} kcal/100g</span>
      </div>
      <div class="profile-card__actions">
        <button type="button" class="btn-text" data-action="edit">Bearbeiten</button>
        <button type="button" class="btn-text" data-action="delete">Löschen</button>
      </div>
    `;
    foodList.appendChild(li);
  }
}

foodForm.addEventListener("submit", (event) => {
  event.preventDefault();
  foodFormError.hidden = true;

  const entry = {
    name: foodNameField.value.trim(),
    typ: foodTypeField.value,
    feuchte: Number(foodFeuchteField.value),
    protein: Number(foodProteinField.value),
    fett: Number(foodFettField.value),
    rohfaser: Number(foodRohfaserField.value),
    rohasche: Number(foodRohascheField.value),
  };

  // let calc.js's own validation produce the inline error, don't duplicate the percentage/NfE checks here.
  try {
    foodEnergyKcalPer100g(entry);
  } catch (error) {
    foodFormError.textContent = error.message;
    foodFormError.hidden = false;
    return;
  }

  if (!entry.name) {
    foodFormError.textContent = "Name darf nicht leer sein.";
    foodFormError.hidden = false;
    return;
  }

  const id = foodIdField.value;
  if (id) {
    foodStore.update(id, entry);
  } else {
    foodStore.add(entry);
  }

  resetFoodForm();
  renderFoodList();
  renderFoodOptions();
  updateResult();
});

foodList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const li = button.closest(".profile-card");
  const id = li.dataset.id;

  if (button.dataset.action === "edit") {
    const food = foodStore.list().find((item) => item.id === id);
    foodIdField.value = food.id;
    foodNameField.value = food.name;
    foodTypeField.value = food.typ;
    foodFeuchteField.value = food.feuchte;
    foodProteinField.value = food.protein;
    foodFettField.value = food.fett;
    foodRohfaserField.value = food.rohfaser;
    foodRohascheField.value = food.rohasche;
    foodNameField.focus();
  }

  if (button.dataset.action === "delete") {
    foodStore.remove(id);
    renderFoodList();
    renderFoodOptions();
    updateResult();
  }
});

renderFoodList();

// ---- Calculator ----

const catSelect = document.getElementById("cat-select");
const foodSelect = document.getElementById("food-select");
const resultPanel = document.getElementById("result-panel");
const resultEmpty = document.getElementById("result-empty");
const resultKcal = document.getElementById("result-kcal");
const resultKcal100 = document.getElementById("result-kcal100");
const resultGrams = document.getElementById("result-grams");

function renderCatOptions() {
  // Preserve the current selection across a rebuild where possible
  const selected = catSelect.value;
  catSelect.innerHTML = '<option value="">Katze wählen…</option>';
  for (const cat of catStore.list()) {
    const option = document.createElement("option");
    option.value = cat.id;
    option.textContent = cat.name;
    catSelect.appendChild(option);
  }
  catSelect.value = catStore.list().some((cat) => cat.id === selected) ? selected : "";
}

function renderFoodOptions() {
  const selected = foodSelect.value;
  foodSelect.innerHTML = '<option value="">Futter wählen…</option>';
  for (const food of foodStore.list()) {
    const option = document.createElement("option");
    option.value = food.id;
    option.textContent = food.name;
    foodSelect.appendChild(option);
  }
  foodSelect.value = foodStore.list().some((food) => food.id === selected) ? selected : "";
}

function updateResult() {
  // Re-read from the store rather than caching the selected objects
  const cat = catStore.list().find((item) => item.id === catSelect.value);
  const food = foodStore.list().find((item) => item.id === foodSelect.value);

  if (!cat || !food) {
    resultPanel.hidden = true;
    resultEmpty.hidden = false;
    return;
  }

  const dailyKcal = dailyEnergyNeedKcal(cat.gewicht, cat.status);
  const kcal100g = foodEnergyKcalPer100g(food);
  const grams = feedingGramsPerDay(dailyKcal, kcal100g);

  resultKcal.textContent = `${Math.round(dailyKcal)} kcal`;
  resultKcal100.textContent = `${kcal100g.toFixed(1)} kcal/100g`;
  resultGrams.textContent = `${Math.round(grams)} g`;

  resultPanel.hidden = false;
  resultEmpty.hidden = true;
}

catSelect.addEventListener("change", updateResult);
foodSelect.addEventListener("change", updateResult);

renderCatOptions();
renderFoodOptions();
updateResult();
