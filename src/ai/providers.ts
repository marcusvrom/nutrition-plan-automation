// Cliente unificado para Claude / OpenAI / Gemini, ordem de fallback:
//   1. ANTHROPIC_API_KEY → Claude (claude-haiku-4-5)
//   2. OPENAI_API_KEY    → OpenAI (gpt-4o-mini)
//   3. GEMINI_API_KEY    → Gemini (gemini-2.0-flash)
//   4. nenhum            → erro NoProviderAvailable
//
// Cada chamada retorna `{ text, providerUsed, fellBack }`. `fellBack` é true
// quando o provider primário (Claude) não foi usado — o consumidor renderiza
// banner de aviso no HTML.

export type ProviderId = "anthropic" | "openai" | "gemini";

export interface AiCallResult {
  text: string;
  providerUsed: ProviderId;
  fellBack: boolean;
}

export class NoProviderAvailableError extends Error {
  constructor() {
    super(
      "Nenhum provedor de IA configurado. Defina ANTHROPIC_API_KEY, OPENAI_API_KEY ou GEMINI_API_KEY no ambiente.",
    );
  }
}

interface CallSpec {
  system: string;
  user: string;
  /** Pede ao modelo para responder em JSON quando suportado. */
  jsonMode?: boolean;
  maxTokens?: number;
}

async function callAnthropic(spec: CallSpec, key: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: spec.maxTokens ?? 2000,
      system: spec.system,
      messages: [{ role: "user", content: spec.user }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    content: { type: string; text: string }[];
  };
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function callOpenAI(spec: CallSpec, key: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: spec.maxTokens ?? 2000,
      response_format: spec.jsonMode ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: spec.system },
        { role: "user", content: spec.user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message.content ?? "";
}

async function callGemini(spec: CallSpec, key: string): Promise<string> {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
    encodeURIComponent(key);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: spec.system }] },
      contents: [{ role: "user", parts: [{ text: spec.user }] }],
      generationConfig: {
        maxOutputTokens: spec.maxTokens ?? 2000,
        responseMimeType: spec.jsonMode ? "application/json" : "text/plain",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return data.candidates[0]?.content.parts.map((p) => p.text).join("") ?? "";
}

export async function callAi(spec: CallSpec): Promise<AiCallResult> {
  const anthropic = process.env.ANTHROPIC_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  const gemini = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  const errors: string[] = [];

  if (anthropic) {
    try {
      const text = await callAnthropic(spec, anthropic);
      return { text, providerUsed: "anthropic", fellBack: false };
    } catch (err) {
      errors.push(`anthropic: ${(err as Error).message}`);
    }
  }
  if (openai) {
    try {
      const text = await callOpenAI(spec, openai);
      return { text, providerUsed: "openai", fellBack: true };
    } catch (err) {
      errors.push(`openai: ${(err as Error).message}`);
    }
  }
  if (gemini) {
    try {
      const text = await callGemini(spec, gemini);
      return { text, providerUsed: "gemini", fellBack: true };
    } catch (err) {
      errors.push(`gemini: ${(err as Error).message}`);
    }
  }

  if (errors.length === 0) throw new NoProviderAvailableError();
  throw new Error(`Todos os provedores falharam:\n${errors.join("\n")}`);
}
