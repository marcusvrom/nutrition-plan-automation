import {
  indexRecipes,
  loadClinical,
  loadCronograma,
  loadFoodPlan,
  loadIngredientMap,
  loadMealPrep,
  loadPantry,
  loadPrinciples,
  loadProfile,
  loadRecipes,
  loadRules,
  loadShoppingCategories,
  loadSupplements,
} from "../parsers/load.ts";
import { computeWeeklyMacros } from "../calculators/macros.ts";
import {
  computeShoppingList,
  groupShoppingByCategory,
} from "../calculators/shopping-list.ts";
import { validateAll } from "../validators/validate.ts";
import { generateHtmlReport } from "../generators/html-report.ts";

const [
  recipes,
  profile,
  foodPlan,
  pantry,
  ingredientMap,
  mealPrep,
  shoppingCategoriesFile,
  principles,
  rules,
  supplements,
  clinical,
  cronograma,
] = await Promise.all([
  loadRecipes(),
  loadProfile(),
  loadFoodPlan(),
  loadPantry(),
  loadIngredientMap(),
  loadMealPrep(),
  loadShoppingCategories(),
  loadPrinciples(),
  loadRules(),
  loadSupplements(),
  loadClinical(),
  loadCronograma(),
]);

const idx = indexRecipes(recipes);
const issues = await validateAll({ recipes, profile, foodPlan, pantry });
const weekly = computeWeeklyMacros({ foodPlan, profile, recipes: idx });
const rawShopping = computeShoppingList({
  foodPlan,
  recipes: idx,
  pantry,
});
const groupedShopping = groupShoppingByCategory({
  items: rawShopping,
  categories: shoppingCategoriesFile,
});

const outPath = await generateHtmlReport({
  weekly,
  profile,
  foodPlan,
  recipes,
  recipesIndex: idx,
  groupedShopping,
  shoppingCategoriesFile,
  ingredientMap,
  mealPrep,
  principles,
  rules,
  supplements,
  clinical,
  cronograma,
  issues,
});

console.log(`Report written to ${outPath}`);
const errors = issues.filter((i) => i.level === "error");
if (errors.length) {
  console.error(`${errors.length} validation error(s).`);
  process.exit(1);
}
