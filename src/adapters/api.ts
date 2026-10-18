// Pay-per-token API adapters. These are text-only for now: API characters
// plan, review, and write scrolls, but they don't touch files until someone
// builds a tool-use loop for them (see ROADMAP: "API characters with hands").
// That makes them naturally safe at every tier.

import type { Adapter, AdapterRequest, AdapterResult } from "./adapter.ts";

/** USD per million tokens. Override per character with adapterConfig.priceIn / priceOut. */
function prices(req: AdapterRequest, defIn: number, defOut: number): [number, number] {
  const c = req.character.adapterConfig ?? {};
  return [Number(c.priceIn ?? defIn), Number(c.priceOut ?? defOut)];
}

function cost(inTok: number, outTok: number, [pin, pout]: [number, number]): number {
  return +((inTok * pin + outTok * pout) / 1_000_000).toFixed(6);
}

export const anthropicApi: Adapter = {
  kind: "anthropic-api",
  enforcement: "Text only — no file or shell access at any tier (yet)",
  async run(req): Promise<AdapterResult> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return { output: "", costGold: 0, costMp: 0, turns: 0, error: "ANTHROPIC_API_KEY is not set" };
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: req.character.model ?? "claude-sonnet-5-5",
        max_tokens: 4096,
        messages: [{ role: "user", content: req.prompt }],
      }),
    });
    const j = await res.json() as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens: number; output_tokens: number };
      error?: { message: string };
    };
    if (!res.ok) return { output: "", costGold: 0, costMp: 0, turns: 1, error: j.error?.message ?? `HTTP ${res.status}` };
    const text = (j.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const u = j.usage ?? { input_tokens: 0, output_tokens: 0 };
    return { output: text, costGold: cost(u.input_tokens, u.output_tokens, prices(req, 3, 15)), costMp: 0, turns: 1 };
  },
};

/** Anything that speaks /chat/completions: OpenAI, OpenRouter, LiteLLM proxy, Ollama, vLLM… */
export const openaiCompatible: Adapter = {
  kind: "openai-compatible",
  enforcement: "Text only — no file or shell access at any tier (yet)",
  async run(req): Promise<AdapterResult> {
    const cfg = req.character.adapterConfig ?? {};
    const base = cfg.baseUrl ?? "https://api.openai.com/v1";
    const key = process.env[cfg.keyEnv ?? "OPENAI_API_KEY"] ?? "";
    const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ model: req.character.model, messages: [{ role: "user", content: req.prompt }] }),
    });
    const j = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
      error?: { message: string };
    };
    if (!res.ok) return { output: "", costGold: 0, costMp: 0, turns: 1, error: j.error?.message ?? `HTTP ${res.status}` };
    const u = j.usage ?? { prompt_tokens: 0, completion_tokens: 0 };
    return {
      output: j.choices?.[0]?.message?.content ?? "",
      costGold: cost(u.prompt_tokens, u.completion_tokens, prices(req, 0, 0)),
      costMp: 0,
      turns: 1,
    };
  },
};
