#!/usr/bin/env node
// savepoint — command-line entry point.

import { parseArgs } from "node:util";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "./store.ts";
import { battle, keepBattle, undoBattle, type JudgeSpec } from "./battle.ts";
import { Council } from "./council.ts";
import { QUEST_TYPES, classifyByRules, proofOf, questTypeOf } from "./quests.ts";
import { adventurerOffer, answer, needsApproval, request, setPlayStyle, settings, warRoom } from "./stages.ts";
import { lastLeadSuggestion, recordChoice } from "./ledger.ts";
import { recommendParty, checkParty, type Role } from "./party.ts";
import { newCharacter, recruit } from "./roster.ts";
import { ADAPTERS } from "./adapters/index.ts";
import { JOB_TITLES } from "./rules.ts";
import { importGithub } from "./importers.ts";
import { AskBook, NEED_WORDS } from "./asks.ts";
import { allowOutput, decideTool, moveFor, denyOutput, keepGoingOutput, stopGate, type HookCli } from "./hooks.ts";
import { permissionsFor, recordFor, reliability, tierFor, title } from "./rules.ts";
import { dirname } from "node:path";
import { box, enemiesScreen, partyScreen, reportScreen, characterLine } from "./render.ts";
import type { AdapterKind, Character, Enemy, EnemyKind, JobLine, QuestType, World } from "./types.ts";

const HELP = `
SAVEPOINT — a 90s-RPG harness for AI agent teams

  savepoint init                               Create .savepoint/ in this folder
  savepoint recruit <name> --adapter <kind> --job <job> [--model m] [--mp 100 --refill 5]
                     [--billing api|subscription] [--cmd "..."] [--base-url u] [--skill 0.8]
  savepoint party                              Show the party
  savepoint spawn <id> --name "…" --kind orc --level 4 --criteria "a: desc" --criteria "b: desc"
                     [--type build|fix|improve|explore|maintain|write]
                     [--check "b=npm test"] [--guard "npm test"] [--gold 1] [--turns 20]
  savepoint spawn --file quest.json            Spawn enemies from a JSON file
  savepoint enemies                            Show the bestiary

  The quest loop, in plain words:
  savepoint request "<what you want>" [--id q7] Guild Counter: the Clerk turns it into a quest
  savepoint import github [--label bug] [--limit 10] [--repo owner/name]   Open issues become quests
  savepoint answer <quest> "<your answer>"     Answer the Clerk's or Scout's questions
  savepoint plan <quest>                       War Room: read-only scouting report and plan
  savepoint approve <quest>                    Approve the victory conditions and plan (Adventurer, Tactician)
  savepoint settings [--play-style story|adventurer|tactician]
  savepoint suggest <enemy-id>                 Recommended party for a quest, with reasons
  savepoint battle <enemy-id> [--party a,b] [--judge tests|auto|<character>]  (no --party = use the recommendation)
                     [--in-place]  run in your folder instead of a private copy (no undo)
                     [--formation pincer]  the first two heroes each try their own approach; the better one wins
  savepoint keep <battle-id> [--other]         Treasure Vault: bring a battle's changes into your project (--other: the Pincer's other approach)
  savepoint undo <battle-id> [--why "..."]      Treasure Vault: throw a battle's changes away (counts as a loss); your reason becomes a house rule
  savepoint seer <hero> | --off                Seat a hero as the Seer: a cheap, fast model the Council asks three times
  savepoint council                            How each Council seat has decided, and how often it was right
  savepoint asks                               Heroes waiting for your answer (Wait mode)
  savepoint allow|deny <id> · handoff <id> <hero>  Answer them: allow once, deny, or hand the job to another hero
  savepoint lore "<fact>"                      Add shared knowledge to the Chronicle
  savepoint fund <gold>                        Add gold to the treasury
  savepoint demo [--battles 40]                Simulated campaign with mock characters
  savepoint play [--port 4747] [--demo]        The game in your browser (local only). --demo: a practice guild with simulated heroes
  savepoint gate --cli claude|codex|gemini     Before-tool hook: one rulebook for all three CLIs (installed automatically)
  savepoint stop-gate --cli claude|codex|gemini  Stop hook: no proof, no victory (installed automatically)
  savepoint statusline                         One-line HUD for Claude Code's status line

Adapters: ${Object.keys(ADAPTERS).join(", ")}
Jobs:     ${Object.keys(JOB_TITLES).join(", ")}
Enemies:  slime, goblin, orc, golem, wyvern, lich, mimic, dragon
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    adapter: { type: "string" }, job: { type: "string" }, model: { type: "string" },
    mp: { type: "string" }, refill: { type: "string" }, billing: { type: "string" },
    cmd: { type: "string" }, "base-url": { type: "string" }, skill: { type: "string" },
    name: { type: "string" }, kind: { type: "string" }, level: { type: "string" },
    criteria: { type: "string", multiple: true }, check: { type: "string", multiple: true },
    guard: { type: "string" }, gold: { type: "string" }, turns: { type: "string" },
    file: { type: "string" }, party: { type: "string" }, judge: { type: "string" },
    battles: { type: "string" }, help: { type: "boolean", short: "h" },
    type: { type: "string" }, "in-place": { type: "boolean" },
    port: { type: "string" }, demo: { type: "boolean" }, why: { type: "string" }, off: { type: "boolean" }, formation: { type: "string" }, other: { type: "boolean" },
    id: { type: "string" }, label: { type: "string" }, limit: { type: "string" }, repo: { type: "string" }, "play-style": { type: "string" }, cli: { type: "string" },
  },
});

const cwd = process.cwd();
const store = new Store(cwd);
const council = new Council(store.chronicleDir);
const [cmd, ...rest] = positionals;


function parseCriteria(list: string[] = [], checks: string[] = []): Enemy["criteria"] {
  const crit = list.map((s, i) => {
    const colon = s.indexOf(":");
    return { id: colon > 0 ? s.slice(0, colon).trim() : `c${i + 1}`, description: colon > 0 ? s.slice(colon + 1).trim() : s };
  });
  // "--check c1=cmd" names its condition; a bare "--check cmd" goes to the condition in the same position
  // (so "FOO=1 npm test" still works as a bare command).
  const byId = new Map<string, string>(), byPos: string[] = [];
  for (const c of checks) {
    const eq = c.indexOf("=");
    if (eq > 0 && crit.some((k) => k.id === c.slice(0, eq))) byId.set(c.slice(0, eq), c.slice(eq + 1));
    else byPos.push(c);
  }
  return crit.map((k, i) => ({ ...k, check: byId.get(k.id) ?? byPos[i], met: false }));
}

async function main(): Promise<void> {
  if (!cmd || values.help) { console.log(HELP); return; }

  if (cmd === "init") {
    store.init();
    console.log(box("NEW GAME", ["A new world was created in .savepoint/", "Next: recruit a character at the Tavern."]));
    return;
  }
  if (cmd === "demo") return demo(Number(values.battles ?? 40));
  if (cmd === "play") return play();
  if (cmd === "gate") return gate();
  if (cmd === "stop-gate") return stopGateCmd();
  if (cmd === "statusline") return statusline();

  const world = store.load();
  const save = () => store.save(world);

  switch (cmd) {
    case "recruit": {
      const name = rest[0];
      const adapter = values.adapter as AdapterKind;
      const job = (values.job ?? "fighter") as JobLine;
      if (!name || !ADAPTERS[adapter]) throw new Error(`Usage: recruit <name> --adapter <${Object.keys(ADAPTERS).join("|")}> --job <job>`);
      if (!JOB_TITLES[job]) throw new Error(`Unknown job ${job}`);
      const config: Record<string, string> = {};
      if (values.billing) config.billing = values.billing;
      if (values.cmd) config.command = values.cmd;
      if (values["base-url"]) config.baseUrl = values["base-url"];
      if (values.skill) config.skill = values.skill;
      const c = recruit(world, name, adapter, job, {
        model: values.model, adapterConfig: config,
        mp: values.mp ? { max: Number(values.mp), current: Number(values.mp), refillHours: Number(values.refill ?? 5), lastRefill: new Date().toISOString() } : undefined,
      });
      save();
      console.log(box("TAVERN", [`${name} joins the party!`, characterLine(c), `Enforcement: ${ADAPTERS[adapter].enforcement}`]));
      return;
    }
    case "party": console.log(partyScreen(world)); return;
    case "enemies": console.log(enemiesScreen(world)); return;
    case "spawn": {
      const spawned: Enemy[] = values.file
        ? (JSON.parse(readFileSync(values.file, "utf8")) as Enemy[])
        : [{
          id: rest[0] ?? `e${world.enemies.length + 1}`, name: values.name ?? rest[0] ?? "Unnamed foe",
          kind: (values.kind ?? "goblin") as EnemyKind, level: Number(values.level ?? 1),
          description: values.name ?? "", criteria: parseCriteria(values.criteria, values.check),
          budget: { gold: values.gold ? Number(values.gold) : undefined, maxTurns: Number(values.turns ?? 20) },
          guard: values.guard, status: "lurking",
          questType: values.type as QuestType | undefined,
        }];
      for (const e of spawned) {
        e.status ??= "lurking";
        if (e.questType && !QUEST_TYPES[e.questType]) throw new Error(`Unknown quest type ${e.questType}. Use one of: ${Object.keys(QUEST_TYPES).join(", ")}.`);
        if (!e.questType) {
          const text = [e.name, e.description, ...e.criteria.map((k) => k.description)].join(" ");
          const d = council.decide<QuestType>("quest-type", `What kind of quest is ${e.name}?`, {
            law: () => { const c = classifyByRules(text); return c ? { answer: c.type, confidence: 0.9, reasons: [`Mentions "${c.matched[0]}"`] } : null; },
          }, e.id);
          if (d.answer) e.questType = d.answer;
          else console.log(`? The Council couldn't tell what kind of quest ${e.name} is, so it's treated as ${QUEST_TYPES[questTypeOf(e)].label} for now. Set it with --type.`);
        }
        e.budget.gold ??= QUEST_TYPES[questTypeOf(e)].gold;
        e.criteria = e.criteria.map((k) => ({ ...k, met: k.met ?? false }));
        if (!e.criteria.length) throw new Error(`${e.id} needs at least one --criteria (that's its HP).`);
        world.enemies.push(e);
      }
      save();
      console.log(enemiesScreen(world));
      return;
    }
    case "request": {
      const text = rest.join(" ").trim();
      if (!text) throw new Error('Usage: request "<what you want, in plain words>"');
      const r = await request(world, store, council, text, cwd, values.id);
      save();
      console.log(questWindow(r.quest, `GUILD COUNTER · written by ${r.by}`));
      if (r.dropped.length) console.log(`  (The Gatekeeper refused ${r.dropped.length} proposed check(s) as unsafe; a judge will decide those instead.)`);
      console.log(nextStep(world, r.quest));
      return;
    }
    case "import": {
      if (rest[0] !== "github") throw new Error("Usage: import github [--label bug] [--limit 10] [--repo owner/name]. Other trackers: paste the text into savepoint request.");
      const r = await importGithub(world, store, council, cwd, { label: values.label, limit: values.limit ? Number(values.limit) : undefined, repo: values.repo });
      save();
      for (const a of r.added) console.log(`📜 ${a.quest.id} · ${a.quest.name} (${QUEST_TYPES[questTypeOf(a.quest)].label})${a.quest.questions?.length ? " · has questions" : ""}`);
      console.log(`${r.added.length} new quest(s) on the board${r.skipped ? `, ${r.skipped} already there` : ""}.`);
      return;
    }
    case "answer": {
      const q = world.enemies.find((e) => e.id === rest[0]);
      if (!q || !rest[1]) throw new Error('Usage: answer <quest> "<your answer>"');
      answer(q, rest.slice(1).join(" "));
      save();
      console.log(`📝 Noted. ${nextStep(world, q)}`);
      return;
    }
    case "plan": {
      const q = world.enemies.find((e) => e.id === rest[0]);
      if (!q) throw new Error("Usage: plan <quest>");
      const r = await warRoom(world, store, q, cwd);
      save();
      console.log(warRoomWindow(q, r));
      console.log(nextStep(world, q));
      return;
    }
    case "approve": {
      const q = world.enemies.find((e) => e.id === rest[0]);
      if (!q) throw new Error("Usage: approve <quest>");
      if (q.questions?.length) throw new Error(`Answer the open questions first: savepoint answer ${q.id} "..."`);
      q.approved = true;
      save();
      console.log(`✅ Approved ${q.name}${q.plan ? " and its plan" : ""}. ${nextStep(world, q)}`);
      return;
    }
    case "settings": {
      if (values["play-style"]) setPlayStyle(world, values["play-style"]);
      save();
      const st = settings(world);
      console.log(box("SETTINGS", [`Play style: ${st.playStyle}`,
        st.playStyle === "story" ? "You describe what you want and judge the result. The guild handles the rest." :
        st.playStyle === "adventurer" ? "You approve victory conditions and plans, and accept or swap the party." :
        "Every stage is yours to edit.", "Change: savepoint settings --play-style story|adventurer|tactician"]));
      return;
    }
    case "battle": {
      const enemyId = rest[0];
      if (!enemyId) throw new Error("Usage: battle <enemy-id> [--party a,b] [--judge tests|auto|<id>]");
      const foe = world.enemies.find((e) => e.id === enemyId);
      if (foe?.questions?.length) throw new Error(`A Sphinx blocks the road: answer its questions first (savepoint answer ${foe.id} "...").`);
      if (foe?.approved === false) throw new Error(`${foe.name} is waiting for your approval: savepoint approve ${foe.id}`);
      // Story mode: the War Room runs on its own before the battle.
      if (foe && !foe.plan && !needsApproval(world) && !foe.questions?.length) {
        const wr = await warRoom(world, store, foe, cwd);
        save();
        if (wr.scout || wr.planner) console.log(`🗺  War Room: ${[wr.scout && `${wr.scout} scouted`, wr.planner && `${wr.planner} planned`].filter(Boolean).join(", ")}.`);
        if (wr.verdict !== "proceed") { console.log(warRoomWindow(foe, wr)); console.log(nextStep(world, foe)); return; }
      }
      let partyIds = (values.party ?? "").split(",").filter(Boolean);
      let j = values.judge ?? "auto";
      if (foe && !partyIds.length) {
        const plan = recommendParty(world, foe, 3, council);
        partyIds = plan.members.filter((m) => m.role !== "judge").map((m) => m.id);
        // Judging stays on "auto": up to three judges from other AI companies, chosen at the end.
        console.log(`Recommended party: ${plan.members.map((m) => `${m.name} (${m.role})`).join(", ")}`);
        if (plan.leadDecision?.seat === "you") console.log(`? The Council isn't sure who should lead yet, so it's going with its best guess. Choose yourself with --party.`);
      } else if (foe) {
        const picks: Array<{ id: string; role: Role }> = partyIds.map((id, i) => ({ id, role: i === 0 ? "lead" : "support" }));
        if (j !== "auto" && j !== "tests") picks.push({ id: j, role: "judge" });
        for (const wmsg of checkParty(world, foe, picks)) console.log(`⚠ ${wmsg}`);
      }
      if (!partyIds.length) throw new Error("Nobody in your guild can take this quest yet. Recruit or rest first.");
      const judge: JudgeSpec = j === "tests" ? { kind: "tests" } : j === "auto" ? { kind: "auto" } : { kind: "character", id: j };
      // If you picked a different lead than the Council last suggested, the Ledger learns your preference.
      if (foe && values.party) {
        const suggested = lastLeadSuggestion(council.decisions(), foe.id);
        if (suggested && partyIds[0] && suggested !== partyIds[0]) recordChoice(world, questTypeOf(foe), partyIds[0], suggested);
      }
      const formation = values.formation === "pincer" ? "pincer" : undefined;
      const r = await battle({ world, store, enemyId, partyIds, judge, cwd, council, debrief: true, formation, isolate: values["in-place"] ? false : undefined, onEvent: (l) => console.log(l) });
      save();
      console.log(reportScreen(world, r));
      return;
    }
    case "suggest": {
      const foe = world.enemies.find((e) => e.id === rest[0]);
      if (!foe) throw new Error("Usage: suggest <enemy-id>");
      const plan = recommendParty(world, foe, 3, council);
      console.log(`Recommended party for ${foe.name} (${QUEST_TYPES[questTypeOf(foe)].label} quest · proof: ${QUEST_TYPES[questTypeOf(foe)].proof}):`);
      for (const m of plan.members) console.log(`  ${m.role.toUpperCase().padEnd(8)} ${m.name}${m.reasons.length ? " · " + m.reasons.join("; ") : ""}`);
      for (const wmsg of plan.warnings) console.log(`  ⚠ ${wmsg}`);
      console.log(`Swap anyone: savepoint battle ${foe.id} --party <lead>,<support> --judge <name>`);
      return;
    }
    case "keep": {
      if (!rest[0]) throw new Error("Usage: keep <battle-id>");
      console.log(`📦 ${await keepBattle(world, store, rest[0], cwd, !!values.other)}`);
      const offer = adventurerOffer(world);
      if (offer) console.log(`💡 ${offer}`);
      save();
      return;
    }
    case "undo": {
      if (!rest[0]) throw new Error("Usage: undo <battle-id>");
      console.log(`🗑 ${await undoBattle(world, store, rest[0], cwd, council, values.why)}`);
      if (values.why) console.log("📜 Your reason is now a house rule every hero reads.");
      save();
      return;
    }
    case "council": {
      const rows = council.accuracy();
      if (!rows.length) { console.log("The Council hasn't decided anything yet."); return; }
      const lines = rows.map((r) => `${r.kind.padEnd(11)} ${r.seat.padEnd(7)} decided ${String(r.decided).padStart(3)} · ` +
        (r.judged ? `right ${r.right}/${r.judged} (${Math.round((100 * r.right) / r.judged)}%)` : "no results yet"));
      console.log(box("THE COUNCIL", ["kind        seat    record", ...lines]));
      return;
    }
    case "seer": {
      if (values.off) { delete settings(world).seer; save(); console.log("The Seer's seat is empty."); return; }
      const h = world.party.find((c) => c.id === rest[0] || c.name.toLowerCase() === (rest[0] ?? "").toLowerCase());
      if (!h) throw new Error("Usage: seer <hero> (pick your cheapest, fastest hero) or seer --off");
      settings(world).seer = h.id; save();
      console.log(`🔮 ${h.name} takes the Seer's seat. The Council asks the Seer three times and trusts only a unanimous answer.`);
      return;
    }
    case "asks": {
      const waiting = new AskBook(store.chronicleDir).waiting();
      if (!waiting.length) { console.log("No hero is waiting for you."); return; }
      for (const a of waiting) console.log(`? ${a.id} · ${world.party.find((c) => c.id === a.hero)?.name ?? a.hero} wants to ${NEED_WORDS[a.need]}: ${a.target}\n    savepoint allow ${a.id} · savepoint deny ${a.id} · savepoint handoff ${a.id} <hero>`);
      return;
    }
    case "allow": case "deny": case "handoff": {
      if (!rest[0]) throw new Error(`Usage: ${cmd} <question-id>${cmd === "handoff" ? " <hero>" : ""}`);
      const book = new AskBook(store.chronicleDir);
      const a = book.get(rest[0]);
      if (cmd === "handoff") {
        const to = world.party.find((c) => c.id === rest[1] || c.name.toLowerCase() === (rest[1] ?? "").toLowerCase());
        if (!to) throw new Error("Usage: handoff <question-id> <hero>");
        if (a && !permissionsFor(to.tier)[a.need]) throw new Error(`${to.name} isn't allowed to ${NEED_WORDS[a.need]} either.`);
        book.decide(rest[0], "handoff", to.id);
        console.log(`🤝 ${to.name} takes over after this turn.`);
      } else {
        book.decide(rest[0], cmd);
        console.log(cmd === "allow" ? "✅ Allowed, just this once. It's logged and doesn't affect anyone's trust." : "🛡 Denied. The hero will describe the change instead.");
      }
      return;
    }
    case "lore": store.addLore(rest.join(" ")); console.log("📜 Written into the Chronicle."); return;
    case "fund": world.treasury.gold += Number(rest[0] ?? 0); save(); console.log(`💰 Treasury now holds ${world.treasury.gold - world.treasury.spent} G`); return;
    default: console.log(HELP);
  }
}

function questWindow(q: Enemy, title: string): string {
  const t = QUEST_TYPES[questTypeOf(q)];
  return box(title, [
    `${q.id} · ${q.name}`,
    `${t.label} quest · ${q.kind} · Lv ${q.level} · budget ${q.budget.gold ?? t.gold} G`,
    "Victory conditions:",
    ...q.criteria.flatMap((k) => [`  • ${k.description}`,
      `    proven by ${proofOf(k) === "command" ? `running: ${k.check}` : proofOf(k) === "human" ? "you, at the Treasure Vault" : "independent judges"}`]),
    ...(q.questions?.length ? ["A Sphinx blocks the road. Questions:", ...q.questions.map((x) => `  ? ${x}`)] : []),
  ]);
}

function warRoomWindow(q: Enemy, r: { verdict: string; scout?: string; planner?: string; questions: string[]; splits: string[] }): string {
  const lines = [`${q.id} · ${q.name}`];
  if (r.scout) lines.push(`Scout: ${r.scout} → ${r.verdict === "proceed" ? "clear to proceed" : r.verdict === "unclear" ? "unclear, needs your answer" : "really several quests"}`);
  if (r.verdict === "split") lines.push("Suggested quests:", ...r.splits.map((x) => `  • ${x}`), 'Request each one: savepoint request "..."');
  if (r.verdict === "unclear") lines.push(...(q.questions ?? []).map((x) => `  ? ${x}`));
  if (q.plan) lines.push(`Plan by ${r.planner}:`, ...q.plan.split("\n").slice(0, 12).map((x) => `  ${x}`));
  if (!r.scout && !r.planner) lines.push("Nobody is free for a desk job: recruit a hero first.");
  return box("WAR ROOM", lines);
}

function nextStep(world: World, q: Enemy): string {
  if (q.questions?.length) return `Next: savepoint answer ${q.id} "..."`;
  if (q.approved === false) return `Next: check it, then savepoint approve ${q.id}${q.plan ? "" : ` (or savepoint plan ${q.id} first)`}`;
  if (!q.plan && needsApproval(world)) return `Next: savepoint plan ${q.id} (or go straight to savepoint battle ${q.id})`;
  return `Next: savepoint battle ${q.id}`;
}

async function readStdin(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

function hookCli(): HookCli {
  const c = values.cli ?? "claude";
  if (c !== "claude" && c !== "codex" && c !== "gemini") throw new Error("--cli must be claude, codex or gemini");
  return c;
}

/** Before every tool call (Claude Code PreToolUse, Codex PreToolUse, Gemini BeforeTool). Silent unless a hero is acting. */
async function gate(): Promise<void> {
  const cli = hookCli();
  const id = process.env.SAVEPOINT_CHARACTER;
  const home = process.env.SAVEPOINT_HOME;
  const raw = await readStdin();
  if (!id || !home) return;
  const s = new Store(dirname(home));
  const c = s.load().party.find((x) => x.id === id);
  const event = JSON.parse(raw || "{}") as { tool_name?: string; tool_input?: Record<string, unknown> };
  const tool = event.tool_name ?? "unknown";
  const decision = c ? decideTool(cli, tool, event.tool_input ?? {}, permissionsFor(c.tier))
    : { allow: false, reason: `Unknown character ${id}.` };
  const m = moveFor(cli, tool, event.tool_input ?? {});
  const quest = process.env.SAVEPOINT_QUEST || undefined;
  if (decision.allow) {
    s.event({ type: "action", hero: id, quest, move: m.move, target: m.target, allowed: true });
    return;
  }
  // Above its rank (not forbidden): pause and ask the Guild Master. Forbidden actions are never asked about.
  // Desk jobs never ask, and nobody asks for more than one rank above their own.
  const oneUp = c && decision.need && tierFor(decision.need) <= c.tier + 1 && process.env.SAVEPOINT_DESK !== "1";
  if (c && decision.need && !oneUp) {
    s.event({ type: "action", hero: id, quest, move: m.move, target: m.target, allowed: false, reason: decision.reason });
    console.log(denyOutput(cli, `${decision.reason} ${process.env.SAVEPOINT_DESK === "1" ? "This is a read-only job." : "That is more than one rank above yours, so it can't be asked for yet."} Describe what you would do instead.`));
    return;
  }
  if (c && decision.need) {
    const book = new AskBook(s.chronicleDir);
    const ask = book.create({ hero: id, quest, tool, move: m.move, target: m.target, need: decision.need, reason: decision.reason });
    s.event({ type: "ask", ask: ask.id, hero: id, quest, move: m.move, target: m.target, need: decision.need, needWords: NEED_WORDS[decision.need] });
    const timeoutMs = (s.load().settings?.askTimeoutSec ?? 300) * 1000;
    const answer = await book.wait(ask.id, timeoutMs);
    s.event({ type: "answer", ask: ask.id, hero: id, decision: answer.decision, to: answer.to, expired: answer.status === "expired" });
    if (answer.decision === "allow") { console.log(allowOutput(cli, "Logged; it doesn't change anyone's trust.")); return; }
    const why = answer.status === "expired" ? "The Guild Master didn't answer in time, so the answer is no."
      : answer.decision === "handoff" ? `The Guild Master handed this to ${answer.to}. Write down what you'd do in your notes for them, then finish your part.`
      : "The Guild Master said no.";
    console.log(denyOutput(cli, `${decision.reason} ${why} Describe the change you wanted in your reply instead.`));
    return;
  }
  s.event({ type: "action", hero: id, quest, move: m.move, target: m.target, allowed: false, reason: decision.reason });
  s.recordViolation(id, tool, decision.reason);
  console.log(denyOutput(cli, decision.reason));
}

/** When a hero tries to stop (Claude Code / Codex Stop, Gemini AfterAgent): no proof, no victory. */
async function stopGateCmd(): Promise<void> {
  const cli = hookCli();
  const id = process.env.SAVEPOINT_CHARACTER, home = process.env.SAVEPOINT_HOME, questId = process.env.SAVEPOINT_QUEST;
  const raw = await readStdin();
  if (!id || !home || !questId || process.env.SAVEPOINT_DESK === "1") { console.log("{}"); return; }
  const w = new Store(dirname(home)).load();
  const quest = w.enemies.find((e) => e.id === questId);
  const hero = w.party.find((c) => c.id === id);
  // Only send back a hero who can write, or can at least ask to: pushing anyone else just wastes turns.
  if (!quest || !hero || hero.tier + 1 < tierFor("write")) { console.log("{}"); return; }
  const event = JSON.parse(raw || "{}") as { cwd?: string };
  const r = await stopGate({ home, quest, characterId: id, cwd: event.cwd ?? process.cwd() });
  console.log(r.keepGoing ? keepGoingOutput(cli, r.reason) : "{}");
}

/** Compact HUD: the acting character if known, otherwise the party. */
function statusline(): void {
  if (!store.exists()) return;
  const w = store.load();
  const who = process.env.SAVEPOINT_CHARACTER;
  const list = who ? w.party.filter((c) => c.id === who) : w.party;
  const hud = list.map((c) => {
    const mp = c.mp ? ` MP${c.mp.current}/${c.mp.max}` : "";
    return `${c.name} Lv${c.level} ${title(c)} REL${reliability(recordFor(c)).toFixed(2)}${mp}`;
  });
  const foes = w.enemies.filter((e) => e.status !== "defeated").length;
  console.log(`💾 ${hud.join(" │ ")} │ 💰${(w.treasury.gold - w.treasury.spent).toFixed(2)}G │ 👾${foes}`);
}

/** The browser game. With --demo, a simulated party fights a few quests in a scratch project so there is something to watch. */
async function play(): Promise<void> {
  let dir = cwd;
  if (values.demo) {
    dir = mkdtempSync(join(tmpdir(), "savepoint-play-"));
    // A tiny git project, so the demo battles run in their own copies like real ones.
    const { execFileSync } = await import("node:child_process");
    try {
      const g = (...a: string[]) => execFileSync("git", ["-c", "user.name=Savepoint", "-c", "user.email=savepoint@localhost", ...a], { cwd: dir, stdio: "ignore" });
      g("init", "-q"); writeFileSync(join(dir, "README.md"), "# Demo project\n"); g("add", "-A"); g("commit", "-q", "-m", "Demo project");
    } catch { /* no git: the demo runs in place */ }
    const s = new Store(dir);
    s.init();
    const w = s.load();
    w.treasury.gold = 20;
    w.party.push(
      newCharacter("Aria", "mock", "fighter", { tier: 1, adapterConfig: { skill: "0.95", seed: "play", pace: "700" }, look: { race: "human", build: "feminine" },
        mp: { max: 100, current: 64, refillHours: 5, lastRefill: new Date().toISOString() } }),
      newCharacter("Rook", "mock", "thief", { tier: 1, adapterConfig: { skill: "0.8", seed: "play", pace: "700" }, look: { race: "beastkin", build: "masculine" },
        mp: { max: 60, current: 60, refillHours: 5, lastRefill: new Date().toISOString() } }),
      newCharacter("Mira", "mock", "mage", { tier: 1, adapterConfig: { skill: "0.9", seed: "play", pace: "700" }, look: { race: "elf", build: "feminine" } }),
      newCharacter("Cass", "mock", "cleric", { tier: 1, adapterConfig: { skill: "0.9", seed: "play", pace: "700" }, look: { race: "fae", build: "feminine" } }),
    );
    // A few quests waiting on the board, so there is something to do straight away.
    const demoQuests: Array<[string, string, Enemy["kind"], QuestType]> = [
      ["q1", "Login page crashes on empty email", "goblin", "fix"],
      ["q2", "Checkout fails for some users", "lich", "fix"],
      ["q3", "Update the setup guide", "mimic", "write"],
    ];
    for (const [id, name, kind, questType] of demoQuests) {
      w.enemies.push({ id, name, kind, questType, level: 2, description: name, request: name, status: "lurking", budget: { gold: 1, maxTurns: 6 }, approved: true,
        criteria: [{ id: "works", description: "It works", proof: "judge", met: false }, { id: "tests", description: "Tests cover it", proof: "judge", met: false },
          { id: "looks", description: "It looks right to you", proof: "human", met: false }] });
    }
    s.save(w);
  } else if (!store.exists()) throw new Error("No world here. Run `savepoint init` first, or try `savepoint play --demo`.");
  const { startPlay } = await import("./play.ts");
  const server = await startPlay(dir, Number(values.port ?? 4747));
  console.log(box("FANTASY CODE RPG", ["Open this link in your browser (it only works on this computer):", server.url,
    "Ctrl+C to quit", ...(values.demo ? [`Practice guild folder: ${dir}`] : [])]));
}

/** A self-contained simulated campaign, so anyone can see the mechanics in 5 seconds. */
async function demo(n: number): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "savepoint-demo-"));
  const s = new Store(dir);
  s.init();
  const world: World = s.load();
  world.treasury.gold = 100;
  world.party.push(
    newCharacter("Aria", "mock", "fighter", { adapterConfig: { skill: "0.92", seed: "demo" } }),
    newCharacter("Bram", "mock", "fighter", { adapterConfig: { skill: "0.55", seed: "demo" } }),
    newCharacter("Cass", "mock", "cleric", { adapterConfig: { skill: "0.85", seed: "demo" } }),
  );
  s.addLore("Tests live in test/. Run them with npm test.");
  const kinds: EnemyKind[] = ["slime", "goblin", "orc", "golem", "goblin", "wyvern", "lich", "mimic"];
  console.log(box("SAVEPOINT DEMO", [
    "Two mock fighters: Aria (reliable) and Bram (sloppy).",
    "Cass the Cleric judges. Watch who earns promotions.",
  ]));
  for (let i = 0; i < n; i++) {
    const kind = kinds[i % kinds.length];
    const level = 1 + Math.floor(i / 3);
    const e: Enemy = {
      id: `q${i + 1}`, name: `${kind[0].toUpperCase()}${kind.slice(1)} #${i + 1}`, kind, level,
      description: `Quest ${i + 1}`, status: "lurking",
      criteria: Array.from({ length: 2 + (i % 3) }, (_, k) => ({ id: `c${k + 1}`, description: `criterion ${k + 1}`, met: false })),
      budget: { gold: 0.5, maxTurns: 10 },
    };
    world.enemies.push(e);
    const hero = i % 2 === 0 ? "aria" : "bram";
    const r = await battle({ world, store: s, enemyId: e.id, partyIds: [hero], judge: { kind: "character", id: "cass" }, cwd: dir,
      onEvent: (l) => { if (/promoted|cursed|reached Lv|⚠️/.test(l)) console.log(`[${e.id}] ${l.trim()}`); } });
    if (r.verdict.outcome === "critical") console.log(`[${e.id}] ✖ critical: ${r.verdict.notes.split(".")[0]}`);
  }
  s.save(world);
  console.log("\n" + partyScreen(world));
  console.log(`\nWorld saved in ${dir}/.savepoint — open chronicle/ to see the shared context.`);
}

main().catch((e: unknown) => { console.error(`✖ ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
