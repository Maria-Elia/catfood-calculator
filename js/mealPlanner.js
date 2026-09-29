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
  autoAdjustComponents,
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
  const savedCatFilter = document.getElementById("saved-cat-filter");
  const summaryBarFill = document.getElementById("meal-summary-bar-fill");
  const summaryBarMarker = document.getElementById("meal-summary-bar-marker");
  const summaryMarkerLabel = document.getElementById("meal-summary-marker-label");
  const autoAdjust = document.getElementById("meal-auto-adjust");
  const autoAdjustBtn = document.getElementById("meal-auto-adjust-btn");
  const autoAdjustError = document.getElementById("meal-auto-adjust-error");
  const feedingModal = document.getElementById("feeding-modal");
  const feedingOpenBtn = document.getElementById("feeding-open-btn");
  const feedingCloseBtn = document.getElementById("feeding-modal-close");
  const feedingBackdrop = feedingModal && feedingModal.querySelector(".feeding-modal__backdrop");
  const feedingCats = document.getElementById("feeding-cats");
  const feedingEmpty = document.getElementById("feeding-empty");

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

    const FOOD_TYPE_SHORT = { trocken: "Trocken", nass: "Nass", leckerli: "Leckerli", zusatz: "Zusatz" };

    for (const component of draftComponents) {
      const food = foods.find((item) => item.id === component.foodId);
      const kcal = (component.grams / 100) * foodEnergyKcalPer100g(food);
      const meals = component.meals || 1;
      const locked = component.locked || false;
      const perMeal = (component.grams / meals).toFixed(2);
      const lockLabel = locked ? "Entsperren" : "Sperren";
      const lockSvg = locked
        ? '<svg class="meal-planner__lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        : '<svg class="meal-planner__lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
      const typeShort = FOOD_TYPE_SHORT[food.typ] || food.typ;

      const row = document.createElement("div");
      row.className = "meal-planner__food-row";
      row.dataset.foodId = component.foodId;
      row.innerHTML = `
        <div class="meal-planner__food-name">
          <span>${food.name}</span>
          <span class="meal-planner__food-type meal-planner__food-type--${food.typ}">${typeShort}</span>
        </div>
        <div class="meal-planner__food-grams">
          <input type="number" class="meal-planner__grams-input" value="${component.grams}" min="0.1" step="0.1" />
          <span class="meal-planner__food-unit">g/Tag</span>
        </div>
        <div class="meal-planner__food-split">
          <span class="meal-planner__split-label">in</span>
          <input type="number" class="meal-planner__meals-input" value="${meals}" min="1" step="1" />
          <span class="meal-planner__split-label">Mahlzeiten</span>
          <div class="meal-planner__per-meal-hint">→ ${perMeal} g pro Mahlzeit</div>
        </div>
        <span class="meal-planner__food-kcal">${Math.round(kcal)} kcal</span>
        <div class="meal-planner__food-actions">
          <button type="button" class="meal-planner__lock-btn ${locked ? "meal-planner__lock-btn--active" : ""}" data-action="lock" aria-label="${lockLabel}" aria-pressed="${locked}">${lockSvg}</button>
          <button type="button" class="meal-planner__remove-btn" data-action="remove" aria-label="Entfernen">&times;</button>
        </div>
      `;
      componentList.appendChild(row);
    }

    const hasUnlocked = draftComponents.some((c) => !c.locked);
    autoAdjust.hidden = draftComponents.length === 0 || !hasUnlocked;
    autoAdjustError.hidden = true;

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

    const barMax = 120;
    const pct = (totalKcal / dailyKcal) * 100;
    const fillPct = Math.min(pct, barMax);
    const markerPos = (100 / barMax) * 100;

    summaryTotal.textContent = `${Math.round(totalKcal)} kcal`;
    summaryNeed.textContent = `Bedarf: ${Math.round(dailyKcal)} kcal`;
    summaryBarFill.style.width = `${Math.round((fillPct / barMax) * 100)}%`;
    summaryBarFill.className = `meal-planner__kcal-fill meal-planner__kcal-fill--${status}`;
    summaryBarMarker.style.left = `${Math.round(markerPos)}%`;
    summaryMarkerLabel.style.left = `${Math.round(markerPos)}%`;
    const sign = deviationPercent >= 0 ? "+" : "";
    summaryBadge.textContent = `${sign}${Math.round(deviationPercent)}%`;
    summaryBadge.className = `meal-summary__badge meal-summary__badge--${status}`;
    summaryWaterNeed.textContent = `${Math.round(waterNeedMl)} ml`;
    summaryWaterFood.textContent = `${Math.round(totalWaterMl)} ml`;
    summaryWaterExtra.textContent = `${Math.round(waterExtraMl)} ml`;
  }

  function refreshSavedCatFilter() {
    const prev = savedCatFilter.value;
    savedCatFilter.innerHTML = "";
    const cats = catStore.list();
    if (cats.length > 1) {
      const allOpt = document.createElement("option");
      allOpt.value = "alle";
      allOpt.textContent = "Alle";
      savedCatFilter.appendChild(allOpt);
    }
    for (const cat of cats) {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      savedCatFilter.appendChild(opt);
    }
    const mainCat = catSelect.value;
    if (mainCat && cats.some((c) => c.id === mainCat)) {
      savedCatFilter.value = mainCat;
    } else if (prev && [...savedCatFilter.options].some((o) => o.value === prev)) {
      savedCatFilter.value = prev;
    }
  }

  function cleanMeals(catId, foods) {
    return mealStore.list(catId).map((meal) => {
      const components = meal.components.filter((component) =>
        foods.some((food) => food.id === component.foodId),
      );
      if (components.length === meal.components.length) return meal;
      mealStore.update(catId, meal.id, { components });
      return { ...meal, components };
    });
  }

  function renderSavedMeals(foods) {
    const filterVal = savedCatFilter.value;
    const cats = catStore.list();
    const showAll = filterVal === "alle";

    const entries = [];
    const targetCats = showAll ? cats : cats.filter((c) => c.id === filterVal);
    for (const cat of targetCats) {
      for (const meal of cleanMeals(cat.id, foods)) {
        entries.push({ cat, meal, catId: cat.id });
      }
    }

    savedList.innerHTML = "";
    savedEmpty.hidden = entries.length > 0;

    for (const { cat, meal, catId } of entries) {
      const totalKcal = mealTotalKcal(meal.components, foods);
      const componentSummary = meal.components
        .map((component) => {
          const food = foods.find((item) => item.id === component.foodId);
          if (!food) return null;
          const m = component.meals || 1;
          const perMeal = (component.grams / m).toFixed(2);
          const mealText = m > 1 ? ` (${m}× ${perMeal}g)` : "";
          return `${food.name}: ${component.grams}g${mealText}`;
        })
        .filter(Boolean)
        .join(" · ");

      const namePrefix = showAll ? `${cat.name}: ` : "";

      const li = document.createElement("li");
      li.className = "profile-card";
      li.dataset.id = meal.id;
      li.dataset.catId = catId;
      li.innerHTML = `
        <div class="profile-card__main">
          <span class="profile-card__name">${namePrefix}${meal.name}</span>
          <span class="profile-card__meta">${componentSummary}</span>
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

  function openFeedingModal() {
    renderFeedingCats();
    feedingModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeFeedingModal() {
    feedingModal.hidden = true;
    document.body.style.overflow = "";
  }

  function renderFeedingCats() {
    const cats = catStore.list();
    const foods = foodStore.list();
    feedingCats.innerHTML = "";

    const catsWithPlans = cats.filter((cat) => {
      const meals = cleanMeals(cat.id, foods);
      return meals.length > 0;
    });

    feedingEmpty.hidden = catsWithPlans.length > 0;

    for (const cat of catsWithPlans) {
      const meals = cleanMeals(cat.id, foods);
      const block = document.createElement("div");
      block.className = "feeding-cat-block";
      block.dataset.catId = cat.id;

      const planOptions = meals
        .map((m) => `<option value="${m.id}">${m.name}</option>`)
        .join("");

      block.innerHTML = `
        <div class="feeding-cat-block__header">
          <h4 class="feeding-cat-block__name">${cat.name}</h4>
          <select class="feeding-cat-block__plan">
            <option value="">Plan wählen…</option>
            ${planOptions}
          </select>
        </div>
        <div class="feeding-cat-block__portions"></div>
      `;
      feedingCats.appendChild(block);
    }
  }

  function renderFeedingBlockPortions(block) {
    const catId = block.dataset.catId;
    const planSelect = block.querySelector(".feeding-cat-block__plan");
    const portionsEl = block.querySelector(".feeding-cat-block__portions");
    const planId = planSelect.value;
    const foods = foodStore.list();

    if (!planId) {
      portionsEl.innerHTML = "";
      return;
    }

    const cat = catStore.list().find((c) => c.id === catId);
    const meal = mealStore.list(catId).find((m) => m.id === planId);
    if (!cat || !meal) return;

    const dailyKcal = dailyEnergyNeedKcal(cat.gewicht, cat.status);
    const totalKcal = mealTotalKcal(meal.components, foods);
    const { status, deviationPercent } = mealStatus(totalKcal, dailyKcal);
    const sign = deviationPercent >= 0 ? "+" : "";

    const lines = meal.components
      .map((component) => {
        const food = foods.find((f) => f.id === component.foodId);
        if (!food) return "";
        const m = component.meals || 1;
        const perMeal = (component.grams / m).toFixed(2);
        const splitText = m > 1 ? `${m}× ${perMeal}g` : `${component.grams}g`;
        return `
          <div class="feeding-portion">
            <span class="feeding-portion__name">${food.name}</span>
            <span class="feeding-portion__amount">${splitText}</span>
          </div>`;
      })
      .join("");

    portionsEl.innerHTML = `
      ${lines}
      <div class="feeding-summary">
        <span class="feeding-summary__total">${Math.round(totalKcal)} / ${Math.round(dailyKcal)} kcal</span>
        <span class="meal-summary__badge meal-summary__badge--${status}">${sign}${Math.round(deviationPercent)}%</span>
      </div>`;
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
    refreshSavedCatFilter();
    renderSavedMeals(foods);
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
        "Dieses Futter ist schon im Tagesplan. Passe die Menge direkt an.";
      addError.hidden = false;
      return;
    }

    const food = foodStore.list().find((item) => item.id === foodId);
    const defaultLocked = food && food.typ === "zusatz";
    draftComponents = [...draftComponents, { foodId, grams, meals: 1, locked: defaultLocked }];
    foodSelect.value = "";
    gramsInput.value = "";
    render();
  });

  componentList.addEventListener("change", (event) => {
    const gramsEl = event.target.closest(".meal-planner__grams-input");
    const mealsEl = event.target.closest(".meal-planner__meals-input");

    if (!gramsEl && !mealsEl) return;

    const foodId = event.target.closest(".meal-planner__food-row").dataset.foodId;

    if (gramsEl) {
      const grams = Number(gramsEl.value);
      if (!(grams > 0)) {
        render();
        return;
      }
      draftComponents = draftComponents.map((component) =>
        component.foodId === foodId ? { ...component, grams } : component,
      );
    }

    if (mealsEl) {
      const meals = Math.max(1, Math.round(Number(mealsEl.value)));
      if (!(meals >= 1)) {
        render();
        return;
      }
      draftComponents = draftComponents.map((component) =>
        component.foodId === foodId ? { ...component, meals } : component,
      );
    }

    render();
  });

  componentList.addEventListener("click", (event) => {
    const removeBtn = event.target.closest('button[data-action="remove"]');
    if (removeBtn) {
      const foodId = removeBtn.closest(".meal-planner__food-row").dataset.foodId;
      draftComponents = draftComponents.filter((component) => component.foodId !== foodId);
      render();
      return;
    }

    const lockBtn = event.target.closest('button[data-action="lock"]');
    if (lockBtn) {
      const foodId = lockBtn.closest(".meal-planner__food-row").dataset.foodId;
      draftComponents = draftComponents.map((component) =>
        component.foodId === foodId ? { ...component, locked: !component.locked } : component,
      );
      render();
    }
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
    const catId = li.dataset.catId;

    if (button.dataset.action === "load") {
      if (catSelect.value !== catId) {
        catSelect.value = catId;
        resetDraft();
      }
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

  autoAdjustBtn.addEventListener("click", () => {
    autoAdjustError.hidden = true;
    const catId = catSelect.value;
    const cat = catStore.list().find((item) => item.id === catId);
    if (!cat) return;

    const foods = foodStore.list();
    const dailyKcal = dailyEnergyNeedKcal(cat.gewicht, cat.status);
    const result = autoAdjustComponents(draftComponents, foods, dailyKcal);

    if (result.error === "locked_exceed") {
      autoAdjustError.textContent = "Gesperrte Futter decken bereits den Tagesbedarf.";
      autoAdjustError.hidden = false;
      return;
    }
    if (result.error === "no_unlocked_kcal") {
      autoAdjustError.textContent = "Entsperrte Futter haben 0 kcal - Anpassung nicht möglich.";
      autoAdjustError.hidden = false;
      return;
    }

    draftComponents = result.components;
    render();

    summaryBadge.classList.add("meal-summary__badge--pulse");
    summaryBadge.addEventListener(
      "animationend",
      () => summaryBadge.classList.remove("meal-summary__badge--pulse"),
      { once: true },
    );
  });

  if (feedingOpenBtn) {
    feedingOpenBtn.addEventListener("click", openFeedingModal);
  }
  if (feedingCloseBtn) {
    feedingCloseBtn.addEventListener("click", closeFeedingModal);
  }
  if (feedingBackdrop) {
    feedingBackdrop.addEventListener("click", closeFeedingModal);
  }
  if (feedingCats) {
    feedingCats.addEventListener("change", (event) => {
      const planSelect = event.target.closest(".feeding-cat-block__plan");
      if (!planSelect) return;
      const block = planSelect.closest(".feeding-cat-block");
      renderFeedingBlockPortions(block);
    });
  }

  savedCatFilter.addEventListener("change", () => {
    renderSavedMeals(foodStore.list());
  });

  function useAsMealBase(catId, foodId, grams) {
    refreshCatOptions();
    catSelect.value = catId;
    const food = foodStore.list().find((item) => item.id === foodId);
    const defaultLocked = food && food.typ === "zusatz";
    draftComponents = [{ foodId, grams, meals: 1, locked: defaultLocked }];
    editingMealId = null;
    nameInput.value = "";
    render();
    document.getElementById("mahlzeiten").scrollIntoView({ behavior: "smooth" });
  }

  refresh();

  return { refresh, useAsMealBase };
}
