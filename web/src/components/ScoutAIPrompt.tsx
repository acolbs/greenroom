import React, { useMemo, useState } from "react";
import type { Archetype, DraftProspect, ExpiringContract } from "../types/simulator";
import { useSimulatorStore } from "../store/simulatorStore";

type Props = {
  phase: "free-agency" | "draft";
};

const clampText = (s: string, max = 240) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

const pickTopArchetypes = (needs: Partial<Record<Archetype, number>>, n: number) => {
  return Object.entries(needs)
    .map(([k, v]) => ({ archetype: k as Archetype, value: v ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .filter((x) => x.value > 0)
    .slice(0, n);
};

const responseForFreeAgency = (payload: {
  needs: Partial<Record<Archetype, number>>;
  expiringContracts: ExpiringContract[];
  decisions: Record<string, "RE_SIGN" | "LET_WALK" | undefined>;
}) => {
  const { needs, expiringContracts, decisions } = payload;
  const decidedCount = expiringContracts.filter((c) => decisions[c.playerId]).length;
  const remaining = expiringContracts.filter((c) => !decisions[c.playerId]).length;

  const topNeeds = pickTopArchetypes(needs, 2);
  const topNeedText =
    topNeeds.length > 0 ? topNeeds.map((t) => t.archetype.replace(" ", " ")).join(" and ") : null;

  if (remaining > 0) {
    const undecided = expiringContracts.filter((c) => !decisions[c.playerId]);
    const best = undecided
      .map((c) => ({ c, gapIfLetWalk: (needs[c.archetype] ?? 0) + 1 }))
      .sort((a, b) => b.gapIfLetWalk - a.gapIfLetWalk)[0]?.c;

    return clampText(
      `You're ${decidedCount}/${expiringContracts.length} decisions in. Scout's take: ${
        best
          ? `If you let ${best.name} walk, you most strongly protect your ${best.archetype} gap upside.`
          : "Keep closing decisions; the remaining gaps will drive your draft targets."
      }${topNeedText ? ` Current biggest gaps: ${topNeedText}.` : ""}`,
      320
    );
  }

  return clampText(
    `All free agency decisions are set. Scout recommends you draft toward the biggest remaining gaps, not just overall grade.`,
    320
  );
};

const draftProspectArchetypeLabel = (p: DraftProspect) => {
  const off = p.csvOffensiveArchetype.trim();
  const def = p.csvDefensiveRole.trim();
  if (off || def) return `${off || "—"} / ${def || "—"}`;
  return p.projectedArchetype;
};

const responseForDraft = (payload: { topPicks: DraftProspect[] }) => {
  const { topPicks } = payload;
  const names = topPicks.map((p) => `${p.name} (${draftProspectArchetypeLabel(p)})`).join(", ");
  if (!topPicks.length) return "Your draft board is ready. Scout is calculating roster fit…";
  return clampText(`Scout recommended top 3: ${names}. Drafting these aligns best with your post-free-agency archetype gaps.`, 280);
};

export default function ScoutAIPrompt({ phase }: Props) {
  const selectedTeamId = useSimulatorStore((s) => s.selectedTeamId);
  const needs = useSimulatorStore((s) => s.getTeamNeedsGaps());
  const expiringContracts = useSimulatorStore((s) => s.expiringContracts);
  const decisions = useSimulatorStore((s) => s.decisions);
  const topPicks = useSimulatorStore((s) => s.getScoutTopPicks());

  const defaultAdvice = useMemo(() => {
    if (phase === "free-agency") {
      return responseForFreeAgency({ needs, expiringContracts, decisions });
    }
    return responseForDraft({ topPicks });
  }, [decisions, expiringContracts, needs, phase, topPicks]);

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Array<{ role: "user" | "scout"; text: string }>>([]);

  const send = () => {
    const q = question.trim();
    if (!q) return;
    setHistory((h) => [...h, { role: "user", text: q }]);

    let answer = defaultAdvice;
    if (phase === "free-agency") {
      if (q.toLowerCase().includes("walk")) {
        const undecided = expiringContracts.filter((c) => !decisions[c.playerId]);
        const best = undecided
          .map((c) => ({ c, gapIfLetWalk: (needs[c.archetype] ?? 0) + 1 }))
          .sort((a, b) => b.gapIfLetWalk - a.gapIfLetWalk)[0];
        if (best)
          answer = `If you're considering letting someone walk, Scout's top candidate is ${best.c.name}. That decision most improves your ability to fill the ${best.c.archetype} gap created by free agency.`;
      } else if (q.toLowerCase().includes("re-sign") || q.toLowerCase().includes("resign")) {
        answer = "Re-signing is usually optimal when the archetype is already covered and you're trying to avoid gap volatility.";
      }
    } else {
      if (q.toLowerCase().includes("top") || q.toLowerCase().includes("recommend")) {
        answer = responseForDraft({ topPicks });
      } else if (q.toLowerCase().includes("why")) {
        answer = "Fit board prioritizes archetype gaps first, then overall/grade as tie-breakers.";
      }
    }

    setHistory((h) => [...h, { role: "scout", text: answer }]);
    setQuestion("");
  };

  return (
    <div className="card card-sticky">
      <div className="row" style={{ justifyContent: "space-between", width: "100%" }}>
        <div>
          <div style={{ fontWeight: 650, letterSpacing: "-0.02em" }}>Scout</div>
          <div className="muted" style={{ fontSize: "0.75rem", marginTop: "0.2rem" }}>
            Assistant · {phase === "free-agency" ? "Free agency" : "Draft"}
            {selectedTeamId ? ` · ${selectedTeamId}` : ""}
          </div>
        </div>
        <span className="pill pill-accent">Demo</span>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.35rem" }}>
          Briefing
        </div>
        <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.55 }}>{defaultAdvice}</p>
      </div>

      <div style={{ marginTop: "1.25rem" }}>
        <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Ask Scout
        </div>
        <div className="row" style={{ gap: "0.5rem", width: "100%" }}>
          <input
            className="input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='e.g. "Who should I let walk?"'
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="btn btn-primary" onClick={send} type="button">
            Send
          </button>
        </div>
      </div>

      {history.length > 0 ? (
        <div style={{ marginTop: "1.25rem" }}>
          <div className="muted" style={{ fontSize: "0.6875rem", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Thread
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {history.slice(-6).map((m, idx) => (
              <div key={idx} className="card card-nested" style={{ padding: "0.75rem 0.85rem" }}>
                <div style={{ fontSize: "0.6875rem", fontWeight: 650, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  {m.role === "user" ? "You" : "Scout"}
                </div>
                <div style={{ fontSize: "0.875rem", lineHeight: 1.45 }}>{m.text}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
