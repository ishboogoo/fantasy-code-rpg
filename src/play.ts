// `savepoint play`: the game in your browser. A tiny local server (no
// dependencies) that serves the page (src/web), the art generators, the world
// state, a live stream of game events (Server-Sent Events), and the in-game
// commands. It binds to 127.0.0.1 only and every data request carries a
// one-time key.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Store } from "./store.ts";
import { Council } from "./council.ts";
import { MAX_SIEGE_PARTS, battle, keepBattle, undoBattle } from "./battle.ts";
import { QUEST_TYPES, proofOf, questTypeOf } from "./quests.ts";
import { JOB_ROLE, permissionsFor, recordFor, reliability, title } from "./rules.ts";
import { answer, request, setPlayStyle, settings, warRoom } from "./stages.ts";
import { checkParty, recommendParty, vendor, type Role } from "./party.ts";
import { recruit } from "./roster.ts";
import { lastLeadSuggestion, recordChoice } from "./ledger.ts";
import { runProcess } from "./adapters/adapter.ts";
import { refillMp } from "./economy.ts";
import { AskBook, NEED_WORDS } from "./asks.ts";
import type { AdapterKind, Formation, JobLine, World } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "src", "web");
const ASSETS: Record<string, string> = {
  "/gen/hero.js": join(ROOT, "assets", "generators", "hero.cjs"),
  "/gen/portrait.js": join(ROOT, "assets", "generators", "portrait.cjs"),
  "/gen/foe.js": join(ROOT, "assets", "generators", "foe.cjs"),
  "/brand/rain.png": join(ROOT, "assets", "brand", "rain.png"),
  "/brand/cover.png": join(ROOT, "assets", "brand", "cover.png"),
};
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png" };

const COMPANY: Record<string, string> = { anthropic: "Claude", openai: "OpenAI", google: "Gemini", mock: "Simulated", shell: "A command" };

/** Everything the screens need, in plain words. No secrets: adapter settings and keys are never sent. */
export function snapshot(store: Store, council: Council, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const w = store.load();
  for (const c of w.party) refillMp(c);
  return {
    ...extra,
    settings: settings(w),
    treasury: { gold: +(w.treasury.gold - w.treasury.spent).toFixed(2) },
    party: w.party.map((c) => {
      const p = permissionsFor(c.tier);
      const rec = recordFor(c);
      return {
        id: c.id, name: c.name, job: c.job, tier: c.tier, title: title(c), level: c.level, xp: c.xp,
        trust: +reliability(rec).toFixed(2), battles: rec.battles, role: JOB_ROLE[c.job],
        adapter: c.adapter, company: COMPANY[vendor(c.adapter)] ?? c.adapter,
        mp: c.mp ? { current: c.mp.current, max: c.mp.max, refillHours: c.mp.refillHours, lastRefill: c.mp.lastRefill } : null,
        status: c.status, look: c.look ?? {},
        may: Object.entries(p).filter(([, v]) => v === true).map(([k]) => k),
      };
    }),
    quests: w.enemies.map((e) => ({
      id: e.id, name: e.name, kind: e.kind, type: QUEST_TYPES[questTypeOf(e)].label, proofRule: QUEST_TYPES[questTypeOf(e)].proof,
      level: e.level, status: e.status, budget: e.budget.gold ?? QUEST_TYPES[questTypeOf(e)].gold,
      hp: e.criteria.filter((k) => !k.met).length, maxHp: e.criteria.length, approved: e.approved !== false,
      questions: e.questions ?? [], source: e.source, request: e.request ?? e.description,
      scouting: e.scouting ?? null, plan: e.plan ?? null, parts: e.parts ?? [],
      conditions: e.criteria.map((k) => ({ id: k.id, text: k.description, met: k.met, proof: proofOf(k), check: k.check ?? null })),
    })),
    battles: w.battles.slice(-30).map((b) => ({
      id: b.id, quest: b.enemyId, outcome: b.verdict.outcome, review: b.review, awaitingYou: b.awaitingYou ?? [], hasAlternate: !!b.alternate, formation: b.formation ?? "relay",
      party: b.party.map((p) => p.characterId), xp: b.xpAwarded, at: b.at, notes: b.verdict.notes, judgedBy: b.verdict.judgedBy,
      promotions: b.promotions, curses: b.curses,
    })),
    council: council.accuracy(),
    asks: new AskBook(store.chronicleDir).waiting().map((a) => ({ ...a, needWords: NEED_WORDS[a.need],
      helpers: w.party.filter((c) => c.id !== a.hero && permissionsFor(c.tier)[a.need]).map((c) => ({ id: c.id, name: c.name })) })),
    lore: store.lore().split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2)).slice(-12),
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

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let data = "";
  for await (const chunk of req) { data += chunk; if (data.length > 50_000) break; }
  try { return JSON.parse(data || "{}"); } catch { return {}; }
}

/** Which AI connections this computer has: installed CLIs and API keys (yes/no only, never the keys). */
async function connections(): Promise<Record<string, boolean>> {
  const has = async (cmd: string) => (await runProcess("sh", ["-c", `command -v ${cmd}`], { cwd: ROOT, timeoutMs: 5000 })).code === 0;
  return {
    "claude-code": await has("claude"), codex: await has("codex"), "gemini-cli": await has("gemini"),
    "anthropic-api": !!process.env.ANTHROPIC_API_KEY, "openai-compatible": !!process.env.OPENAI_API_KEY, mock: true,
  };
}

export interface PlayServer { url: string; close(): void }

export function startPlay(projectDir: string, port = 0): Promise<PlayServer> {
  const store = new Store(projectDir);
  const council = new Council(store.chronicleDir);
  const token = randomBytes(16).toString("hex");
  let fighting: string | null = null; // one battle at a time from the browser
  let queue: Promise<unknown> = Promise.resolve();
  /** Changes to the world run one after another, so two clicks can't overwrite each other. */
  const serial = <T>(fn: () => Promise<T>): Promise<T> => { const p = queue.then(fn); queue = p.catch(() => undefined); return p; };
  const change = <T>(fn: (w: World) => Promise<T>): Promise<T> => serial(async () => {
    if (fighting) throw new Error("A battle is under way. Its results are saved when it ends; try again then.");
    const w = store.load();
    const out = await fn(w);
    store.save(w);
    return out;
  });

  async function command(b: Record<string, unknown>): Promise<Record<string, unknown>> {
    const id = String(b.id ?? "");
    const quest = (w: World) => { const q = w.enemies.find((e) => e.id === id); if (!q) throw new Error("No such quest."); return q; };
    switch (b.cmd) {
      // Answering a waiting hero never touches the world file, so it works while a battle runs.
      case "decide": {
        const book = new AskBook(store.chronicleDir);
        const a = book.get(id);
        if (!a) throw new Error("No such question.");
        const decision = String(b.decision);
        if (decision !== "allow" && decision !== "deny" && decision !== "handoff") throw new Error("Answer allow, deny or handoff.");
        if (decision === "handoff") {
          const to = store.load().party.find((c) => c.id === String(b.to ?? ""));
          if (!to || !permissionsFor(to.tier)[a.need]) throw new Error("That hero isn't allowed to do it either.");
        }
        book.decide(id, decision, decision === "handoff" ? String(b.to) : undefined);
        return { message: decision === "allow" ? "Allowed, just this once." : decision === "deny" ? "Denied." : "Handed over." };
      }
      case "keep": return { message: await change((w) => keepBattle(w, store, id, projectDir, !!b.other)) };
      case "undo": return { message: await change((w) => undoBattle(w, store, id, projectDir, council, b.why ? String(b.why).slice(0, 300) : undefined)) };
      case "approve": return change(async (w) => {
        const q = quest(w);
        if (q.questions?.length) throw new Error("Answer its questions first.");
        q.approved = true;
        return { message: `Approved ${q.name}.` };
      });
      case "answer": return change(async (w) => { answer(quest(w), String(b.text ?? "").slice(0, 2000)); return { message: "Noted." }; });
      case "request": return change(async (w) => {
        const text = String(b.text ?? "").trim().slice(0, 4000);
        if (!text) throw new Error("Tell the Clerk what you want first.");
        const r = await request(w, store, council, text, projectDir);
        return { message: `Written by ${r.by}.`, quest: r.quest.id, dropped: r.dropped.length };
      });
      case "plan": return change(async (w) => {
        const r = await warRoom(w, store, quest(w), projectDir);
        return { message: r.verdict, ...r };
      });
      case "suggest": return serial(async () => {
        const w = store.load();
        const plan = recommendParty(w, quest(w), 3, council);
        store.save(w); // the Council's decision log is separate; nothing else changes
        return { members: plan.members, warnings: plan.warnings, councilSure: plan.leadDecision?.seat !== "you" };
      });
      case "check": return serial(async () => {
        const w = store.load();
        const picks = (Array.isArray(b.picks) ? b.picks : []) as Array<{ id: string; role: Role }>;
        return { warnings: checkParty(w, quest(w), picks) };
      });
      case "battle": {
        if (fighting) throw new Error("A battle is already under way.");
        const ids = (Array.isArray(b.party) ? b.party : []).map(String).filter(Boolean).slice(0, 4);
        const w0 = store.load();
        const q = quest(w0);
        if (q.questions?.length) throw new Error("A Sphinx blocks the road: answer its questions first.");
        if (q.approved === false) throw new Error("Approve its victory conditions first.");
        await queue; // let any pending change land first
        fighting = id;
        const w = store.load();
        const q1 = quest(w);
        const partyIds = ids.length ? ids : recommendParty(w, q1, Math.max(3, Math.min(q1.parts?.length ?? 0, MAX_SIEGE_PARTS)), council).members.filter((m) => m.role !== "judge").map((m) => m.id);
        const suggested = lastLeadSuggestion(council.decisions(), id);
        if (ids.length && suggested && suggested !== ids[0]) { recordChoice(w, questTypeOf(quest(w)), ids[0], suggested); store.save(w); }
        // The battle runs on; its progress arrives over the event stream.
        // A quest split into parts is fought as a Siege unless the player picked another formation.
        const formation: Formation | undefined = b.formation === "pincer" || b.formation === "siege" || b.formation === "relay" ? b.formation
          : (q1.parts?.length ?? 0) >= 2 ? "siege" : undefined;
        void battle({ world: w, store, enemyId: id, partyIds, judge: { kind: "auto" }, cwd: projectDir, council, debrief: true, formation })
          .then(() => store.save(w))
          .catch((e: unknown) => store.event({ type: "say", text: `✖ ${e instanceof Error ? e.message : String(e)}` }))
          .finally(() => { fighting = null; store.event({ type: "idle" }); });
        return { message: "The party sets out.", party: partyIds };
      }
      case "recruit": return change(async (w) => {
        const c = recruit(w, String(b.name ?? ""), String(b.adapter ?? "") as AdapterKind, String(b.job ?? "") as JobLine,
          { look: { race: String(b.race ?? "human"), build: b.build === "masculine" ? "masculine" : "feminine" } });
        return { message: `${c.name} joins the guild!`, id: c.id };
      });
      case "settings": return change(async (w) => {
        if (b.playStyle) setPlayStyle(w, String(b.playStyle));
        if (b.language === "en" || b.language === "ja") settings(w).language = b.language;
        if (b.seer !== undefined) {
          if (!b.seer) delete settings(w).seer;
          else if (w.party.some((c) => c.id === b.seer)) settings(w).seer = String(b.seer);
          else throw new Error("No such hero.");
        }
        return { message: "Saved.", settings: settings(w) };
      });
      default: throw new Error("Unknown command.");
    }
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (code: number, type: string, data: string | Buffer) => {
      res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'" });
      res.end(data);
    };
    const authed = url.searchParams.get("t") === token || req.headers["x-savepoint-token"] === token;
    try {
      if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
      // Art, styles and scripts carry no project data. The page and the API need the key.
      if (url.pathname in ASSETS) return send(200, TYPES[extname(ASSETS[url.pathname])] ?? "application/octet-stream", readFileSync(ASSETS[url.pathname]));
      if (url.pathname.startsWith("/web/")) {
        const file = normalize(join(WEB, url.pathname.slice(5)));
        if (!file.startsWith(WEB) || !existsSync(file)) return send(404, "text/plain", "Not found");
        return send(200, TYPES[extname(file)] ?? "application/octet-stream", readFileSync(file));
      }
      if (!authed) return send(403, "text/plain", "Open the link printed by `savepoint play` (it carries a one-time key).");
      if (url.pathname === "/") return send(200, TYPES[".html"], readFileSync(join(WEB, "index.html")));
      if (url.pathname === "/api/state") return send(200, "application/json", JSON.stringify(snapshot(store, council, { fighting })));
      if (url.pathname === "/api/connections") return send(200, "application/json", JSON.stringify(await connections()));
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
        const out = await command(await body(req));
        return send(200, "application/json", JSON.stringify({ ok: true, ...out }));
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
