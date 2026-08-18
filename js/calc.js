// Pure calculation functions for cat energy need.

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

  const rfaInTs = (100 / ts) * rohfaser;
  const ge = 0.024 * protein + 0.038 * fett + 0.017 * rohfaser + 0.017 * nfe;
  const sv = 87.9 - 0.88 * rfaInTs;
  const de = (ge * sv) / 100;
  const me = de - 0.0031 * protein;

  return me * 239;
}
