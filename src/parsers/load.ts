import { readFile, readdir } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import type {
  Recipe,
  ProfileFile,
  FoodPlan,
  PantryFile,
} from "../domain/types.ts";

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "data");
const RECIPES_DIR = join(DATA_DIR, "recipes");

export async function loadProfile(): Promise<ProfileFile> {
  const raw = await readFile(join(DATA_DIR, "profile.yml"), "utf8");
  return YAML.parse(raw) as ProfileFile;
}

export async function loadFoodPlan(): Promise<FoodPlan> {
  const raw = await readFile(join(DATA_DIR, "food-plan.yml"), "utf8");
  return YAML.parse(raw) as FoodPlan;
}

export async function loadPantry(): Promise<PantryFile> {
  try {
    const raw = await readFile(join(DATA_DIR, "pantry.yml"), "utf8");
    return YAML.parse(raw) as PantryFile;
  } catch {
    return { items: [] };
  }
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
      tags: data.tags ?? [],
      ingredients: data.ingredients ?? [],
      macros_per_serving: data.macros_per_serving ?? {
        kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      },
      source: data.source,
      needs_review: data.needs_review ?? false,
      body_markdown: parsed.content.trim(),
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function indexRecipes(recipes: Recipe[]): Map<string, Recipe> {
  return new Map(recipes.map((r) => [r.id, r]));
}
