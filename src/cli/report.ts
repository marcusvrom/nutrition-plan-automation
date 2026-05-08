import {
  indexRecipes,
  loadFoodPlan,
  loadPantry,
  loadProfile,
  loadRecipes,
} from "../parsers/load.ts";
import { computeWeeklyMacros } from "../calculators/macros.ts";
import { computeShoppingList } from "../calculators/shopping-list.ts";
import { validateAll } from "../validators/validate.ts";
import { generateHtmlReport } from "../generators/html-report.ts";

const [recipes, profile, plan, pantry] = await Promise.all([
  loadRecipes(),
  loadProfile(),
  loadFoodPlan(),
  loadPantry(),
]);

const idx = indexRecipes(recipes);
const issues = await validateAll({ recipes, profile, plan, pantry });
const weekly = computeWeeklyMacros({ plan, profile, recipes: idx });
const shopping = computeShoppingList({ plan, recipes: idx, pantry });

const outPath = await generateHtmlReport({
  weekly,
  profile,
  plan,
  recipes,
  recipesIndex: idx,
  shopping,
  issues,
});

console.log(`Report written to ${outPath}`);
const errors = issues.filter((i) => i.level === "error");
if (errors.length) {
  console.error(`${errors.length} validation error(s) — relatório gerado com problemas.`);
  process.exit(1);
}
