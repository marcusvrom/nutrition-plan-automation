import type {
  FoodPlan,
  Macros,
  PersonWeekTotal,
  ProfileFile,
  Recipe,
} from "../domain/types.ts";

const ZERO: Macros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

function add(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    protein_g: a.protein_g + b.protein_g,
    carbs_g: a.carbs_g + b.carbs_g,
    fat_g: a.fat_g + b.fat_g,
  };
}

function scale(m: Macros, k: number): Macros {
  return {
    kcal: m.kcal * k,
    protein_g: m.protein_g * k,
    carbs_g: m.carbs_g * k,
    fat_g: m.fat_g * k,
  };
}

function round(m: Macros): Macros {
  return {
    kcal: Math.round(m.kcal),
    protein_g: Math.round(m.protein_g * 10) / 10,
    carbs_g: Math.round(m.carbs_g * 10) / 10,
    fat_g: Math.round(m.fat_g * 10) / 10,
  };
}

export function computeWeeklyMacros(args: {
  plan: FoodPlan;
  profile: ProfileFile;
  recipes: Map<string, Recipe>;
}): PersonWeekTotal[] {
  const { plan, profile, recipes } = args;
  return profile.people.map((person) => {
    const perDay: Record<string, Macros> = {};
    let totals = { ...ZERO };

    for (const [day, meals] of Object.entries(plan.days)) {
      let dayTotal = { ...ZERO };
      for (const slot of Object.values(meals)) {
        const recipe = recipes.get(slot.recipe_id);
        if (!recipe) continue;
        const servings = slot.servings[person.id] ?? 0;
        if (servings <= 0) continue;
        dayTotal = add(dayTotal, scale(recipe.macros_per_serving, servings));
      }
      perDay[day] = round(dayTotal);
      totals = add(totals, dayTotal);
    }

    const numDays = Object.keys(plan.days).length || 1;
    const t = person.daily_targets;
    const avgPerDay = scale(totals, 1 / numDays);
    const delta: Macros = {
      kcal: avgPerDay.kcal - t.kcal,
      protein_g: avgPerDay.protein_g - t.protein_g,
      carbs_g: avgPerDay.carbs_g - t.carbs_g,
      fat_g: avgPerDay.fat_g - t.fat_g,
    };

    return {
      personId: person.id,
      totals: round(totals),
      perDay,
      targetsPerDay: t,
      deltaPerDay: round(delta),
    };
  });
}
