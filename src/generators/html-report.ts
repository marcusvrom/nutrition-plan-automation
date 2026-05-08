import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  FoodPlanFile,
  PersonWeekTotal,
  ProfileFile,
  Recipe,
  ShoppingByCategory,
  PrinciplesFile,
  RulesFile,
  SupplementsFile,
  ClinicalFile,
  CronogramaFile,
  IngredientMapFile,
  MealPrepFile,
  PortionVariant,
  Person,
  PlanSlot,
  ShoppingCategoriesFile,
  ShoppingTag,
} from "../domain/types.ts";
import type { ValidationIssue } from "../validators/validate.ts";
import { macrosForSlotPerson } from "../calculators/macros.ts";

const ROOT = process.cwd();

const escape = (s: string): string =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const MEAL_LABELS: Record<string, { pt: string; icon: string; cls: string }> = {
  breakfast: { pt: "Café", icon: "☕", cls: "ml-cafe" },
  morning_snack: { pt: "Lanche manhã", icon: "🥣", cls: "ml-snack" },
  lunch: { pt: "Almoço", icon: "🍽️", cls: "ml-almoco" },
  afternoon_snack: { pt: "Lanche tarde", icon: "🥤", cls: "ml-snack" },
  dinner: { pt: "Jantar", icon: "🌙", cls: "ml-jantar" },
  evening_snack: { pt: "Ceia", icon: "🌙", cls: "ml-snack" },
};

const DAY_LABELS: Record<string, string> = {
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
  sunday: "Domingo",
};

function macroPills(m: { kcal: number; protein_g: number; carbs_g: number; fat_g: number }): string {
  return `
    <span class="mp k">${Math.round(m.kcal)} kcal</span>
    <span class="mp p">${m.protein_g.toFixed(0)}g P</span>
    <span class="mp c">${m.carbs_g.toFixed(0)}g C</span>
    <span class="mp g">${m.fat_g.toFixed(0)}g G</span>
  `;
}

function deltaClass(value: number, tolerance: number): string {
  if (Math.abs(value) <= tolerance) return "ok";
  return value > 0 ? "over" : "under";
}

function tagBadge(tag: ShoppingTag): string {
  const labels: Record<ShoppingTag, string> = {
    shared: "🤝 compartilhado",
    her: "🌸 dela",
    his: "💙 dele",
    fresh: "🌿 fresco",
    stock: "📦 estoque",
    swap: "💰 econômico",
  };
  return `<span class="shop-tag t-${tag}">${labels[tag] ?? tag}</span>`;
}

function alertBox(level: string, title: string, body: string): string {
  return `<div class="alert a-${level}">
    <div class="alert-title">${escape(title)}</div>
    <div class="alert-body">${body}</div>
  </div>`;
}

function renderPrinciples(p: PrinciplesFile | undefined): string {
  if (!p || !p.pillars.length) return "";
  const intro = p.intro ? `<p class="muted">${escape(p.intro)}</p>` : "";
  const cards = p.pillars
    .map(
      (pl) => `
    <div class="rule-item">
      <div class="rule-icon">${escape(pl.icon ?? "✦")}</div>
      <div class="rule-text">
        ${pl.pillar ? `<span class="eyebrow">${escape(pl.pillar)}</span>` : ""}
        <strong>${escape(pl.title)}</strong>
        <span>${escape(pl.description)}</span>
      </div>
    </div>`,
    )
    .join("");
  return `${intro}<div class="rules-grid">${cards}</div>`;
}

function renderRules(r: RulesFile | undefined): string {
  if (!r || !r.rules.length) return "";
  const cards = r.rules
    .map(
      (x) => `
    <div class="rule-item">
      <div class="rule-icon">${escape(x.icon ?? "•")}</div>
      <div class="rule-text"><strong>${escape(x.title)}</strong><span>${escape(x.description)}</span></div>
    </div>`,
    )
    .join("");
  const disclaimer = r.disclaimer
    ? `<div class="card warn-card"><div class="card-title">Disclaimer</div><p>${escape(r.disclaimer)}</p></div>`
    : "";
  return `<div class="rules-grid">${cards}</div>${disclaimer}`;
}

function renderSupplements(s: SupplementsFile | undefined): string {
  if (!s || !s.items.length) return "";
  const intro = s.intro ? `<p class="muted">${escape(s.intro)}</p>` : "";
  const rows = s.items
    .map(
      (i) => `
    <tr>
      <td><strong>${escape(i.name)}</strong></td>
      <td>${escape(i.dose)}</td>
      <td>${escape(i.when ?? "—")}</td>
      <td><span class="badge p-${i.priority ?? "low"}">${escape(i.priority ?? "—")}</span></td>
      <td>${escape(i.justification ?? "")}</td>
    </tr>`,
    )
    .join("");
  const summary = s.cost_summary
    ? `<p class="muted small">${escape(s.cost_summary)}</p>`
    : "";
  return `${intro}<table class="data-table">
    <thead><tr><th>Suplemento</th><th>Dose</th><th>Quando</th><th>Prioridade</th><th>Justificativa</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>${summary}`;
}

function renderClinical(c: ClinicalFile | undefined): string {
  if (!c) return "";
  const alerts = (c.alerts ?? [])
    .map((a) => alertBox(a.level, a.title, escape(a.body)))
    .join("");
  let exams = "";
  if (c.exams && c.exams.length) {
    exams = `<table class="data-table">
      <thead><tr><th>Marcador</th><th>Resultado</th><th>Referência</th><th>Status</th><th>Interpretação</th></tr></thead>
      <tbody>${c.exams
        .map(
          (e) => `<tr>
        <td><strong>${escape(e.marker)}</strong></td>
        <td><code>${escape(e.value)}</code></td>
        <td><code>${escape(e.reference)}</code></td>
        <td><span class="badge s-${e.status}">${escape(e.status)}</span></td>
        <td>${escape(e.interpretation ?? "")}</td>
      </tr>`,
        )
        .join("")}</tbody>
    </table>`;
  }
  const fu = c.follow_up
    ? alertBox("info", "📋 Acompanhamento", escape(c.follow_up))
    : "";
  return `${alerts}${exams}${fu}`;
}

function renderCronograma(cr: CronogramaFile | undefined): string {
  if (!cr || !cr.items.length) return "";
  const intro = cr.intro ? `<p class="muted">${escape(cr.intro)}</p>` : "";
  const items = cr.items
    .map(
      (i) => `
    <div class="cron-item">
      <div class="cron-date">${escape(i.date)}</div>
      <div class="cron-title">${escape(i.title)}</div>
      <div class="cron-body">${escape(i.body)}</div>
    </div>`,
    )
    .join("");
  return `${intro}<div class="cron">${items}</div>`;
}

function renderIngredientMap(im: IngredientMapFile | undefined): string {
  if (!im || !im.entries.length) return "";
  return im.entries
    .map((e) => {
      const badges = e.badges
        .map(
          (b) =>
            `<span class="ing-badge b-${b}">${escape(b.replace("_", " "))}</span>`,
        )
        .join("");
      const flow = (e.flow ?? [])
        .map(
          (f) => `<div class="ing-flow-step">
        <div class="ing-flow-num">${f.step}</div>
        <div class="ing-flow-text">${escape(f.text)}</div>
      </div>`,
        )
        .join("");
      const usedIn = (e.used_in ?? [])
        .map((u) => `<span class="ing-tag">${escape(u.label)}</span>`)
        .join("");
      const required = (e.required_in_pantry ?? [])
        .map((r) => `<span class="ing-tag">${escape(r)}</span>`)
        .join("");

      return `<div class="ing-card">
        <div class="ing-header">
          <div class="ing-title">${escape(e.icon ?? "")} ${escape(e.title)}</div>
          <div class="ing-badges">${badges}</div>
        </div>
        <div class="ing-detail">
          ${e.quantity_at_prep ? `<p><strong>Quantidade no prep:</strong> ${escape(e.quantity_at_prep)}</p>` : ""}
          ${e.method ? `<p><strong>Método:</strong> ${escape(e.method)}</p>` : ""}
          ${e.description ? `<p>${escape(e.description)}</p>` : ""}
          ${flow ? `<div class="ing-flow">${flow}</div>` : ""}
          ${usedIn ? `<div class="ing-used"><div class="ing-used-label">Usado em</div><div class="ing-used-list">${usedIn}</div></div>` : ""}
          ${required ? `<div class="ing-used"><div class="ing-used-label">Despensa essencial</div><div class="ing-used-list">${required}</div></div>` : ""}
        </div>
      </div>`;
    })
    .join("");
}

function renderMealPrep(mp: MealPrepFile | undefined): string {
  if (!mp || !mp.steps.length) return "";
  const intro = mp.intro ? `<p class="muted">${escape(mp.intro)}</p>` : "";
  const steps = mp.steps
    .map(
      (s) => `
    <div class="prep-step">
      <div class="prep-step-title"><span class="prep-time">${escape(s.time)}</span> ${escape(s.title)}</div>
      <div class="prep-step-body">${escape(s.body)}</div>
    </div>`,
    )
    .join("");
  const summary = mp.output_summary
    ? `<div class="note-box"><strong>Produção total:</strong> ${escape(mp.output_summary)}</div>`
    : "";
  return `${intro}<div class="prep-timeline">${steps}</div>${summary}`;
}

function renderRecipeCard(r: Recipe): string {
  const flag = r.needs_review
    ? `<span class="warn-flag">⚠ needs_review</span>`
    : "";
  const m = r.macros_per_serving;
  const meta = [
    r.servings ? `${r.servings} porção(ões)` : null,
    r.prep_time_min || r.cook_time_min
      ? `${(r.prep_time_min ?? 0) + (r.cook_time_min ?? 0)} min`
      : null,
    r.prep_source ? r.prep_source : null,
    r.freeze_days ? `congela ${r.freeze_days}d` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const portions = (r.portions ?? [])
    .map((p: PortionVariant) => {
      const pm = p.macros ?? {
        kcal: r.macros_per_serving.kcal * p.servings,
        protein_g: r.macros_per_serving.protein_g * p.servings,
        carbs_g: r.macros_per_serving.carbs_g * p.servings,
        fat_g: r.macros_per_serving.fat_g * p.servings,
      };
      return `<div class="recipe-portion-box">
        <div class="recipe-portion-label">${escape(p.person_id)}</div>
        <div class="recipe-portion-value">${escape(p.description)}</div>
        <div class="recipe-portion-macros">${Math.round(pm.kcal)} kcal · ${pm.protein_g.toFixed(0)}g P · ${pm.carbs_g.toFixed(0)}g C · ${pm.fat_g.toFixed(0)}g G</div>
      </div>`;
    })
    .join("");

  const ings = r.ingredients
    .map((i) => `<li>${i.quantity} ${escape(i.unit)} de ${escape(i.ingredient)}</li>`)
    .join("");
  const steps = (r.preparation_steps ?? [])
    .map((s) => `<li>${escape(s)}</li>`)
    .join("");

  return `<details class="recipe-card">
    <summary>
      <div class="recipe-tag">${escape(r.category ?? "")}</div>
      <div class="recipe-name">${escape(r.name)} ${flag}</div>
      <div class="recipe-meta">${escape(meta)}</div>
      <div class="recipe-macros-bar">
        <span class="rm rm-k">${Math.round(m.kcal)} kcal</span>
        <span class="rm rm-p">${m.protein_g.toFixed(0)}g P</span>
        <span class="rm rm-c">${m.carbs_g.toFixed(0)}g C</span>
        <span class="rm rm-g">${m.fat_g.toFixed(0)}g G</span>
      </div>
    </summary>
    <div class="recipe-body">
      ${portions ? `<h4>Porções por pessoa</h4><div class="recipe-portion-grid">${portions}</div>` : ""}
      <h4>Ingredientes</h4>
      <ul>${ings}</ul>
      ${steps ? `<h4>Modo de preparo</h4><ol class="steps">${steps}</ol>` : ""}
      ${r.observations ? `<h4>Observações</h4><p>${escape(r.observations)}</p>` : ""}
      ${r.body_markdown ? `<details class="raw-md"><summary>Markdown completo</summary><pre>${escape(r.body_markdown)}</pre></details>` : ""}
    </div>
  </details>`;
}

function renderPlanForPerson(args: {
  person: Person;
  foodPlan: FoodPlanFile;
  recipes: Map<string, Recipe>;
  weekly: PersonWeekTotal[];
}): string {
  const plan = args.foodPlan.plans.find((p) => p.person_id === args.person.id);
  if (!plan) return "<p>Sem plano configurado.</p>";

  const tabs = plan.weeks
    .map(
      (w, i) =>
        `<button class="week-tab ${i === 0 ? "active" : ""}" data-tab="week-${args.person.id}-${w.id}">${escape(w.label ?? `Semana ${w.id}`)}</button>`,
    )
    .join("");

  const weeksHtml = plan.weeks
    .map((w, i) => {
      const personalWeekly = args.weekly.find(
        (x) => x.personId === args.person.id && x.weekId === w.id,
      );
      const days = Object.entries(w.days)
        .map(([day, meals]) => {
          const dayMacros = personalWeekly?.perDay[day];
          const order = plan.meals_order ?? [
            "breakfast",
            "morning_snack",
            "lunch",
            "afternoon_snack",
            "dinner",
          ];
          const rows = order
            .filter((m) => meals[m])
            .map((mealKey) => {
              const slot = meals[mealKey] as PlanSlot;
              const recipe = args.recipes.get(slot.recipe_id);
              const meta = MEAL_LABELS[mealKey] ?? {
                pt: mealKey,
                icon: "•",
                cls: "ml-snack",
              };
              const servings = slot.servings[args.person.id] ?? 0;
              const m = recipe
                ? macrosForSlotPerson(recipe, args.person.id, servings)
                : { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
              const variant = recipe?.portions?.find(
                (p) => p.person_id === args.person.id,
              );
              const desc =
                slot.description_override ??
                variant?.description ??
                recipe?.name ??
                slot.recipe_id;
              const note = slot.notes ?? variant?.ingredient_note ?? "";
              const sourceTag = slot.source ?? recipe?.prep_source;
              const sourceBadge = sourceTag
                ? `<span class="source s-${sourceTag}">${escape(sourceTag)}</span>`
                : "";
              return `
              <div class="meal-row">
                <div class="meal-label ${meta.cls}">${meta.icon} ${escape(meta.pt)}${slot.meal_time ? `<br><span class="meal-time">${escape(slot.meal_time)}</span>` : ""}</div>
                <div class="meal-desc">
                  <strong>${escape(recipe?.name ?? slot.recipe_id)}</strong> · ${escape(desc)}
                  ${note ? `<span class="ingredient-note">→ ${escape(note)}</span>` : ""}
                  ${sourceBadge}
                </div>
                <div class="meal-macros">${macroPills(m)}</div>
              </div>`;
            })
            .join("");
          return `<div class="day-card">
          <div class="day-header">${escape(DAY_LABELS[day] ?? day)}${dayMacros ? `<span class="day-kcal">~${dayMacros.kcal} kcal · ${dayMacros.protein_g.toFixed(0)}g P</span>` : ""}</div>
          ${rows}
        </div>`;
        })
        .join("");

      const summary = personalWeekly
        ? renderPersonWeeklySummary(args.person, personalWeekly)
        : "";

      return `<div class="day-grid week-pane ${i === 0 ? "" : "hidden"}" id="week-${args.person.id}-${w.id}">
        ${summary}
        ${days}
      </div>`;
    })
    .join("");

  return `<div class="week-tabs">${tabs}</div>${weeksHtml}`;
}

function renderPersonWeeklySummary(person: Person, w: PersonWeekTotal): string {
  const t = w.targetsPerDay;
  const d = w.deltaPerDay;
  return `<div class="day-summary">
    <div class="ds-item"><div class="ds-label">Meta diária</div><div class="ds-value">${t.kcal} kcal</div><div class="ds-target">P ${t.protein_g}g · C ${t.carbs_g}g · G ${t.fat_g}g</div></div>
    <div class="ds-item"><div class="ds-label">Δ médio kcal</div><div class="ds-value ${deltaClass(d.kcal, t.kcal * 0.05)}">${d.kcal >= 0 ? "+" : ""}${d.kcal}</div></div>
    <div class="ds-item"><div class="ds-label">Δ proteína</div><div class="ds-value ${deltaClass(d.protein_g, t.protein_g * 0.1)}">${d.protein_g >= 0 ? "+" : ""}${d.protein_g}g</div></div>
    <div class="ds-item"><div class="ds-label">Δ carbo</div><div class="ds-value ${deltaClass(d.carbs_g, t.carbs_g * 0.1)}">${d.carbs_g >= 0 ? "+" : ""}${d.carbs_g}g</div></div>
    <div class="ds-item"><div class="ds-label">Δ gordura</div><div class="ds-value ${deltaClass(d.fat_g, t.fat_g * 0.1)}">${d.fat_g >= 0 ? "+" : ""}${d.fat_g}g</div></div>
  </div>`;
}

function renderShoppingByCategory(grouped: ShoppingByCategory[]): string {
  return grouped
    .map((g) => {
      const items = g.items
        .map((i) => {
          const tags = (i.tags ?? []).map(tagBadge).join(" ");
          const qty =
            i.display_quantity ??
            (i.toBuy > 0 ? `${i.toBuy} ${i.unit}` : "—");
          return `<li class="shop-item">
          <span class="shop-check"></span>
          <div class="shop-text">
            <div class="shop-name">${escape(i.ingredient)} ${tags}</div>
            ${i.usage_note ? `<div class="shop-usage">→ ${escape(i.usage_note)}</div>` : ""}
            ${i.fromPantry > 0 ? `<div class="shop-pantry">na despensa: ${i.fromPantry} ${escape(i.unit)}</div>` : ""}
          </div>
          <span class="shop-qty">${escape(qty)}</span>
        </li>`;
        })
        .join("");
      const cost = g.category.cost_estimate_brl
        ? ` · R$ ${g.category.cost_estimate_brl.min}-${g.category.cost_estimate_brl.max}`
        : "";
      return `<div class="shop-cat">
        <div class="shop-cat-title">${escape(g.category.icon ?? "")} ${escape(g.category.name)}<span class="shop-cat-meta">${g.items.length} itens${cost}</span></div>
        <ul class="shop-list">${items}</ul>
      </div>`;
    })
    .join("");
}

function renderSwapTable(sc: ShoppingCategoriesFile | undefined): string {
  if (!sc?.swap_table?.length) return "";
  const rows = sc.swap_table
    .map(
      (s) => `<tr>
      <td><strong>${escape(s.from)}</strong></td>
      <td>${escape(s.to)}</td>
      <td><span class="badge s-ok">${escape(s.weekly_savings_brl)}</span></td>
      <td>${escape(s.rationale)}</td>
    </tr>`,
    )
    .join("");
  return `<h3>Substituições econômicas</h3>
  <table class="data-table">
    <thead><tr><th>Saída</th><th>Entrada</th><th>Economia</th><th>Justificativa</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderPantryEssentials(sc: ShoppingCategoriesFile | undefined): string {
  if (!sc?.pantry_essentials?.length) return "";
  const items = sc.pantry_essentials
    .map(
      (p) =>
        `<div class="pantry-item"><strong>${escape(p.name)}</strong>${p.note ? `<span>${escape(p.note)}</span>` : ""}</div>`,
    )
    .join("");
  return `<h3>Despensa essencial — ter sempre em casa</h3><div class="pantry-grid">${items}</div>`;
}

function renderIssues(issues: ValidationIssue[]): string {
  if (!issues.length) return `<p class="ok-msg">Sem problemas detectados.</p>`;
  return `<ul class="issues">${issues
    .map(
      (i) =>
        `<li class="${i.level}"><strong>[${i.level}]</strong> ${escape(i.where)} — ${escape(i.message)}</li>`,
    )
    .join("")}</ul>`;
}

function renderPersonHero(person: Person, weekly: PersonWeekTotal[]): string {
  const meta = person.metadata;
  const w = weekly.find((x) => x.personId === person.id);
  const t = person.daily_targets;
  return `<header class="hero">
    ${meta?.eyebrow ? `<div class="eyebrow">${escape(meta.eyebrow)}</div>` : ""}
    <h2 class="hero-title">${escape(meta?.title ?? person.name)}</h2>
    ${meta?.subtitle ? `<p class="hero-sub">${escape(meta.subtitle)}</p>` : ""}
    <div class="stats-bar">
      <div class="stat-card s-cal"><div class="sv">${t.kcal}</div><div class="sl">kcal/dia</div></div>
      <div class="stat-card s-p"><div class="sv">${t.protein_g}g</div><div class="sl">Proteína</div></div>
      <div class="stat-card s-c"><div class="sv">${t.carbs_g}g</div><div class="sl">Carbo</div></div>
      <div class="stat-card s-g"><div class="sv">${t.fat_g}g</div><div class="sl">Gordura</div></div>
      ${meta?.deficit_kcal ? `<div class="stat-card s-r"><div class="sv">−${meta.deficit_kcal}</div><div class="sl">Deficit kcal</div></div>` : ""}
    </div>
    ${meta?.projection ? `<p class="hero-projection">📈 ${escape(meta.projection)}</p>` : ""}
  </header>`;
}

export async function generateHtmlReport(args: {
  weekly: PersonWeekTotal[];
  profile: ProfileFile;
  foodPlan: FoodPlanFile;
  recipes: Recipe[];
  recipesIndex: Map<string, Recipe>;
  groupedShopping: ShoppingByCategory[];
  shoppingCategoriesFile: ShoppingCategoriesFile;
  ingredientMap?: IngredientMapFile;
  mealPrep?: MealPrepFile;
  principles: Record<string, PrinciplesFile>;
  rules: Record<string, RulesFile>;
  supplements: Record<string, SupplementsFile>;
  clinical: Record<string, ClinicalFile>;
  cronograma: Record<string, CronogramaFile>;
  issues: ValidationIssue[];
}): Promise<string> {
  const tplPath = join(ROOT, "templates", "report-template.html");
  const tpl = await readFile(tplPath, "utf8");

  const navItems = args.profile.people
    .map(
      (p) =>
        `<a class="nav-link" href="#person-${p.id}">${escape(p.name)}</a>`,
    )
    .join("");

  const peopleSections = args.profile.people
    .map((person) => {
      const principles = args.principles[person.id];
      const rules = args.rules[person.id];
      const supplements = args.supplements[person.id];
      const clinical = args.clinical[person.id];
      const cronograma = args.cronograma[person.id];

      const sections: { id: string; title: string; html: string }[] = [];

      if (clinical && (clinical.alerts?.length || clinical.exams?.length)) {
        sections.push({
          id: `clinical-${person.id}`,
          title: "Contexto clínico",
          html: renderClinical(clinical),
        });
      }

      if (principles && principles.pillars.length) {
        sections.push({
          id: `principles-${person.id}`,
          title: "Princípios do plano",
          html: renderPrinciples(principles),
        });
      }

      sections.push({
        id: `plan-${person.id}`,
        title: "Cardápio semanal",
        html: renderPlanForPerson({
          person,
          foodPlan: args.foodPlan,
          recipes: args.recipesIndex,
          weekly: args.weekly,
        }),
      });

      if (supplements && supplements.items.length) {
        sections.push({
          id: `supplements-${person.id}`,
          title: "Suplementação",
          html: renderSupplements(supplements),
        });
      }

      if (rules && rules.rules.length) {
        sections.push({
          id: `rules-${person.id}`,
          title: "Regras de ouro",
          html: renderRules(rules),
        });
      }

      if (cronograma && cronograma.items.length) {
        sections.push({
          id: `crono-${person.id}`,
          title: "Cronograma",
          html: renderCronograma(cronograma),
        });
      }

      const sectionsHtml = sections
        .map(
          (s, i) => `
        <section class="section" id="${s.id}">
          <div class="section-head">
            <div class="section-num">${i + 1}</div>
            <div class="section-title">${escape(s.title)}</div>
          </div>
          ${s.html}
        </section>`,
        )
        .join("");

      return `<div class="person-block" id="person-${person.id}">
        ${renderPersonHero(person, args.weekly)}
        ${sectionsHtml}
      </div>`;
    })
    .join('<hr class="person-divider" />');

  const sharedSections: string[] = [];

  if (args.ingredientMap?.entries.length) {
    sharedSections.push(`<section class="section" id="ingredient-map">
      <div class="section-head"><div class="section-num">★</div><div class="section-title">Mapa de ingredientes</div></div>
      <p class="muted">De onde vem cada ingrediente: compra → prep → congelamento → prato.</p>
      <div class="ing-map">${renderIngredientMap(args.ingredientMap)}</div>
    </section>`);
  }

  if (args.recipes.length) {
    sharedSections.push(`<section class="section" id="recipes">
      <div class="section-head"><div class="section-num">★</div><div class="section-title">Banco de receitas</div></div>
      <p class="muted">Clique em qualquer receita para expandir. Receitas com variantes mostram porções por pessoa.</p>
      <div class="recipe-grid">${args.recipes.map(renderRecipeCard).join("")}</div>
    </section>`);
  }

  sharedSections.push(`<section class="section" id="shopping">
    <div class="section-head"><div class="section-num">★</div><div class="section-title">Lista de compras consolidada</div></div>
    ${args.shoppingCategoriesFile.intro ? `<p class="muted">${escape(args.shoppingCategoriesFile.intro)}</p>` : ""}
    <div class="shop-grid">${renderShoppingByCategory(args.groupedShopping)}</div>
    ${renderPantryEssentials(args.shoppingCategoriesFile)}
    ${renderSwapTable(args.shoppingCategoriesFile)}
  </section>`);

  if (args.mealPrep?.steps.length) {
    sharedSections.push(`<section class="section" id="meal-prep">
      <div class="section-head"><div class="section-num">★</div><div class="section-title">Meal prep dominical</div></div>
      ${renderMealPrep(args.mealPrep)}
    </section>`);
  }

  sharedSections.push(`<section class="section" id="validation">
    <div class="section-head"><div class="section-num">★</div><div class="section-title">Validação</div></div>
    ${renderIssues(args.issues)}
  </section>`);

  const filled = tpl
    .replaceAll("{{GENERATED_AT}}", new Date().toISOString())
    .replace("{{NAV_ITEMS}}", navItems)
    .replace("{{PEOPLE_SECTIONS}}", peopleSections)
    .replace("{{SHARED_SECTIONS}}", sharedSections.join(""));

  const outDir = join(ROOT, "output");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "index.html");
  await writeFile(outPath, filled, "utf8");
  return outPath;
}
