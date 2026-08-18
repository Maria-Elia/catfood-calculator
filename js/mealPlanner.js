// builds a per-cat meal from multiple saved food components and checks the total against the cat's daily energy need.
// The component table works on an in-memory draft (draftComponents, editingMealId) until the user explicitly
// saves it as a named meal via mealStore.

import { createMealStore } from "./storage.js";
import {
  FOOD_TYPE_LABELS,
  dailyEnergyNeedKcal,
  dailyWaterNeedMl,
  foodEnergyKcalPer100g,
  mealTotalKcal,
  mealTotalWaterMl,
  mealStatus,
} from "./calc.js";

const STATUS_BADGE_LABELS = {
  gruen: "Im grünen Bereich",
  gelb: "Leicht abweichend",
  rot: "Deutlich abweichend",
};

export function initMealPlanner({ catStore, foodStore }) {
  const mealStore = createMealStore(window.localStorage);

  let draftComponents = [];
  let editingMealId = null;

  const catSelect = document.getElementById("meal-cat-select");
  const catHint = document.getElementById("meal-select-cat-hint");
  const plannerBody = document.getElementById("meal-planner-body");
  const foodSelect = document.getElementById("meal-food-select");
  const gramsInput = document.getElementById("meal-grams-input");
  const addBtn = document.getElementById("meal-add-btn");
  const addError = document.getElementById("meal-add-error");
  const componentList = document.getElementById("meal-component-list");
  const emptyState = document.getElementById("meal-empty");
  const summary = document.getElementById("meal-summary");
  const summaryTotal = document.getElementById("meal-summary-total");
  const summaryNeed = document.getElementById("meal-summary-need");
  const summaryBadge = document.getElementById("meal-summary-badge");
  const summaryWaterNeed = document.getElementById("meal-summary-water-need");
  const summaryWaterFood = document.getElementById("meal-summary-water-food");
  const summaryWaterExtra = document.getElementById("meal-summary-water-extra");
  const nameInput = document.getElementById("meal-name-input");
  const saveBtn = document.getElementById("meal-save-btn");
  const newBtn = document.getElementById("meal-new-btn");
  const saveError = document.getElementById("meal-save-error");
  const savedList = document.getElementById("meal-saved-list");
  const savedEmpty = document.getElementById("meal-saved-empty");

  function resetDraft() {
    draftComponents = [];
    editingMealId = null;
    nameInput.value = "";
  }

  function refreshCatOptions() {
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

  function refreshFoodOptions() {
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

  function renderDraft(cat, foods) {
    // A component's food may have been deleted since it was added to the
    // draft; drop it since the draft is unsaved, so there's nothing to persist.
    draftComponents = draftComponents.filter((component) =>
      foods.some((food) => food.id === component.foodId),
    );

    componentList.innerHTML = "";
    emptyState.hidden = draftComponents.length > 0;

    for (const component of draftComponents) {
      const food = foods.find((item) => item.id === component.foodId);
      const kcal = (component.grams / 100) * foodEnergyKcalPer100g(food);

      const row = document.createElement("tr");
      row.dataset.foodId = component.foodId;
      row.innerHTML = `
        <td>${food.name}</td>
        <td>${FOOD_TYPE_LABELS[food.typ]}</td>
        <td><input type="number" class="meal-planner__grams-input" value="${component.grams}" min="1" step="1" /></td>
        <td>${Math.round(kcal)} kcal</td>
        <td><button type="button" class="btn-text" data-action="remove">Entfernen</button></td>
      `;
      componentList.appendChild(row);
    }

    if (draftComponents.length === 0) {
      summary.hidden = true;
      return;
    }

    summary.hidden = false;
    const totalKcal = mealTotalKcal(draftComponents, foods);
    const dailyKcal = dailyEnergyNeedKcal(cat.gewicht, cat.status);
    const { status, deviationPercent } = mealStatus(totalKcal, dailyKcal);
    const totalWaterMl = mealTotalWaterMl(draftComponents, foods);
    const waterNeedMl = dailyWaterNeedMl(cat.gewicht);
    const waterExtraMl = Math.max(0, waterNeedMl - totalWaterMl);

    summaryTotal.textContent = `${Math.round(totalKcal)} kcal`;
    summaryNeed.textContent = `${Math.round(dailyKcal)} kcal`;
    summaryBadge.textContent = `${STATUS_BADGE_LABELS[status]} (${deviationPercent >= 0 ? "+" : ""}${Math.round(deviationPercent)}%)`;
    summaryBadge.className = `meal-summary__badge meal-summary__badge--${status}`;
    summaryWaterNeed.textContent = `${Math.round(waterNeedMl)} ml`;
    summaryWaterFood.textContent = `${Math.round(totalWaterMl)} ml`;
    summaryWaterExtra.textContent = `${Math.round(waterExtraMl)} ml`;
  }

  function renderSavedMeals(catId, foods) {
    // A saved meal's food may have been deleted; drop that component and
    // persist the cleanup so the card never shows a broken reference.
    const meals = mealStore.list(catId).map((meal) => {
      const components = meal.components.filter((component) =>
        foods.some((food) => food.id === component.foodId),
      );
      if (components.length === meal.components.length) return meal;
      mealStore.update(catId, meal.id, { components });
      return { ...meal, components };
    });

    savedList.innerHTML = "";
    savedEmpty.hidden = meals.length > 0;

    for (const meal of meals) {
      const totalKcal = mealTotalKcal(meal.components, foods);

      const li = document.createElement("li");
      li.className = "profile-card";
      li.dataset.id = meal.id;
      li.innerHTML = `
        <div class="profile-card__main">
          <span class="profile-card__name">${meal.name}</span>
          <span class="profile-card__kcal">${Math.round(totalKcal)} kcal</span>
        </div>
        <div class="profile-card__actions">
          <button type="button" class="btn-text" data-action="load">Laden</button>
          <button type="button" class="btn-text" data-action="delete">Löschen</button>
        </div>
      `;
      savedList.appendChild(li);
    }
  }

  function render() {
    const catId = catSelect.value;

    if (!catId) {
      plannerBody.hidden = true;
      catHint.hidden = false;
      return;
    }

    plannerBody.hidden = false;
    catHint.hidden = true;

    const cat = catStore.list().find((item) => item.id === catId);
    const foods = foodStore.list();

    renderDraft(cat, foods);
    renderSavedMeals(catId, foods);
  }

  function refresh() {
    refreshCatOptions();
    refreshFoodOptions();
    render();
  }

  catSelect.addEventListener("change", () => {
    resetDraft();
    render();
  });

  addBtn.addEventListener("click", () => {
    addError.hidden = true;
    const catId = catSelect.value;
    const foodId = foodSelect.value;
    const grams = Number(gramsInput.value);

    if (!catId) {
      addError.textContent = "Wähl zuerst eine Katze aus.";
      addError.hidden = false;
      return;
    }
    if (!foodId) {
      addError.textContent = "Wähl ein Futter aus.";
      addError.hidden = false;
      return;
    }
    if (!(grams > 0)) {
      addError.textContent = "Gramm muss eine Zahl größer als 0 sein.";
      addError.hidden = false;
      return;
    }
    if (draftComponents.some((component) => component.foodId === foodId)) {
      addError.textContent =
        "Dieses Futter ist schon in der Mahlzeit. Passe die Menge direkt in der Tabelle an.";
      addError.hidden = false;
      return;
    }

    draftComponents = [...draftComponents, { foodId, grams }];
    foodSelect.value = "";
    gramsInput.value = "";
    render();
  });

  componentList.addEventListener("change", (event) => {
    const input = event.target.closest(".meal-planner__grams-input");
    if (!input) return;

    const grams = Number(input.value);
    if (!(grams > 0)) {
      render(); // reset the input back to the last valid value
      return;
    }

    const foodId = input.closest("tr").dataset.foodId;
    draftComponents = draftComponents.map((component) =>
      component.foodId === foodId ? { ...component, grams } : component,
    );
    render();
  });

  componentList.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-action="remove"]');
    if (!button) return;

    const foodId = button.closest("tr").dataset.foodId;
    draftComponents = draftComponents.filter((component) => component.foodId !== foodId);
    render();
  });

  saveBtn.addEventListener("click", () => {
    saveError.hidden = true;
    const catId = catSelect.value;
    const name = nameInput.value.trim();

    if (!catId) {
      saveError.textContent = "Wähl zuerst eine Katze aus.";
      saveError.hidden = false;
      return;
    }
    if (!name) {
      saveError.textContent = "Name darf nicht leer sein.";
      saveError.hidden = false;
      return;
    }
    if (draftComponents.length === 0) {
      saveError.textContent = "Füg mindestens ein Futter hinzu, bevor du speicherst.";
      saveError.hidden = false;
      return;
    }

    if (editingMealId) {
      mealStore.update(catId, editingMealId, { name, components: draftComponents });
    } else {
      const saved = mealStore.add(catId, { name, components: draftComponents });
      editingMealId = saved.id;
    }
    render();
  });

  newBtn.addEventListener("click", () => {
    resetDraft();
    render();
  });

  savedList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const li = button.closest(".profile-card");
    const mealId = li.dataset.id;
    const catId = catSelect.value;

    if (button.dataset.action === "load") {
      const meal = mealStore.list(catId).find((item) => item.id === mealId);
      draftComponents = [...meal.components];
      editingMealId = meal.id;
      nameInput.value = meal.name;
      render();
    }

    if (button.dataset.action === "delete") {
      mealStore.remove(catId, mealId);
      if (editingMealId === mealId) {
        resetDraft();
      }
      render();
    }
  });

  function useAsMealBase(catId, foodId, grams) {
    refreshCatOptions();
    catSelect.value = catId;
    draftComponents = [{ foodId, grams }];
    editingMealId = null;
    nameInput.value = "";
    render();
    document.getElementById("mahlzeiten").scrollIntoView({ behavior: "smooth" });
  }

  refresh();

  return { refresh, useAsMealBase };
}
