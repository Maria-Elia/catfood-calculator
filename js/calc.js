// Pure calculation functions for cat energy need and food energy content.
// main.js shows error.message directly in the UI,

// Neutered cats need less energy than other ones at the same weight
export const STATUS_FACTORS = {
  kitten_bis_4_monate: 3.0,
  kitten_4_bis_12_monate: 2.0,
  erwachsen_unkastriert: 1.4,
  erwachsen_kastriert: 1.2,
  uebergewichtig_diaet: 1.0,
};

export const STATUS_LABELS = {
  kitten_bis_4_monate: "Kitten bis 4 Monate",
  kitten_4_bis_12_monate: "Kitten 4–12 Monate",
  erwachsen_unkastriert: "Erwachsen, unkastriert",
  erwachsen_kastriert: "Erwachsen, kastriert",
  uebergewichtig_diaet: "Übergewichtig / Diät",
};

export function rerKcal(weightKg) {
  if (typeof weightKg !== "number" || !(weightKg > 0)) {
    throw new Error("Gewicht muss eine Zahl größer als 0 sein.");
  }
  // Resting Energy Requirement: allometric scaling, not linear per kg
  // a heavier cat's metabolism doesn't scale 1:1 with body mass.
  return 70 * Math.pow(weightKg, 0.75);
}

export function dailyEnergyNeedKcal(weightKg, status) {
  const factor = STATUS_FACTORS[status];
  if (!factor) {
    throw new Error(`Unbekannter Status: ${status}`);
  }
  return rerKcal(weightKg) * factor;
}

export function foodEnergyKcalPer100g({ feuchte, protein, fett, rohfaser, rohasche }) {
  const inputs = { feuchte, protein, fett, rohfaser, rohasche };
  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value !== "number" || value < 0 || value > 100) {
      throw new Error(`${key} muss eine Zahl zwischen 0 und 100 sein.`);
    }
  }

  const ts = 100 - feuchte;
  if (ts <= 0) {
    throw new Error("Feuchte muss unter 100% liegen.");
  }

  const nfe = ts - protein - rohasche - rohfaser - fett;
  if (nfe < 0) {
    throw new Error("Nährwerte summieren sich auf mehr als die Trockensubstanz.");
  }

  // Weender/Kienzle metabolizable-energy formula. 0.024/0.038/0.017 are
  // per-gram energy conversion factors (protein/fat/carbs); 87.9/0.88 is
  // a cat-specific digestibility regression against fiber content; 0.0031
  // corrects for energy cats lose as urinary nitrogen, not gut energy.
  const rfaInTs = (100 / ts) * rohfaser;
  const ge = 0.024 * protein + 0.038 * fett + 0.017 * rohfaser + 0.017 * nfe;
  const sv = 87.9 - 0.88 * rfaInTs;
  const de = (ge * sv) / 100;
  const me = de - 0.0031 * protein;

  return me * 239; // 1 MJ = 239 kcal
}

export function feedingGramsPerDay(dailyKcalNeed, kcalPer100g) {
  if (typeof dailyKcalNeed !== "number" || dailyKcalNeed <= 0) {
    throw new Error("Tagesbedarf muss größer als 0 sein.");
  }
  if (typeof kcalPer100g !== "number" || kcalPer100g <= 0) {
    throw new Error("Energiegehalt des Futters muss größer als 0 sein.");
  }
  return (dailyKcalNeed / kcalPer100g) * 100;
}

// 50 ml pro kg Körpergewicht/Tag 
export function dailyWaterNeedMl(weightKg) {
  if (typeof weightKg !== "number" || !(weightKg > 0)) {
    throw new Error("Gewicht muss eine Zahl größer als 0 sein.");
  }
  return weightKg * 50;
}

// 1g Feuchte im Futter entspricht ~1ml Wasser.
export function foodWaterGramsPerDay(feedingGrams, feuchtePercent) {
  if (typeof feedingGrams !== "number" || feedingGrams <= 0) {
    throw new Error("Futtermenge muss größer als 0 sein.");
  }
  if (typeof feuchtePercent !== "number" || feuchtePercent < 0 || feuchtePercent > 100) {
    throw new Error("Feuchte muss eine Zahl zwischen 0 und 100 sein.");
  }
  return (feedingGrams * feuchtePercent) / 100;
}
