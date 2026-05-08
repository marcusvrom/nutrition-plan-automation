// Atualiza o peso de uma pessoa, registra no histórico e (opcionalmente)
// recalcula as metas diárias baseadas no novo peso.
//
// Uso:
//   npm run update-weight -- <person_id> <weight_kg> [--apply] [--note "texto"]
//
// Sem --apply, apenas mostra o que mudaria.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import YAML from "yaml";
import type {
  ProfileFile,
  WeightLogFile,
  Person,
} from "../domain/types.ts";
import { getTotal, suggestDailyTargets, tmbMifflin } from "../calculators/energy.ts";

const ROOT = process.cwd();
const PROFILE_PATH = join(ROOT, "data", "profile.yml");
const WEIGHTS_DIR = join(ROOT, "data", "weights");

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseArgs(): {
  personId: string;
  weight: number;
  apply: boolean;
  note?: string;
} {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Uso: npm run update-weight -- <person_id> <weight_kg> [--apply] [--note <texto>]",
    );
    process.exit(1);
  }
  const personId = args[0]!;
  const weight = Number(args[1]);
  if (!Number.isFinite(weight) || weight <= 0) {
    console.error(`Peso inválido: ${args[1]}`);
    process.exit(1);
  }
  const apply = args.includes("--apply");
  const noteIdx = args.indexOf("--note");
  const note = noteIdx >= 0 ? args[noteIdx + 1] : undefined;
  return { personId, weight, apply, note };
}

async function loadYaml<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return YAML.parse(raw) as T;
}

async function loadOrInitWeightLog(personId: string): Promise<WeightLogFile> {
  const path = join(WEIGHTS_DIR, `${personId}.yml`);
  try {
    return await loadYaml<WeightLogFile>(path);
  } catch {
    return { person_id: personId, entries: [] };
  }
}

async function saveYaml(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, YAML.stringify(data), "utf8");
}

async function main() {
  const { personId, weight, apply, note } = parseArgs();

  const profile = await loadYaml<ProfileFile>(PROFILE_PATH);
  const person = profile.people.find((p) => p.id === personId);
  if (!person) {
    console.error(`Pessoa não encontrada: ${personId}`);
    console.error(
      `Disponíveis: ${profile.people.map((p) => p.id).join(", ")}`,
    );
    process.exit(1);
  }

  const oldWeight = person.weight_kg ?? null;
  const updatedPerson: Person = { ...person, weight_kg: weight };
  // IMC, se altura conhecida.
  if (person.height_cm) {
    const m = person.height_cm / 100;
    updatedPerson.imc = Math.round((weight / (m * m)) * 10) / 10;
  }

  const oldTmb = tmbMifflin(person);
  const oldGet = getTotal(person);
  const newTmb = tmbMifflin(updatedPerson);
  const newGet = getTotal(updatedPerson);
  const suggested = suggestDailyTargets(updatedPerson);

  console.log(`\nPessoa: ${person.name} (${person.id})`);
  console.log(`  Peso:  ${oldWeight ?? "?"} kg  →  ${weight} kg`);
  if (updatedPerson.imc) {
    console.log(`  IMC:   ${person.imc ?? "?"}  →  ${updatedPerson.imc}`);
  }
  if (oldTmb && newTmb) {
    console.log(`  TMB:   ${Math.round(oldTmb)}  →  ${Math.round(newTmb)} kcal`);
  }
  if (oldGet && newGet) {
    console.log(`  GET:   ${Math.round(oldGet)}  →  ${Math.round(newGet)} kcal`);
  }
  if (suggested) {
    const t = person.daily_targets;
    console.log(`  Meta kcal: ${t.kcal}  →  ${suggested.kcal} (deficit ${person.metadata?.deficit_kcal ?? 500})`);
    console.log(`  Proteína:  ${t.protein_g}g  →  ${suggested.protein_g}g`);
    console.log(`  Carbo:     ${t.carbs_g}g  →  ${suggested.carbs_g}g`);
    console.log(`  Gordura:   ${t.fat_g}g  →  ${suggested.fat_g}g`);
  }

  // Histórico de peso.
  const log = await loadOrInitWeightLog(personId);
  log.entries.push({ date: todayISO(), weight_kg: weight, note });
  log.entries.sort((a, b) => a.date.localeCompare(b.date));

  if (!apply) {
    console.log(
      `\nDry run. Use --apply para gravar as mudanças em data/profile.yml e data/weights/${personId}.yml.`,
    );
    return;
  }

  // Aplica alterações.
  const newPeople = profile.people.map((p) =>
    p.id === personId
      ? { ...updatedPerson, daily_targets: suggested ?? p.daily_targets }
      : p,
  );
  const newProfile: ProfileFile = { ...profile, people: newPeople };
  await saveYaml(PROFILE_PATH, newProfile);
  await saveYaml(join(WEIGHTS_DIR, `${personId}.yml`), log);
  console.log(`\n✔ Aplicado. Rode 'npm run report' para regenerar o HTML.`);
}

await main();
