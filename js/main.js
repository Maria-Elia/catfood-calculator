import { createCatStore, createFoodStore } from "./storage.js";
import {
  STATUS_LABELS,
  FOOD_TYPE_LABELS,
  dailyEnergyNeedKcal,
  foodEnergyKcalPer100g,
  foodCarbsPercent,
  FEUCHTE_DEFAULTS,
  ZUSATZ_PRESETS,
  feedingGramsPerDay,
  dailyWaterNeedMl,
  foodWaterGramsPerDay,
} from "./calc.js";
import { initMealPlanner } from "./mealPlanner.js";

const catStore = createCatStore(window.localStorage);
const foodStore = createFoodStore(window.localStorage);
const mealPlanner = initMealPlanner({ catStore, foodStore });

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
    const waterMl = dailyWaterNeedMl(cat.gewicht);

    li.innerHTML = `
      <div class="profile-card__main">
        <span class="profile-card__name">${cat.name}</span>
        <span class="profile-card__meta">${cat.gewicht} kg &middot; ${STATUS_LABELS[cat.status]}</span>
        <span class="profile-card__kcal">${Math.round(kcal)} kcal/Tag &middot; ${Math.round(waterMl)} ml Wasser/Tag</span>
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
  mealPlanner.refresh();
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
    mealPlanner.refresh();
  }
});

renderCatList();

// ---- Foods ----

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
const foodWeenderFields = document.getElementById("food-weender-fields");
const foodFeuchteHint = document.getElementById("food-feuchte-hint");
const foodZusatzFields = document.getElementById("food-zusatz-fields");
const foodZusatzPresets = document.getElementById("food-zusatz-presets");
const foodKcalField = document.getElementById("food-kcal");

function updateFoodTypeVisibility() {
  const isZusatz = foodTypeField.value === "zusatz";
  foodWeenderFields.hidden = isZusatz;
  foodFeuchteHint.hidden = isZusatz;
  foodZusatzFields.hidden = !isZusatz;
}

foodTypeField.addEventListener("change", updateFoodTypeVisibility);

for (const preset of ZUSATZ_PRESETS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "profile-form__preset-btn";
  button.textContent = `${preset.name} (${preset.kcalPer100g} kcal/100g)`;
  button.addEventListener("click", () => {
    foodNameField.value = preset.name;
    foodKcalField.value = preset.kcalPer100g;
  });
  foodZusatzPresets.appendChild(button);
}

updateFoodTypeVisibility();

function resetFoodForm() {
  foodForm.reset();
  foodIdField.value = "";
  foodFormError.hidden = true;
  updateFoodTypeVisibility();
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

    const typeMeta = food.feuchteGeschaetzt
      ? `${FOOD_TYPE_LABELS[food.typ]} &middot; Feuchte geschätzt (${food.feuchte}%)`
      : FOOD_TYPE_LABELS[food.typ];

    const kcalMeta =
      food.typ === "zusatz"
        ? `${kcal100g.toFixed(1)} kcal/100g`
        : `${kcal100g.toFixed(1)} kcal/100g &middot; ${foodCarbsPercent(food).toFixed(1)}% Kohlenhydrate (berechnet)`;

    li.innerHTML = `
      <div class="profile-card__main">
        <span class="profile-card__name">${food.name}</span>
        <span class="profile-card__meta">${typeMeta}</span>
        <span class="profile-card__kcal">${kcalMeta}</span>
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

  const typ = foodTypeField.value;
  const name = foodNameField.value.trim();

  if (typ === "zusatz") {
    const entry = {
      name,
      typ,
      feuchte: 0,
      kcalPer100g: Number(foodKcalField.value),
    };

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

    const zusatzId = foodIdField.value;
    if (zusatzId) {
      foodStore.update(zusatzId, entry);
    } else {
      foodStore.add(entry);
    }

    resetFoodForm();
    renderFoodList();
    renderFoodOptions();
    updateResult();
    mealPlanner.refresh();
    return;
  }

  const feuchteRaw = foodFeuchteField.value.trim();
  let feuchte;
  let feuchteGeschaetzt = false;

  if (feuchteRaw === "") {
    if (typ === "leckerli") {
      foodFormError.textContent = "Feuchte ist bei Leckerli ein Pflichtfeld.";
      foodFormError.hidden = false;
      return;
    }
    feuchte = FEUCHTE_DEFAULTS[typ];
    feuchteGeschaetzt = true;
  } else {
    feuchte = Number(feuchteRaw);
  }

  const entry = {
    name,
    typ,
    feuchte,
    feuchteGeschaetzt,
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

  // A 0% field is usually a forgotten entry rather than a real value; ask
  // before saving instead of silently accepting it.
  const zeroFieldLabels = {
    protein: "Protein",
    fett: "Fett",
    rohfaser: "Rohfaser",
    rohasche: "Rohasche",
  };
  if (!feuchteGeschaetzt) {
    zeroFieldLabels.feuchte = "Feuchte";
  }
  const zeroFields = Object.keys(zeroFieldLabels)
    .filter((key) => entry[key] === 0)
    .map((key) => zeroFieldLabels[key]);
  if (zeroFields.length > 0) {
    const verb = zeroFields.length === 1 ? "ist" : "sind";
    const confirmed = window.confirm(
      `${zeroFields.join(", ")} ${verb} auf 0% gesetzt. Trotzdem speichern?`,
    );
    if (!confirmed) return;
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
  mealPlanner.refresh();
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
    updateFoodTypeVisibility();

    if (food.typ === "zusatz") {
      foodKcalField.value = food.kcalPer100g;
    } else {
      foodFeuchteField.value = food.feuchte;
      foodProteinField.value = food.protein;
      foodFettField.value = food.fett;
      foodRohfaserField.value = food.rohfaser;
      foodRohascheField.value = food.rohasche;
    }
    foodNameField.focus();
  }

  if (button.dataset.action === "delete") {
    foodStore.remove(id);
    renderFoodList();
    renderFoodOptions();
    updateResult();
    mealPlanner.refresh();
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
const resultWaterNeed = document.getElementById("result-water-need");
const resultWaterFood = document.getElementById("result-water-food");
const resultWaterExtra = document.getElementById("result-water-extra");
const onboardingBanner = document.getElementById("onboarding-banner");
const onboardingBannerContent = document.getElementById("onboarding-banner-content");

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

// Shown instead of the plain "pick a cat and a food" hint when one or both
// lists are still empty
const ONBOARDING_MESSAGES = {
  both: {
    text: "Du hast noch keine Katze und kein Futter gespeichert. Leg zuerst unten eine Katze an, dann ein Futter. Danach kannst du hier oben auswählen.",
    links: [
      { href: "#katzen", focusId: "cat-name", label: "Katze anlegen" },
      { href: "#futter", focusId: "food-name", label: "Futter anlegen" },
    ],
  },
  cat: {
    text: "Du hast noch keine Katze gespeichert. Leg unten eine an, dann kannst du sie hier oben auswählen.",
    links: [{ href: "#katzen", focusId: "cat-name", label: "Katze anlegen" }],
  },
  food: {
    text: "Du hast noch kein Futter gespeichert. Leg unten eins an, dann kannst du es hier oben auswählen.",
    links: [{ href: "#futter", focusId: "food-name", label: "Futter anlegen" }],
  },
};

function buildOnboardingLinksHtml(message) {
  return message.links
    .map(
      (link) =>
        `<a class="onboarding-banner__link" href="${link.href}" data-focus="${link.focusId}">${link.label}</a>`,
    )
    .join("");
}

function renderBannerHint(kind) {
  const message = ONBOARDING_MESSAGES[kind];
  onboardingBannerContent.innerHTML = `<p>${message.text}</p><div class="onboarding-banner__actions">${buildOnboardingLinksHtml(message)}</div>`;
  onboardingBanner.hidden = false;
}

function hideBanner() {
  onboardingBanner.hidden = true;
}

// Clicking an onboarding link scrolls to the right section (native anchor
// behavior) and then focuses its first field, so typing can start right
// away instead of the user having to find and click into the input.
onboardingBanner.addEventListener("click", (event) => {
  const link = event.target.closest(".onboarding-banner__link");
  if (!link) return;
  const field = document.getElementById(link.dataset.focus);
  if (field) {
    window.setTimeout(() => field.focus(), 400);
  }
});

function updateResult() {
  // Re-read from the store rather than caching the selected objects
  const cat = catStore.list().find((item) => item.id === catSelect.value);
  const food = foodStore.list().find((item) => item.id === foodSelect.value);

  if (!cat || !food) {
    resultPanel.hidden = true;
    resultEmpty.hidden = false;

    const hasCats = catStore.list().length > 0;
    const hasFoods = foodStore.list().length > 0;
    if (!hasCats && !hasFoods) {
      renderBannerHint("both");
    } else if (!hasCats) {
      renderBannerHint("cat");
    } else if (!hasFoods) {
      renderBannerHint("food");
    } else {
      hideBanner();
    }
    return;
  }

  // A valid cat and food are picked, so both profile lists exist already, no onboarding
  hideBanner();

  const dailyKcal = dailyEnergyNeedKcal(cat.gewicht, cat.status);
  const kcal100g = foodEnergyKcalPer100g(food);
  const grams = feedingGramsPerDay(dailyKcal, kcal100g);

  const waterNeedMl = dailyWaterNeedMl(cat.gewicht);
  const waterFromFoodMl = foodWaterGramsPerDay(grams, food.feuchte);
  const waterExtraMl = Math.max(0, waterNeedMl - waterFromFoodMl);

  resultKcal.textContent = `${Math.round(dailyKcal)} kcal`;
  resultKcal100.textContent = `${kcal100g.toFixed(1)} kcal/100g`;
  resultGrams.textContent = `${Math.round(grams)} g`;
  resultWaterNeed.textContent = `${Math.round(waterNeedMl)} ml`;
  resultWaterFood.textContent = `${Math.round(waterFromFoodMl)} ml`;
  resultWaterExtra.textContent = `${Math.round(waterExtraMl)} ml`;

  resultPanel.hidden = false;
  resultEmpty.hidden = true;
}

catSelect.addEventListener("change", updateResult);
foodSelect.addEventListener("change", updateResult);

renderCatOptions();
renderFoodOptions();
updateResult();

const useAsMealBtn = document.getElementById("use-as-meal-btn");
useAsMealBtn.addEventListener("click", () => {
  const cat = catStore.list().find((item) => item.id === catSelect.value);
  const food = foodStore.list().find((item) => item.id === foodSelect.value);
  if (!cat || !food) return;

  const dailyKcal = dailyEnergyNeedKcal(cat.gewicht, cat.status);
  const kcal100g = foodEnergyKcalPer100g(food);
  const grams = feedingGramsPerDay(dailyKcal, kcal100g);

  mealPlanner.useAsMealBase(cat.id, food.id, Math.round(grams));
});
