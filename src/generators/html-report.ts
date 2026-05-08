import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  FoodPlan,
  PersonWeekTotal,
  ProfileFile,
  Recipe,
  ShoppingItem,
} from "../domain/types.ts";
import type { ValidationIssue } from "../validators/validate.ts";

const ROOT = process.cwd();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function deltaClass(value: number, tolerance: number): string {
  if (Math.abs(value) <= tolerance) return "ok";
  return value > 0 ? "over" : "under";
}

function renderMacrosTable(weekly: PersonWeekTotal[], profile: ProfileFile): string {
  return weekly
    .map((w) => {
      const person = profile.people.find((p) => p.id === w.personId);
      const name = person?.name ?? w.personId;
      const t = w.targetsPerDay;
      const d = w.deltaPerDay;
      const days = Object.entries(w.perDay)
        .map(
          ([day, m]) =>
            `<tr><td>${escapeHtml(day)}</td><td>${m.kcal}</td><td>${m.protein_g}</td><td>${m.carbs_g}</td><td>${m.fat_g}</td></tr>`,
        )
        .join("");
      return `
<section class="person">
  <h3>${escapeHtml(name)}</h3>
  <p class="targets">Meta diária: <strong>${t.kcal} kcal</strong> · P ${t.protein_g}g · C ${t.carbs_g}g · G ${t.fat_g}g</p>
  <p class="delta">
    Δ médio/dia:
    <span class="${deltaClass(d.kcal, t.kcal * 0.05)}">${d.kcal >= 0 ? "+" : ""}${d.kcal} kcal</span> ·
    <span class="${deltaClass(d.protein_g, t.protein_g * 0.1)}">${d.protein_g >= 0 ? "+" : ""}${d.protein_g}g P</span> ·
    <span class="${deltaClass(d.carbs_g, t.carbs_g * 0.1)}">${d.carbs_g >= 0 ? "+" : ""}${d.carbs_g}g C</span> ·
    <span class="${deltaClass(d.fat_g, t.fat_g * 0.1)}">${d.fat_g >= 0 ? "+" : ""}${d.fat_g}g G</span>
  </p>
  <table>
    <thead><tr><th>Dia</th><th>kcal</th><th>P (g)</th><th>C (g)</th><th>G (g)</th></tr></thead>
    <tbody>${days}</tbody>
  </table>
</section>`;
    })
    .join("");
}

function renderPlan(plan: FoodPlan, recipes: Map<string, Recipe>): string {
  const days = Object.entries(plan.days)
    .map(([day, meals]) => {
      const rows = Object.entries(meals)
        .map(([meal, slot]) => {
          const recipe = recipes.get(slot.recipe_id);
          const name = recipe?.name ?? slot.recipe_id;
          const servings = Object.entries(slot.servings)
            .map(([p, q]) => `${escapeHtml(p)}: ${q}`)
            .join(" · ");
          return `<tr><td>${escapeHtml(meal)}</td><td>${escapeHtml(name)}</td><td>${servings}</td></tr>`;
        })
        .join("");
      return `<h3>${escapeHtml(day)}</h3>
<table><thead><tr><th>Refeição</th><th>Receita</th><th>Porções</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join("");
  return days;
}

function renderShoppingList(items: ShoppingItem[]): string {
  const rows = items
    .map(
      (i) =>
        `<tr><td>${escapeHtml(i.ingredient)}</td><td>${i.quantity} ${i.unit}</td><td>${i.fromPantry} ${i.unit}</td><td><strong>${i.toBuy} ${i.unit}</strong></td></tr>`,
    )
    .join("");
  return `<table>
  <thead><tr><th>Ingrediente</th><th>Total</th><th>Despensa</th><th>Comprar</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

function renderRecipes(recipes: Recipe[]): string {
  return recipes
    .map((r) => {
      const m = r.macros_per_serving;
      const ings = r.ingredients
        .map(
          (i) =>
            `<li>${i.quantity} ${i.unit} de ${escapeHtml(i.ingredient)}</li>`,
        )
        .join("");
      const flag = r.needs_review
        ? `<span class="warn">⚠ needs_review</span>`
        : "";
      return `<details>
  <summary><strong>${escapeHtml(r.name)}</strong> · ${m.kcal} kcal · P ${m.protein_g}g · C ${m.carbs_g}g · G ${m.fat_g}g · ${r.servings} porção(ões) ${flag}</summary>
  <ul>${ings}</ul>
</details>`;
    })
    .join("");
}

function renderIssues(issues: ValidationIssue[]): string {
  if (!issues.length) return `<p class="ok">Sem problemas detectados.</p>`;
  return `<ul class="issues">${issues
    .map(
      (i) =>
        `<li class="${i.level}"><strong>[${i.level}]</strong> ${escapeHtml(i.where)} — ${escapeHtml(i.message)}</li>`,
    )
    .join("")}</ul>`;
}

export async function generateHtmlReport(args: {
  weekly: PersonWeekTotal[];
  profile: ProfileFile;
  plan: FoodPlan;
  recipes: Recipe[];
  recipesIndex: Map<string, Recipe>;
  shopping: ShoppingItem[];
  issues: ValidationIssue[];
}): Promise<string> {
  const tplPath = join(ROOT, "templates", "report-template.html");
  const tpl = await readFile(tplPath, "utf8");

  const filled = tpl
    .replaceAll("{{GENERATED_AT}}", new Date().toISOString())
    .replace("{{MACROS_BLOCK}}", renderMacrosTable(args.weekly, args.profile))
    .replace("{{PLAN_BLOCK}}", renderPlan(args.plan, args.recipesIndex))
    .replace("{{SHOPPING_BLOCK}}", renderShoppingList(args.shopping))
    .replace("{{RECIPES_BLOCK}}", renderRecipes(args.recipes))
    .replace("{{ISSUES_BLOCK}}", renderIssues(args.issues));

  const outDir = join(ROOT, "output");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  await writeFile(outPath, filled, "utf8");
  return outPath;
}
