// Geração de narrativa (resumo + dicas + observações) por IA.
// Recebe os DADOS JÁ CALCULADOS deterministicamente (macros, deltas,
// evolução de peso) e pede ao LLM apenas a parte de PROSA.
//
// O LLM NÃO calcula macros — só comenta. Isso preserva o princípio do
// projeto: scripts calculam, IA estrutura.

import type {
  PersonWeekTotal,
  ProfileFile,
  WeightLogFile,
} from "../domain/types.ts";
import { callAi, type AiCallResult, type ProviderId } from "./providers.ts";

export interface NarrativePerPerson {
  personId: string;
  summary: string;
  tips: string[];
}

export interface AiNarrative {
  generatedAt: string;
  providerUsed: ProviderId | null;
  fellBack: boolean;
  errorMessage?: string;
  perPerson: NarrativePerPerson[];
  globalObservation: string;
}

const SYSTEM_PROMPT = `Você é um nutricionista assistente de um sistema versionado de planos alimentares.
Você NUNCA calcula macros, kcal ou totais — esses já vêm calculados nos dados.
Seu papel é apenas comentar/observar de forma curta, prática e objetiva.

Regras:
- Português brasileiro, conciso, técnico mas acessível.
- Máximo 3 frases por campo "summary".
- Cada "tip" tem no máximo 2 frases.
- Recomende validação profissional para qualquer ajuste clínico.
- NUNCA invente valores numéricos.

Responda SEMPRE em JSON puro com a estrutura:
{
  "per_person": [
    { "person_id": "...", "summary": "...", "tips": ["...", "..."] }
  ],
  "global_observation": "..."
}`;

function buildUserPrompt(args: {
  profile: ProfileFile;
  weekly: PersonWeekTotal[];
  weightLogs: Record<string, WeightLogFile>;
}): string {
  const lines: string[] = ["Dados calculados desta semana:\n"];

  for (const person of args.profile.people) {
    lines.push(`## ${person.name} (${person.id})`);
    lines.push(`- Meta diária: ${person.daily_targets.kcal} kcal · ${person.daily_targets.protein_g}g P · ${person.daily_targets.carbs_g}g C · ${person.daily_targets.fat_g}g G`);
    if (person.weight_kg) lines.push(`- Peso atual: ${person.weight_kg} kg`);
    if (person.conditions?.length) {
      lines.push(`- Condições: ${person.conditions.join(", ")}`);
    }
    const personWeeks = args.weekly.filter((w) => w.personId === person.id);
    for (const w of personWeeks) {
      const d = w.deltaPerDay;
      lines.push(
        `- Semana ${w.weekId}: Δ médio/dia ${d.kcal >= 0 ? "+" : ""}${d.kcal} kcal, ${d.protein_g >= 0 ? "+" : ""}${d.protein_g}g P, ${d.carbs_g >= 0 ? "+" : ""}${d.carbs_g}g C, ${d.fat_g >= 0 ? "+" : ""}${d.fat_g}g G`,
      );
    }
    const log = args.weightLogs[person.id];
    if (log && log.entries.length >= 2) {
      const last = log.entries[log.entries.length - 1]!;
      const prev = log.entries[log.entries.length - 2]!;
      const deltaKg = (last.weight_kg - prev.weight_kg).toFixed(1);
      lines.push(
        `- Variação de peso: ${prev.weight_kg} → ${last.weight_kg} kg (${deltaKg} kg em ${prev.date} → ${last.date})`,
      );
    }
    lines.push("");
  }

  lines.push("");
  lines.push(
    "Para cada pessoa, escreva um resumo da semana (máx 3 frases) comentando o quanto bate as metas. Liste 2-3 tips práticas. Por fim, uma observação global cobrindo ambos.",
  );
  return lines.join("\n");
}

export async function generateNarrative(args: {
  profile: ProfileFile;
  weekly: PersonWeekTotal[];
  weightLogs: Record<string, WeightLogFile>;
}): Promise<AiNarrative> {
  const userPrompt = buildUserPrompt(args);
  let result: AiCallResult;
  try {
    result = await callAi({
      system: SYSTEM_PROMPT,
      user: userPrompt,
      jsonMode: true,
      maxTokens: 1500,
    });
  } catch (err) {
    return {
      generatedAt: new Date().toISOString(),
      providerUsed: null,
      fellBack: false,
      errorMessage: (err as Error).message,
      perPerson: [],
      globalObservation: "",
    };
  }

  // Parse JSON. Modelos às vezes embrulham em ```json ```.
  const cleaned = result.text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  let parsed: {
    per_person?: { person_id: string; summary: string; tips: string[] }[];
    global_observation?: string;
  };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      providerUsed: result.providerUsed,
      fellBack: result.fellBack,
      errorMessage: `Resposta da IA não é JSON válido: ${cleaned.slice(0, 200)}...`,
      perPerson: [],
      globalObservation: "",
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    providerUsed: result.providerUsed,
    fellBack: result.fellBack,
    perPerson: (parsed.per_person ?? []).map((p) => ({
      personId: p.person_id,
      summary: p.summary,
      tips: p.tips ?? [],
    })),
    globalObservation: parsed.global_observation ?? "",
  };
}
