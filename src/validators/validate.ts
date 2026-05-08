import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import AjvModule from "ajv";
import type { ErrorObject } from "ajv";
import addFormatsModule from "ajv-formats";
import type {
  Recipe,
  ProfileFile,
  FoodPlanFile,
  PantryFile,
} from "../domain/types.ts";

const Ajv = (AjvModule as unknown as { default: typeof AjvModule }).default ?? AjvModule;
const addFormats =
  (addFormatsModule as unknown as { default: typeof addFormatsModule }).default ??
  addFormatsModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_DIR = join(__dirname, "..", "schemas");

async function loadSchema(name: string): Promise<object> {
  const raw = await readFile(join(SCHEMA_DIR, name), "utf8");
  return JSON.parse(raw);
}

export interface ValidationIssue {
  level: "error" | "warning";
  where: string;
  message: string;
}

export async function buildValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const recipeSchema = await loadSchema("recipe.schema.json");
  const profileSchema = await loadSchema("profile.schema.json");
  const foodPlanSchema = await loadSchema("food-plan.schema.json");

  type Check = ((data: unknown) => boolean) & { errors?: ErrorObject[] | null };
  return {
    validateRecipe: ajv.compile(recipeSchema) as Check,
    validateProfile: ajv.compile(profileSchema) as Check,
    validateFoodPlan: ajv.compile(foodPlanSchema) as Check,
  };
}

const fmt = (errs: ErrorObject[] | null | undefined): string =>
  (errs ?? [])
    .map((e) => `${e.instancePath || "/"} ${e.message ?? ""}`)
    .join("; ");

export async function validateAll(args: {
  recipes: Recipe[];
  profile: ProfileFile;
  foodPlan: FoodPlanFile;
  pantry: PantryFile;
}): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const v = await buildValidator();

  if (!v.validateProfile(args.profile)) {
    issues.push({
      level: "error",
      where: "profile.yml",
      message: fmt(v.validateProfile.errors),
    });
  }

  if (!v.validateFoodPlan(args.foodPlan)) {
    issues.push({
      level: "error",
      where: "food-plan.yml",
      message: fmt(v.validateFoodPlan.errors),
    });
  }

  for (const r of args.recipes) {
    if (!v.validateRecipe(r)) {
      issues.push({
        level: "error",
        where: `recipes/${r.id}.md`,
        message: fmt(v.validateRecipe.errors),
      });
    }
    if (r.needs_review) {
      issues.push({
        level: "warning",
        where: `recipes/${r.id}.md`,
        message: "Receita marcada como needs_review.",
      });
    }
    const m = r.macros_per_serving;
    const computedKcal = m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;
    if (
      m.kcal > 0 &&
      Math.abs(computedKcal - m.kcal) > Math.max(40, m.kcal * 0.2)
    ) {
      issues.push({
        level: "warning",
        where: `recipes/${r.id}.md`,
        message: `kcal informado (${m.kcal}) diverge >20% do calculado a partir de P/C/G (${Math.round(
          computedKcal,
        )}).`,
      });
    }
  }

  // Cross-references: cada slot referencia receita + pessoa válidas.
  const recipeIds = new Set(args.recipes.map((r) => r.id));
  const personIds = new Set(args.profile.people.map((p) => p.id));

  for (const plan of args.foodPlan.plans) {
    if (!personIds.has(plan.person_id)) {
      issues.push({
        level: "error",
        where: `food-plan.yml > plans[${plan.person_id}]`,
        message: `Pessoa desconhecida: ${plan.person_id}`,
      });
      continue;
    }
    for (const week of plan.weeks) {
      for (const [day, meals] of Object.entries(week.days)) {
        for (const [meal, slot] of Object.entries(meals)) {
          if (!slot) continue;
          if (!recipeIds.has(slot.recipe_id)) {
            issues.push({
              level: "error",
              where: `food-plan.yml > ${plan.person_id}/${week.id}/${day}.${meal}`,
              message: `Recipe id desconhecida: ${slot.recipe_id}`,
            });
          }
          for (const pid of Object.keys(slot.servings)) {
            if (!personIds.has(pid)) {
              issues.push({
                level: "error",
                where: `food-plan.yml > ${plan.person_id}/${week.id}/${day}.${meal}.servings`,
                message: `Pessoa desconhecida: ${pid}`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}
