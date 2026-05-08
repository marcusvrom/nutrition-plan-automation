import type {
  FoodPlanFile,
  Macros,
  PersonWeekTotal,
  ProfileFile,
  Recipe,
  PortionVariant,
} from "../domain/types.ts";

const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

const add = (a: Macros, b: Macros): Macros => ({
  kcal: a.kcal + b.kcal,
  protein_g: a.protein_g + b.protein_g,
  carbs_g: a.carbs_g + b.carbs_g,
  fat_g: a.fat_g + b.fat_g,
});

const scale = (m: Macros, k: number): Macros => ({
  kcal: m.kcal * k,
  protein_g: m.protein_g * k,
  carbs_g: m.carbs_g * k,
  fat_g: m.fat_g * k,
});

const round = (m: Macros): Macros => ({
  kcal: Math.round(m.kcal),
  protein_g: Math.round(m.protein_g * 10) / 10,
  carbs_g: Math.round(m.carbs_g * 10) / 10,
  fat_g: Math.round(m.fat_g * 10) / 10,
});

/** Resolve macros consumidos pela pessoa em um slot. */
export function macrosForSlotPerson(
  recipe: Recipe,
  personId: string,
  servings: number,
): Macros {
  if (servings <= 0) return ZERO;

  // Se há variant explícita por person_id e servings == 1, prefira a variant.
  const variant = recipe.portions?.find(
    (p: PortionVariant) => p.person_id === personId,
  );
  if (variant && variant.macros) {
    return scale(variant.macros, servings);
  }

  return scale(recipe.macros_per_serving, servings);
}

export function computeWeeklyMacros(args: {
  foodPlan: FoodPlanFile;
  profile: ProfileFile;
  recipes: Map<string, Recipe>;
}): PersonWeekTotal[] {
  const out: PersonWeekTotal[] = [];

  for (const plan of args.foodPlan.plans) {
    const person = args.profile.people.find((p) => p.id === plan.person_id);
    if (!person) continue;

    for (const week of plan.weeks) {
      const perDay: Record<string, Macros> = {};
      let totals = { ...ZERO };
      const days = Object.entries(week.days);

      for (const [day, meals] of days) {
        let dayTotal = { ...ZERO };
        for (const slot of Object.values(meals)) {
          if (!slot) continue;
          const recipe = args.recipes.get(slot.recipe_id);
          if (!recipe) continue;
          const servings = slot.servings[plan.person_id] ?? 0;
          dayTotal = add(
            dayTotal,
            macrosForSlotPerson(recipe, plan.person_id, servings),
          );
        }
        perDay[day] = round(dayTotal);
        totals = add(totals, dayTotal);
      }

      const numDays = days.length || 1;
      const t = person.daily_targets;
      const avgPerDay = scale(totals, 1 / numDays);
      const delta: Macros = {
        kcal: avgPerDay.kcal - t.kcal,
        protein_g: avgPerDay.protein_g - t.protein_g,
        carbs_g: avgPerDay.carbs_g - t.carbs_g,
        fat_g: avgPerDay.fat_g - t.fat_g,
      };

      out.push({
        personId: plan.person_id,
        weekId: week.id,
        totals: round(totals),
        perDay,
        targetsPerDay: { ...t },
        deltaPerDay: round(delta),
        numDays,
      });
    }
  }

  return out;
}
