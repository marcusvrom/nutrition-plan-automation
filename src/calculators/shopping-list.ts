import type {
  FoodPlanFile,
  PantryFile,
  Recipe,
  ShoppingItem,
  ShoppingByCategory,
  ShoppingCategoriesFile,
  Unit,
} from "../domain/types.ts";

const normalize = (n: string): string => n.trim().toLowerCase();
const keyOf = (ing: string, unit: Unit): string =>
  `${normalize(ing)}|${unit}`;

function getActiveWeekForPlan(plan: FoodPlanFile["plans"][number], foodPlan: FoodPlanFile) {
  const activeWeekId = foodPlan.settings?.active_weeks?.[plan.person_id];
  if (!activeWeekId) return plan.weeks[0];
  return plan.weeks.find((week) => week.id === activeWeekId) ?? plan.weeks[0];
}

/** Soma ingredientes em um único agregado por (nome, unidade), considerando
 *  a semana ativa por pessoa em foodPlan.settings.active_weeks.
 *  Se nenhuma semana ativa for declarada, usa a primeira semana do plano. */
export function computeShoppingList(args: {
  foodPlan: FoodPlanFile;
  recipes: Map<string, Recipe>;
  pantry: PantryFile;
}): ShoppingItem[] {
  const totals = new Map<string, ShoppingItem>();

  for (const plan of args.foodPlan.plans) {
    const week = getActiveWeekForPlan(plan, args.foodPlan);
    if (!week) continue;
    for (const meals of Object.values(week.days)) {
      for (const slot of Object.values(meals)) {
        if (!slot) continue;
        const recipe = args.recipes.get(slot.recipe_id);
        if (!recipe) continue;

        const totalServings = Object.values(slot.servings).reduce(
          (a, b) => a + b,
          0,
        );
        if (totalServings <= 0) continue;
        const factor = totalServings / recipe.servings;

        for (const ing of recipe.ingredients) {
          const k = keyOf(ing.ingredient, ing.unit);
          const existing = totals.get(k);
          const addQty = ing.quantity * factor;
          if (existing) {
            existing.quantity += addQty;
          } else {
            totals.set(k, {
              ingredient: normalize(ing.ingredient),
              unit: ing.unit,
              quantity: addQty,
              fromPantry: 0,
              toBuy: 0,
            });
          }
        }
      }
    }
  }

  for (const p of args.pantry.items) {
    const k = keyOf(p.ingredient, p.unit);
    const item = totals.get(k);
    if (!item) continue;
    item.fromPantry = Math.min(item.quantity, p.quantity);
  }

  const out: ShoppingItem[] = [];
  for (const item of totals.values()) {
    item.quantity = Math.round(item.quantity * 10) / 10;
    item.fromPantry = Math.round(item.fromPantry * 10) / 10;
    item.toBuy = Math.max(
      0,
      Math.round((item.quantity - item.fromPantry) * 10) / 10,
    );
    out.push(item);
  }
  out.sort((a, b) => a.ingredient.localeCompare(b.ingredient));
  return out;
}

/** Agrupa a lista por categorias declaradas em shopping-categories.yml.
 *  Itens declarados na categoria mas sem consumo computado também aparecem
 *  (úteis para "estoque" e itens manuais). */
export function groupShoppingByCategory(args: {
  items: ShoppingItem[];
  categories: ShoppingCategoriesFile;
}): ShoppingByCategory[] {
  const itemByKey = new Map<string, ShoppingItem>();
  for (const i of args.items) itemByKey.set(normalize(i.ingredient), i);

  const used = new Set<string>();
  const out: ShoppingByCategory[] = [];

  for (const cat of args.categories.categories) {
    const list: ShoppingItem[] = [];
    for (const cfg of cat.items) {
      const key = normalize(cfg.ingredient);
      const fromCalc = itemByKey.get(key);
      const item: ShoppingItem = fromCalc
        ? { ...fromCalc }
        : {
            ingredient: cfg.ingredient,
            unit: cfg.override_unit ?? "g",
            quantity: cfg.override_quantity ?? 0,
            fromPantry: 0,
            toBuy: cfg.override_quantity ?? 0,
          };
      if (cfg.override_quantity != null) {
        item.quantity = cfg.override_quantity;
        item.toBuy = Math.max(0, cfg.override_quantity - item.fromPantry);
      }
      if (cfg.override_unit) item.unit = cfg.override_unit;
      item.display_quantity = cfg.display_quantity;
      item.tags = cfg.tags;
      item.usage_note = cfg.usage_note;
      item.category_id = cat.id;
      list.push(item);
      used.add(key);
    }
    out.push({ category: cat, items: list });
  }

  // categoria virtual para sobras
  const leftovers = args.items.filter(
    (i) => !used.has(normalize(i.ingredient)),
  );
  if (leftovers.length > 0) {
    out.push({
      category: {
        id: "outros",
        name: "Outros (não categorizados)",
        icon: "📦",
        items: [],
      },
      items: leftovers,
    });
  }
  return out;
}
