import { createCatStore, createFoodStore } from "./storage.js";
import { STATUS_LABELS, dailyEnergyNeedKcal } from "./calc.js";

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
  }
});

renderCatList();
