import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import type {
  Recipe,
  ProfileFile,
  FoodPlanFile,
  PantryFile,
  IngredientMapFile,
  MealPrepFile,
  PrinciplesFile,
  RulesFile,
  SupplementsFile,
  ClinicalFile,
  CronogramaFile,
  ShoppingCategoriesFile,
  WeightLogFile,
} from "../domain/types.ts";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "data");
const RECIPES_DIR = join(DATA_DIR, "recipes");

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function loadYaml<T>(path: string, fallback: T): Promise<T> {
  if (!(await exists(path))) return fallback;
  const raw = await readFile(path, "utf8");
  return (YAML.parse(raw) ?? fallback) as T;
}

export async function loadProfile(): Promise<ProfileFile> {
  const raw = await readFile(join(DATA_DIR, "profile.yml"), "utf8");
  return YAML.parse(raw) as ProfileFile;
}

export async function loadFoodPlan(): Promise<FoodPlanFile> {
  const raw = await readFile(join(DATA_DIR, "food-plan.yml"), "utf8");
  return YAML.parse(raw) as FoodPlanFile;
}

export async function loadPantry(): Promise<PantryFile> {
  return loadYaml<PantryFile>(join(DATA_DIR, "pantry.yml"), { items: [] });
}

export async function loadIngredientMap(): Promise<IngredientMapFile> {
  return loadYaml<IngredientMapFile>(
    join(DATA_DIR, "ingredient-map.yml"),
    { entries: [] },
  );
}

export async function loadMealPrep(): Promise<MealPrepFile> {
  return loadYaml<MealPrepFile>(join(DATA_DIR, "meal-prep.yml"), { steps: [] });
}

export async function loadShoppingCategories(): Promise<ShoppingCategoriesFile> {
  return loadYaml<ShoppingCategoriesFile>(
    join(DATA_DIR, "shopping-categories.yml"),
    { categories: [] },
  );
}

async function loadPersonScopedFile<T>(
  filename: string,
  fallback: T,
): Promise<Record<string, T>> {
  // Carrega data/plans/<personId>/<filename> para todas as pessoas presentes.
  const plansDir = join(DATA_DIR, "plans");
  const out: Record<string, T> = {};
  if (!(await exists(plansDir))) return out;
  const personDirs = await readdir(plansDir);
  for (const personId of personDirs) {
    const path = join(plansDir, personId, filename);
    if (await exists(path)) {
      out[personId] = await loadYaml<T>(path, fallback);
    }
  }
  return out;
}

export async function loadPrinciples(): Promise<Record<string, PrinciplesFile>> {
  return loadPersonScopedFile<PrinciplesFile>("principles.yml", { pillars: [] });
}

export async function loadRules(): Promise<Record<string, RulesFile>> {
  return loadPersonScopedFile<RulesFile>("rules.yml", { rules: [] });
}

export async function loadSupplements(): Promise<Record<string, SupplementsFile>> {
  return loadPersonScopedFile<SupplementsFile>("supplements.yml", { items: [] });
}

export async function loadClinical(): Promise<Record<string, ClinicalFile>> {
  return loadPersonScopedFile<ClinicalFile>("clinical.yml", { alerts: [] });
}

export async function loadCronograma(): Promise<Record<string, CronogramaFile>> {
  return loadPersonScopedFile<CronogramaFile>("cronograma.yml", { items: [] });
}

export async function loadWeightLogs(): Promise<Record<string, WeightLogFile>> {
  const weightsDir = join(DATA_DIR, "weights");
  const out: Record<string, WeightLogFile> = {};
  if (!(await exists(weightsDir))) return out;
  const files = await readdir(weightsDir);
  for (const f of files) {
    if (extname(f) !== ".yml") continue;
    const personId = basename(f, ".yml");
    out[personId] = await loadYaml<WeightLogFile>(
      join(weightsDir, f),
      { person_id: personId, entries: [] },
    );
  }
  return out;
}

export async function loadRecipes(): Promise<Recipe[]> {
  const files = await readdir(RECIPES_DIR);
  const out: Recipe[] = [];
  for (const f of files) {
    if (extname(f) !== ".md") continue;
    const raw = await readFile(join(RECIPES_DIR, f), "utf8");
    const parsed = matter(raw);
    const data = parsed.data as Partial<Recipe>;
    const id = data.id ?? basename(f, ".md");
    out.push({
      id,
      name: data.name ?? id,
      servings: data.servings ?? 1,
      serving_size: data.serving_size,
      prep_time_min: data.prep_time_min,
      cook_time_min: data.cook_time_min,
      category: data.category,
      tags: data.tags ?? [],
      ingredients: data.ingredients ?? [],
      macros_per_serving: data.macros_per_serving ?? {
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      },
      portions: data.portions,
      prep_source: data.prep_source,
      freeze_days: data.freeze_days,
      source: data.source,
      needs_review: data.needs_review ?? false,
      observations: data.observations,
      preparation_steps: data.preparation_steps,
      body_markdown: parsed.content.trim(),
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function indexRecipes(recipes: Recipe[]): Map<string, Recipe> {
  return new Map(recipes.map((r) => [r.id, r]));
}
