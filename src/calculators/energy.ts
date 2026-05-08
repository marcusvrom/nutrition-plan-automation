// Cálculo de TMB (Mifflin-St Jeor) e gasto energético total (GET).
// Usado pela CLI de atualização de peso para sugerir/aplicar novas
// metas calóricas mantendo o deficit declarado em metadata.deficit_kcal.

import type { Person, DailyTargets } from "../domain/types.ts";

const ACTIVITY_FACTOR: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function tmbMifflin(person: {
  sex?: string;
  age?: number;
  height_cm?: number;
  weight_kg?: number;
}): number | null {
  if (!person.age || !person.height_cm || !person.weight_kg) return null;
  const base = 10 * person.weight_kg + 6.25 * person.height_cm - 5 * person.age;
  if (person.sex === "female") return base - 161;
  return base + 5; // male / other defaults to male formula
}

export function getTotal(person: Person): number | null {
  const tmb = tmbMifflin(person);
  if (tmb == null) return null;
  const factor = ACTIVITY_FACTOR[person.activity_level ?? "light"] ?? 1.375;
  return tmb * factor;
}

/** Sugere targets diários a partir de peso/altura/idade/atividade.
 *  Mantém os gramos absolutos de proteína (1.6×peso ideal ou config),
 *  recalcula kcal pelo deficit declarado, deriva carbo/gordura
 *  proporcionalmente. */
export function suggestDailyTargets(person: Person): DailyTargets | null {
  const get = getTotal(person);
  if (get == null) return null;
  const deficit = person.metadata?.deficit_kcal ?? 500;
  const kcal = Math.round(get - deficit);

  // Mantém proteína atual (g) — não escalonamos sem info clínica.
  const protein_g = person.daily_targets.protein_g;
  // Gordura ~28% kcal.
  const fat_kcal = kcal * 0.28;
  const fat_g = Math.round(fat_kcal / 9);
  // Carbo: o que sobra.
  const carbs_kcal = kcal - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(0, Math.round(carbs_kcal / 4));

  return {
    ...person.daily_targets,
    kcal,
    protein_g,
    carbs_g,
    fat_g,
  };
}
