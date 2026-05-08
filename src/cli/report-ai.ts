// Variante de `report` que ainda chama um provedor de IA para gerar
// uma narrativa (resumo + dicas) embutida no HTML.
//
// Ordem de fallback: Anthropic → OpenAI → Gemini. Se nenhum provedor
// estiver configurado ou todos falharem, o relatório é gerado mesmo assim
// com aviso na seção "Análise por IA".
//
// IMPORTANTE: a IA NÃO calcula macros. Apenas comenta os números já
// calculados deterministicamente.

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
  loadWeightLogs,
} from "../parsers/load.ts";
import { computeWeeklyMacros } from "../calculators/macros.ts";
import {
  computeShoppingList,
  groupShoppingByCategory,
} from "../calculators/shopping-list.ts";
import { validateAll } from "../validators/validate.ts";
import { generateHtmlReport } from "../generators/html-report.ts";
import { generateNarrative } from "../ai/narrative.ts";

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
  weightLogs,
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
  loadWeightLogs(),
]);

const idx = indexRecipes(recipes);
const issues = await validateAll({ recipes, profile, foodPlan, pantry });
const weekly = computeWeeklyMacros({ foodPlan, profile, recipes: idx });
const rawShopping = computeShoppingList({ foodPlan, recipes: idx, pantry });
const groupedShopping = groupShoppingByCategory({
  items: rawShopping,
  categories: shoppingCategoriesFile,
});

console.log("Chamando provedor de IA…");
const aiNarrative = await generateNarrative({
  profile,
  weekly,
  weightLogs,
});

if (aiNarrative.providerUsed) {
  console.log(`✔ Provedor: ${aiNarrative.providerUsed}${aiNarrative.fellBack ? " (FALLBACK)" : ""}`);
} else {
  console.warn(`⚠ IA indisponível: ${aiNarrative.errorMessage ?? "?"}`);
}

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
  weightLogs,
  aiNarrative,
  issues,
});

console.log(`Report written to ${outPath}`);
const errors = issues.filter((i) => i.level === "error");
if (errors.length) {
  console.error(`${errors.length} validation error(s).`);
  process.exit(1);
}
