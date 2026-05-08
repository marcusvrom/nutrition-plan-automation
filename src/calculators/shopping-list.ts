import type {
  FoodPlan,
  PantryFile,
  Recipe,
  ShoppingItem,
  Unit,
} from "../domain/types.ts";

interface Key {
  ingredient: string;
  unit: Unit;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function keyOf(k: Key): string {
  return `${normalizeName(k.ingredient)}|${k.unit}`;
}

export function computeShoppingList(args: {
  plan: FoodPlan;
  recipes: Map<string, Recipe>;
  pantry: PantryFile;
}): ShoppingItem[] {
  const { plan, recipes, pantry } = args;
  const totals = new Map<string, ShoppingItem>();

  for (const meals of Object.values(plan.days)) {
    for (const slot of Object.values(meals)) {
      const recipe = recipes.get(slot.recipe_id);
      if (!recipe) continue;

      const totalServings = Object.values(slot.servings).reduce(
        (a, b) => a + b,
        0,
      );
      // Receita rende `recipe.servings`. Cada slot consome `totalServings`
      // porções. Escalonamos os ingredientes proporcionalmente.
      const factor = totalServings / recipe.servings;

      for (const ing of recipe.ingredients) {
        const k = keyOf({ ingredient: ing.ingredient, unit: ing.unit });
        const existing = totals.get(k);
        const add = ing.quantity * factor;
        if (existing) {
          existing.quantity += add;
        } else {
          totals.set(k, {
            ingredient: normalizeName(ing.ingredient),
            unit: ing.unit,
            quantity: add,
            fromPantry: 0,
            toBuy: 0,
          });
        }
      }
    }
  }

  for (const p of pantry.items) {
    const k = keyOf({ ingredient: p.ingredient, unit: p.unit });
    const item = totals.get(k);
    if (!item) continue;
    item.fromPantry = Math.min(item.quantity, p.quantity);
  }

  const out: ShoppingItem[] = [];
  for (const item of totals.values()) {
    item.quantity = Math.round(item.quantity * 10) / 10;
    item.fromPantry = Math.round(item.fromPantry * 10) / 10;
    item.toBuy = Math.max(0, Math.round((item.quantity - item.fromPantry) * 10) / 10);
    out.push(item);
  }
  out.sort((a, b) => a.ingredient.localeCompare(b.ingredient));
  return out;
}
