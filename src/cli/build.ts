import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  indexRecipes,
  loadFoodPlan,
  loadPantry,
  loadProfile,
  loadRecipes,
  loadShoppingCategories,
} from "../parsers/load.ts";
import { computeWeeklyMacros } from "../calculators/macros.ts";
import {
  computeShoppingList,
  groupShoppingByCategory,
} from "../calculators/shopping-list.ts";
import { validateAll } from "../validators/validate.ts";

const [recipes, profile, foodPlan, pantry, sc] = await Promise.all([
  loadRecipes(),
  loadProfile(),
  loadFoodPlan(),
  loadPantry(),
  loadShoppingCategories(),
]);

const idx = indexRecipes(recipes);
const issues = await validateAll({ recipes, profile, foodPlan, pantry });
const weekly = computeWeeklyMacros({ foodPlan, profile, recipes: idx });
const shopping = computeShoppingList({ foodPlan, recipes: idx, pantry });
const grouped = groupShoppingByCategory({ items: shopping, categories: sc });

const outDir = join(process.cwd(), "output");
await mkdir(outDir, { recursive: true });
await writeFile(
  join(outDir, "snapshot.json"),
  JSON.stringify({ weekly, shopping, grouped, issues }, null, 2),
  "utf8",
);
console.log("Wrote output/snapshot.json");
