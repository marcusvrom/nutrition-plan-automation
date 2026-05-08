// Build a JSON snapshot of all computed data without rendering HTML.
// Useful for debugging and for downstream consumers.
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
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

const outDir = join(process.cwd(), "output");
await mkdir(outDir, { recursive: true });
await writeFile(
  join(outDir, "snapshot.json"),
  JSON.stringify({ weekly, shopping, issues }, null, 2),
  "utf8",
);
console.log("Wrote output/snapshot.json");
