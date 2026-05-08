export type Unit = "g" | "ml" | "un";

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

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  serving_size?: string;
  prep_time_min?: number;
  cook_time_min?: number;
  tags?: string[];
  ingredients: Ingredient[];
  macros_per_serving: Macros;
  source?: string;
  needs_review?: boolean;
  body_markdown?: string;
}

export interface DailyTargets extends Macros {}

export interface Person {
  id: string;
  name: string;
  sex?: "male" | "female" | "other";
  age?: number;
  height_cm?: number;
  weight_kg?: number;
  activity_level?: string;
  goal?: string;
  daily_targets: DailyTargets;
  restrictions?: string[];
  preferences?: { likes?: string[]; dislikes?: string[] };
}

export interface ProfileFile {
  people: Person[];
  default_serving_scale?: Record<string, number>;
}

export interface PlanSlot {
  recipe_id: string;
  servings: Record<string, number>; // personId -> servings
  notes?: string;
}

export type DaySlots = Record<string, PlanSlot>; // mealName -> slot
export type Days = Record<string, DaySlots>;

export interface FoodPlan {
  week_starts_on?: string;
  days: Days;
}

export interface PantryItem {
  ingredient: string;
  quantity: number;
  unit: Unit;
}

export interface PantryFile {
  items: PantryItem[];
}

export interface PersonDayMacros {
  personId: string;
  day: string;
  macros: Macros;
}

export interface PersonWeekTotal {
  personId: string;
  totals: Macros;
  perDay: Record<string, Macros>;
  targetsPerDay: Macros;
  deltaPerDay: Macros; // average daily delta vs targets
}

export interface ShoppingItem {
  ingredient: string;
  unit: Unit;
  quantity: number;          // total needed
  fromPantry: number;        // subtracted from pantry
  toBuy: number;             // remaining
}
