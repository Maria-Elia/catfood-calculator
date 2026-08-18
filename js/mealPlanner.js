// builds a per-cat meal from multiple saved food components and checks the total against the cat's daily energy need.

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

  function renderComponents() {
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
    const stored = mealStore.getComponents(catId);

    // A component's food may have been deleted since it was saved; drop it
    // and persist the cleanup so the table never shows a broken reference.
    const components = stored.filter((component) =>
      foods.some((food) => food.id === component.foodId),
    );
    if (components.length !== stored.length) {
      mealStore.setComponents(catId, components);
    }

    componentList.innerHTML = "";
    emptyState.hidden = components.length > 0;

    for (const component of components) {
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

    if (components.length === 0) {
      summary.hidden = true;
      return;
    }

    summary.hidden = false;
    const totalKcal = mealTotalKcal(components, foods);
    const dailyKcal = dailyEnergyNeedKcal(cat.gewicht, cat.status);
    const { status, deviationPercent } = mealStatus(totalKcal, dailyKcal);
    const totalWaterMl = mealTotalWaterMl(components, foods);
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

  function refresh() {
    refreshCatOptions();
    refreshFoodOptions();
    renderComponents();
  }

  catSelect.addEventListener("change", renderComponents);

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

    const components = mealStore.getComponents(catId);
    if (components.some((component) => component.foodId === foodId)) {
      addError.textContent =
        "Dieses Futter ist schon in der Mahlzeit. Passe die Menge direkt in der Tabelle an.";
      addError.hidden = false;
      return;
    }

    mealStore.setComponents(catId, [...components, { foodId, grams }]);
    foodSelect.value = "";
    gramsInput.value = "";
    renderComponents();
  });

  componentList.addEventListener("change", (event) => {
    const input = event.target.closest(".meal-planner__grams-input");
    if (!input) return;

    const grams = Number(input.value);
    if (!(grams > 0)) {
      renderComponents(); // reset the input back to the last valid value
      return;
    }

    const catId = catSelect.value;
    const foodId = input.closest("tr").dataset.foodId;
    const components = mealStore
      .getComponents(catId)
      .map((component) => (component.foodId === foodId ? { ...component, grams } : component));
    mealStore.setComponents(catId, components);
    renderComponents();
  });

  componentList.addEventListener("click", (event) => {
    const button = event.target.closest('button[data-action="remove"]');
    if (!button) return;

    const catId = catSelect.value;
    const foodId = button.closest("tr").dataset.foodId;
    const components = mealStore
      .getComponents(catId)
      .filter((component) => component.foodId !== foodId);
    mealStore.setComponents(catId, components);
    renderComponents();
  });

  function useAsMealBase(catId, foodId, grams) {
    const existing = mealStore.getComponents(catId);
    if (existing.length > 0) {
      const confirmed = window.confirm(
        "Für diese Katze ist schon eine Mahlzeit gespeichert. Soll sie durch dieses Ergebnis ersetzt werden?",
      );
      if (!confirmed) return;
    }

    mealStore.setComponents(catId, [{ foodId, grams }]);
    refreshCatOptions();
    catSelect.value = catId;
    renderComponents();
    document.getElementById("mahlzeiten").scrollIntoView({ behavior: "smooth" });
  }

  refresh();

  return { refresh, useAsMealBase };
}
