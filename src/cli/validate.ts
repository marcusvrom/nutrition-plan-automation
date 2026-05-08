import {
  loadFoodPlan,
  loadPantry,
  loadProfile,
  loadRecipes,
} from "../parsers/load.ts";
import { validateAll } from "../validators/validate.ts";

const [recipes, profile, plan, pantry] = await Promise.all([
  loadRecipes(),
  loadProfile(),
  loadFoodPlan(),
  loadPantry(),
]);

const issues = await validateAll({ recipes, profile, plan, pantry });

const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");

for (const i of issues) {
  const tag = i.level === "error" ? "ERROR" : "WARN ";
  console.log(`[${tag}] ${i.where}: ${i.message}`);
}

console.log(
  `\n${recipes.length} receita(s), ${profile.people.length} pessoa(s), ${
    Object.keys(plan.days).length
  } dia(s).`,
);
console.log(`${errors.length} erro(s), ${warnings.length} aviso(s).`);

if (errors.length > 0) {
  process.exit(1);
}
