// ============================================================================
// Tipos do domínio do plano alimentar.
// Modelo rico: múltiplas pessoas, planos individuais, 5 refeições/dia,
// variantes semanais (A/B), porções por pessoa, mapa de ingredientes,
// meal prep, suplementos, contexto clínico.
// ============================================================================

export type Unit = "g" | "ml" | "un" | "pct" | "lata" | "maço" | "cx" | "frasco" | "pote" | "pacote" | "garrafa" | "scoop" | "und" | "L" | "dúzia" | "ramo" | "cabeça";

export interface Ingredient {
  ingredient: string;
  quantity: number;
  unit: Unit;
}

export interface Macros {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ─── Receita ────────────────────────────────────────────────────────────────

export type PrepSource = "fresh" | "freezer" | "fridge" | "pantry" | "prep";
export type RecipeCategory = "cafe" | "lanche" | "almoco" | "jantar" | "ceia" | "outros";

/** Variante de porção para uma pessoa específica. */
export interface PortionVariant {
  person_id: string;
  description: string;        // "200g + salada grande"
  servings: number;           // multiplicador para cálculo de macros base
  macros?: Macros;            // override; se ausente usa macros_per_serving × servings
  ingredient_note?: string;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;           // quantas porções a receita rende
  serving_size?: string;
  prep_time_min?: number;
  cook_time_min?: number;
  category?: RecipeCategory;
  tags?: string[];
  ingredients: Ingredient[];
  macros_per_serving: Macros;
  portions?: PortionVariant[];
  prep_source?: PrepSource;
  freeze_days?: number;
  source: string;
  needs_review?: boolean;
  observations?: string;
  preparation_steps?: string[];
  body_markdown?: string;
}

// ─── Pessoa / Perfil ────────────────────────────────────────────────────────

export interface DailyTargets extends Macros {
  fiber_g?: number;
  water_l?: number;
  sodium_mg_max?: number;
  added_sugar_g_max?: number;
}

export interface PersonMetadata {
  eyebrow?: string;            // ex.: "Plano Alimentar Personalizado · v3"
  title?: string;              // ex.: "Deficit Inteligente"
  subtitle?: string;
  version?: string;
  generated_at?: string;
  goal?: string;
  meals_per_day?: number;
  deficit_kcal?: number;
  projection?: string;
}

export interface Person {
  id: string;
  name: string;
  sex?: "male" | "female" | "other";
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  imc?: number;
  activity_level?: string;
  conditions?: string[];        // ["SOP", "dislipidemia"]
  medications?: string[];
  daily_targets: DailyTargets;
  restrictions?: string[];
  preferences?: { likes?: string[]; dislikes?: string[] };
  metadata?: PersonMetadata;
}

export interface ProfileFile {
  people: Person[];
  default_serving_scale?: Record<string, number>;
}

// ─── Histórico de peso ──────────────────────────────────────────────────────

export interface WeightEntry {
  date: string;          // ISO YYYY-MM-DD
  weight_kg: number;
  note?: string;
}

export interface WeightLogFile {
  person_id: string;
  entries: WeightEntry[];
}

// ─── Plano semanal ──────────────────────────────────────────────────────────

export type MealLabel =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "dinner"
  | "evening_snack";

export interface PlanSlot {
  recipe_id: string;
  servings: Record<string, number>;   // personId -> servings (multiplicador)
  meal_time?: string;                  // "07:30"
  notes?: string;                      // ingredient_note
  source?: PrepSource;                 // override
  description_override?: string;       // ex.: "Refeição livre controlada"
}

export type DayMeals = Partial<Record<MealLabel, PlanSlot>>;
export type DaysMap = Record<string, DayMeals>;

export interface WeekVariant {
  id: string;                          // "A" | "B" | "default"
  label?: string;
  days: DaysMap;
}

/** Plano de uma pessoa. Pode ter múltiplas semanas (A/B) ou apenas uma. */
export interface PersonFoodPlan {
  person_id: string;
  meals_order?: MealLabel[];           // ordem de exibição
  weeks: WeekVariant[];
}

export interface FoodPlanSettings {
  /** Semana usada por pessoa em cálculos semanais como lista de compras. */
  active_weeks?: Record<string, string>;
}

export interface FoodPlanFile {
  settings?: FoodPlanSettings;
  plans: PersonFoodPlan[];
}

// ─── Despensa ───────────────────────────────────────────────────────────────

export interface PantryItem {
  ingredient: string;
  quantity: number;
  unit: Unit;
}

export interface PantryFile {
  items: PantryItem[];
}

// ─── Mapa de ingredientes (sourcing flow) ───────────────────────────────────

export type IngredientBadge = "prep_sunday" | "congela" | "fresh" | "fridge" | "stock";

export interface IngredientMapEntry {
  id: string;
  icon?: string;
  title: string;
  badges: IngredientBadge[];
  quantity_at_prep?: string;
  method?: string;
  description?: string;
  flow?: { step: number; text: string }[];
  used_in?: { recipe_id?: string; label: string; meal?: string }[];
  required_in_pantry?: string[];   // alimentos a manter em casa para receitas frescas
}

export interface IngredientMapFile {
  entries: IngredientMapEntry[];
}

// ─── Meal prep timeline ─────────────────────────────────────────────────────

export interface MealPrepStep {
  time: string;
  title: string;
  body: string;
}

export interface MealPrepFile {
  intro?: string;
  steps: MealPrepStep[];
  output_summary?: string;
}

// ─── Princípios e regras ────────────────────────────────────────────────────

export interface Principle {
  icon?: string;
  pillar?: string;
  title: string;
  description: string;
}

export interface PrinciplesFile {
  intro?: string;
  pillars: Principle[];
}

export interface Rule {
  icon?: string;
  title: string;
  description: string;
}

export interface RulesFile {
  rules: Rule[];
  disclaimer?: string;
}

// ─── Suplementos ────────────────────────────────────────────────────────────

export interface Supplement {
  name: string;
  dose: string;
  when?: string;
  priority?: "critical" | "high" | "medium" | "low";
  justification?: string;
  cost_estimate_brl_month?: number;
}

export interface SupplementsFile {
  intro?: string;
  items: Supplement[];
  cost_summary?: string;
}

// ─── Clínico (exames, alertas) ──────────────────────────────────────────────

export type AlertLevel = "critical" | "warn" | "info" | "success";

export interface ClinicalAlert {
  level: AlertLevel;
  title: string;
  body: string;
}

export type ExamStatus = "ok" | "warn" | "alert" | "info";

export interface ExamMarker {
  marker: string;
  value: string;
  reference: string;
  status: ExamStatus;
  interpretation?: string;
}

export interface ClinicalFile {
  intro?: string;
  alerts: ClinicalAlert[];
  exams?: ExamMarker[];
  follow_up?: string;
}

// ─── Cronograma ─────────────────────────────────────────────────────────────

export interface CronogramaItem {
  date: string;
  title: string;
  body: string;
}

export interface CronogramaFile {
  intro?: string;
  items: CronogramaItem[];
}

// ─── Lista de compras (categorias + tags) ───────────────────────────────────

export type ShoppingTag = "shared" | "her" | "his" | "fresh" | "stock";

export interface ShoppingCategoryItemConfig {
  ingredient: string;
  tags?: ShoppingTag[];
  usage_note?: string;
  /** override do cálculo automático; quando presente, usa este valor */
  override_quantity?: number;
  override_unit?: Unit;
  /** display alternativo para a quantidade (ex.: "1 pacote (8 un)") */
  display_quantity?: string;
}

export interface ShoppingCategory {
  id: string;
  name: string;
  icon?: string;
  cost_estimate_brl?: { min: number; max: number };
  items: ShoppingCategoryItemConfig[];
}

export interface ShoppingCategoriesFile {
  intro?: string;
  categories: ShoppingCategory[];
  pantry_essentials?: { name: string; note?: string }[];
}

// ─── Saídas calculadas ──────────────────────────────────────────────────────

export interface PersonDayMacros {
  personId: string;
  day: string;
  macros: Macros;
}

export interface PersonWeekTotal {
  personId: string;
  weekId: string;
  totals: Macros;
  perDay: Record<string, Macros>;
  targetsPerDay: Macros;
  deltaPerDay: Macros;
  numDays: number;
}

export interface ShoppingItem {
  ingredient: string;
  unit: Unit;
  quantity: number;
  fromPantry: number;
  toBuy: number;
  display_quantity?: string;
  category_id?: string;
  tags?: ShoppingTag[];
  usage_note?: string;
}

export interface ShoppingByCategory {
  category: ShoppingCategory;
  items: ShoppingItem[];
}
