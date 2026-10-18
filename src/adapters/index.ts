import type { AdapterKind } from "../types.ts";
import type { Adapter } from "./adapter.ts";
import { claudeCode, codex, geminiCli, shell } from "./cli.ts";
import { anthropicApi, openaiCompatible } from "./api.ts";
import { mock } from "./mock.ts";

export const ADAPTERS: Record<AdapterKind, Adapter> = {
  "claude-code": claudeCode,
  "codex": codex,
  "gemini-cli": geminiCli,
  "anthropic-api": anthropicApi,
  "openai-compatible": openaiCompatible,
  "shell": shell,
  "mock": mock,
};

export type { Adapter, AdapterRequest, AdapterResult } from "./adapter.ts";
