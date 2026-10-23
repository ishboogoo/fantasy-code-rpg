// `savepoint play`: the game in your browser. A tiny local server (no
// dependencies) that serves one page, the art generators, the world state,
// and a live stream of game events (Server-Sent Events). It binds to
// 127.0.0.1 only and every request must carry a one-time token.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Store } from "./store.ts";
import { Council } from "./council.ts";
import { keepBattle, undoBattle } from "./battle.ts";
import { QUEST_TYPES, proofOf, questTypeOf } from "./quests.ts";
import { permissionsFor, recordFor, reliability, title } from "./rules.ts";
import { settings } from "./stages.ts";
import { vendor } from "./party.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATIC: Record<string, [string, string]> = {
  "/": [join(ROOT, "src", "play.html"), "text/html; charset=utf-8"],
  "/gen/hero.js": [join(ROOT, "assets", "generators", "hero.cjs"), "text/javascript"],
  "/gen/portrait.js": [join(ROOT, "assets", "generators", "portrait.cjs"), "text/javascript"],
  "/gen/foe.js": [join(ROOT, "assets", "generators", "foe.cjs"), "text/javascript"],
  "/brand/rain.png": [join(ROOT, "assets", "brand", "rain.png"), "image/png"],
  "/brand/cover.png": [join(ROOT, "assets", "brand", "cover.png"), "image/png"],
};

const COMPANY: Record<string, string> = { anthropic: "Claude", openai: "OpenAI", google: "Gemini", mock: "Simulated", shell: "A command" };

/** Everything the screens need, in plain words. No secrets: adapter settings and keys are never sent. */
export function snapshot(store: Store, council: Council): Record<string, unknown> {
  const w = store.load();
  return {
    settings: settings(w),
    treasury: { gold: +(w.treasury.gold - w.treasury.spent).toFixed(2) },
    party: w.party.map((c) => {
      const p = permissionsFor(c.tier);
      return {
        id: c.id, name: c.name, job: c.job, tier: c.tier, title: title(c), level: c.level, xp: c.xp,
        trust: +reliability(recordFor(c)).toFixed(2), adapter: c.adapter, company: COMPANY[vendor(c.adapter)] ?? c.adapter,
        mp: c.mp ? { current: c.mp.current, max: c.mp.max } : null, status: c.status, look: c.look ?? {},
        may: Object.entries(p).filter(([k, v]) => v === true).map(([k]) => k),
      };
    }),
    quests: w.enemies.map((e) => ({
      id: e.id, name: e.name, kind: e.kind, type: QUEST_TYPES[questTypeOf(e)].label, level: e.level, status: e.status,
      hp: e.criteria.filter((k) => !k.met).length, maxHp: e.criteria.length, approved: e.approved !== false,
      questions: e.questions ?? [], source: e.source,
      conditions: e.criteria.map((k) => ({ id: k.id, text: k.description, met: k.met, proof: proofOf(k) })),
    })),
    battles: w.battles.slice(-20).map((b) => ({
      id: b.id, quest: b.enemyId, outcome: b.verdict.outcome, review: b.review, awaitingYou: b.awaitingYou ?? [],
      party: b.party.map((p) => p.characterId), xp: b.xpAwarded, at: b.at, notes: b.verdict.notes,
    })),
    council: council.accuracy(),
  };
}

function readFrom(file: string, offset: number): { text: string; size: number } {
  if (!existsSync(file)) return { text: "", size: 0 };
  const size = statSync(file).size;
  if (size <= offset) return { text: "", size };
  const fd = openSync(file, "r");
  const buf = Buffer.alloc(size - offset);
  readSync(fd, buf, 0, buf.length, offset);
  closeSync(fd);
  return { text: buf.toString("utf8"), size };
}

async function body(req: IncomingMessage): Promise<Record<string, string>> {
  let data = "";
  for await (const chunk of req) { data += chunk; if (data.length > 10_000) break; }
  try { return JSON.parse(data || "{}"); } catch { return {}; }
}

export interface PlayServer { url: string; close(): void }

export function startPlay(projectDir: string, port = 0): Promise<PlayServer> {
  const store = new Store(projectDir);
  const council = new Council(store.chronicleDir);
  const token = randomBytes(16).toString("hex");

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (code: number, type: string, data: string | Buffer) => {
      res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(data);
    };
    // Static files carry no project data, but the page and the API still need the token.
    const authed = url.searchParams.get("t") === token || req.headers["x-savepoint-token"] === token;
    try {
      if (url.pathname in STATIC && url.pathname !== "/") {
        const [file, type] = STATIC[url.pathname];
        return send(200, type, readFileSync(file));
      }
      if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
      if (!authed) return send(403, "text/plain", "Open the link printed by `savepoint play` (it carries a one-time key).");
      if (url.pathname === "/") return send(200, STATIC["/"][1], readFileSync(STATIC["/"][0]));
      if (url.pathname === "/api/state") return send(200, "application/json", JSON.stringify(snapshot(store, council)));
      if (url.pathname === "/api/events") {
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
        // Replay the last few events so a fresh page has context, then follow the file.
        const start = readFrom(store.eventsFile, 0);
        const lines = start.text.split("\n").filter(Boolean).slice(-60);
        for (const l of lines) res.write(`data: ${l}\n\n`);
        let offset = start.size, partial = "";
        const timer = setInterval(() => {
          const r = readFrom(store.eventsFile, offset);
          offset = r.size;
          if (!r.text) { res.write(": ping\n\n"); return; }
          const all = (partial + r.text).split("\n");
          partial = all.pop() ?? "";
          for (const l of all) if (l.trim()) res.write(`data: ${l}\n\n`);
        }, 400);
        req.on("close", () => clearInterval(timer));
        return;
      }
      if (url.pathname === "/api/cmd" && req.method === "POST") {
        const b = await body(req);
        const w = store.load();
        let message: string;
        if (b.cmd === "keep") message = await keepBattle(w, store, String(b.id), projectDir);
        else if (b.cmd === "undo") message = await undoBattle(w, store, String(b.id), projectDir, council);
        else if (b.cmd === "approve") {
          const q = w.enemies.find((e) => e.id === b.id);
          if (!q) throw new Error("No such quest.");
          if (q.questions?.length) throw new Error("Answer its questions first.");
          q.approved = true; message = `Approved ${q.name}.`;
        } else throw new Error("Unknown command.");
        store.save(w);
        return send(200, "application/json", JSON.stringify({ ok: true, message }));
      }
      return send(404, "text/plain", "Not found");
    } catch (e) {
      return send(400, "application/json", JSON.stringify({ ok: false, message: e instanceof Error ? e.message : String(e) }));
    }
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const p = typeof addr === "object" && addr ? addr.port : port;
      resolve({ url: `http://127.0.0.1:${p}/?t=${token}`, close: () => server.close() });
    });
  });
}
