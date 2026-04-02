import { useState, useRef, useEffect } from "react";
import type { DraftProspect, RosterDeficit, RosterPlayer } from "../types/simulator";
import type { SmartRecommendation } from "../data/prospectRanking";
import { rankProspectsForTeam } from "../data/prospectRanking";
import type { TeamStrength } from "../data/prospectRanking";

interface Message {
  role: "scout" | "user";
  text: string;
}

interface Props {
  recommendation: SmartRecommendation | null;
  available: DraftProspect[];
  deficits: RosterDeficit[];
  teamStrength: TeamStrength;
  roster: RosterPlayer[];
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "");
}

function buildResponse(
  input: string,
  available: DraftProspect[],
  deficits: RosterDeficit[],
  teamStrength: TeamStrength,
  roster: RosterPlayer[],
  recommendation: SmartRecommendation | null
): string {
  const q = normalize(input);
  const ranked = rankProspectsForTeam(available, deficits, teamStrength);

  // --- Who should I pick / best pick ---
  if (/\b(who|best|recommend|pick|suggest|top)\b/.test(q) && !/compare/.test(q)) {
    if (!recommendation) return "No prospects left on the board.";
    const p = recommendation.prospect;
    return `My top recommendation is **${p.name}** (${p.position}, ${p.school}). ` +
      `Ceiling score: ${p.valueScore}/100 · Needs score: ${p.needsScore}/100. ` +
      recommendation.explanation;
  }

  // --- What are my needs / deficits ---
  if (/\b(need|deficit|missing|hole|gap|weakness)\b/.test(q)) {
    if (deficits.length === 0) return "Your roster has no formula deficits. You're well-balanced.";
    const top3 = deficits.slice(0, 3);
    return `Your top roster gaps are:\n` +
      top3.map((d, i) =>
        `${i + 1}. ${d.offensiveArchetype} / ${d.defensiveRole} (${(d.weight * 100).toFixed(0)}% weight)`
      ).join("\n");
  }

  // --- Tell me about / info on a specific player ---
  const aboutMatch = q.match(/(?:about|tell me about|info on|who is|show me)\s+(.+)/);
  if (aboutMatch) {
    const namePart = aboutMatch[1].trim();
    const found = available.find((p) =>
      normalize(p.name).includes(namePart) || namePart.includes(normalize(p.name).split(" ")[0])
    );
    if (found) {
      const r = ranked.find((p) => p.id === found.id);
      return `**${found.name}** — ${found.position} out of ${found.school}.\n` +
        `Archetype: ${found.offensiveArchetype} / ${found.defensiveRole}.\n` +
        `Ceiling: ${r?.valueScore ?? "—"}/100 · Fit: ${r?.fitScore ?? "—"}/100 · Needs score: ${r?.needsScore ?? "—"}/100.\n` +
        (found.notes ? `Scout note: ${found.notes}` : "No additional scout notes.");
    }
    return `Couldn't find "${aboutMatch[1]}" on the board. Check the spelling or they may have been drafted.`;
  }

  // --- Compare two players ---
  const compareMatch = q.match(/compare\s+(.+?)\s+(?:and|vs|versus|to)\s+(.+)/);
  if (compareMatch) {
    const [, nameA, nameB] = compareMatch;
    const findP = (n: string) => available.find((p) =>
      normalize(p.name).includes(n.trim()) || n.trim().includes(normalize(p.name).split(" ")[0])
    );
    const pA = findP(nameA);
    const pB = findP(nameB);
    if (!pA && !pB) return `Couldn't find either player. They may have been drafted.`;
    if (!pA) return `Couldn't find ${nameA} — they may have been drafted.`;
    if (!pB) return `Couldn't find ${nameB} — they may have been drafted.`;
    const rA = ranked.find((p) => p.id === pA.id);
    const rB = ranked.find((p) => p.id === pB.id);
    const better = (rA?.needsScore ?? 0) >= (rB?.needsScore ?? 0) ? pA : pB;
    return `**${pA.name}** vs **${pB.name}**:\n` +
      `${pA.name}: Ceiling ${rA?.valueScore ?? "—"} · Fit ${rA?.fitScore ?? "—"} · Needs ${rA?.needsScore ?? "—"}\n` +
      `${pB.name}: Ceiling ${rB?.valueScore ?? "—"} · Fit ${rB?.fitScore ?? "—"} · Needs ${rB?.needsScore ?? "—"}\n` +
      `→ For your roster, I'd lean **${better.name}**.`;
  }

  // --- Team strength ---
  if (/\b(contend|contender|rebuilding|rebuild|strength|tier|window)\b/.test(q)) {
    const ts = teamStrength;
    return `You're assessed as a **${ts.label}** (score: ${(ts.score * 100).toFixed(0)}/100). ` +
      (ts.label === "Contender"
        ? "The draft board is weighted toward formula fit — target pieces that complete the championship formula."
        : ts.label === "Rebuilding"
        ? "Maximize ceiling. Take the best prospect available — long-term value over short-term fit."
        : "You're in the mix. Balance ceiling and immediate fit to push into contention.");
  }

  // --- Top N on the board ---
  const topNMatch = q.match(/top\s+(\d+)/);
  if (topNMatch) {
    const n = Math.min(parseInt(topNMatch[1]), 10);
    const sorted = [...ranked].sort((a, b) => b.needsScore - a.needsScore).slice(0, n);
    return `Top ${n} by needs score for your team:\n` +
      sorted.map((p, i) =>
        `${i + 1}. ${p.name} (${p.position}) — Score: ${p.needsScore}`
      ).join("\n");
  }

  // --- What position should I target ---
  if (/\b(position|pos|guard|forward|center|pg|sg|sf|pf)\b/.test(q)) {
    const posCounts: Record<string, number> = {};
    for (const p of roster) {
      posCounts[p.position] = (posCounts[p.position] ?? 0) + 1;
    }
    const thin = (["PG","SG","SF","PF","C"] as const)
      .filter((p) => (posCounts[p] ?? 0) < 2)
      .map((p) => p);
    if (thin.length === 0) return "Your roster is balanced across all positions.";
    return `You're thin at: ${thin.join(", ")}. Consider targeting players at these spots.`;
  }

  // --- Fallback ---
  return `I can help with:\n• "Who should I pick?" — get my top recommendation\n• "What are my needs?" — roster gaps\n• "Tell me about [player]" — prospect breakdown\n• "Compare [A] and [B]" — side-by-side\n• "Top 5" — best fits for your team\n• "What's my team strength?" — contender assessment`;
}

export default function ScoutChat({
  recommendation,
  available,
  deficits,
  teamStrength,
  roster,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (!recommendation) return [{ role: "scout", text: "No prospects on the board yet." }];
    return [{
      role: "scout",
      text: recommendation.explanation,
    }];
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update initial message when recommendation changes
  useEffect(() => {
    if (!recommendation) return;
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "scout") {
        return [{ role: "scout", text: recommendation.explanation }];
      }
      return prev;
    });
  }, [recommendation?.prospect.id]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { role: "user", text };
    const reply = buildResponse(text, available, deficits, teamStrength, roster, recommendation);
    setMessages((prev) => [...prev, userMsg, { role: "scout", text: reply }]);
    setInput("");
  }

  const tsColor =
    teamStrength.label === "Contender"
      ? "var(--color-accent)"
      : teamStrength.label === "Middle"
      ? "var(--color-warning)"
      : "var(--color-danger)";

  return (
    <div style={{
      background: "var(--color-surface-raised)",
      border: "1px solid var(--color-border)",
      borderRadius: "12px",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      height: "420px",
    }}>
      {/* Header */}
      <div style={{
        padding: "0.75rem 1rem",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        background: "var(--color-surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--color-accent)",
            boxShadow: "0 0 6px var(--color-accent)",
          }} />
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-text-secondary)",
          }}>
            Scout AI
          </span>
        </div>
        <span style={{
          fontSize: "0.62rem",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: tsColor,
          border: `1px solid ${tsColor}50`,
          borderRadius: "4px",
          padding: "0.1rem 0.5rem",
        }}>
          {teamStrength.label}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "88%",
              padding: "0.55rem 0.8rem",
              borderRadius: msg.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
              background: msg.role === "user" ? "var(--color-accent-dim)" : "var(--color-surface)",
              border: `1px solid ${msg.role === "user" ? "var(--color-accent-dim)" : "var(--color-border)"}`,
              fontSize: "0.76rem",
              lineHeight: 1.6,
              color: msg.role === "user" ? "var(--color-accent)" : "var(--color-text-secondary)",
              whiteSpace: "pre-line",
            }}>
              {msg.text.replace(/\*\*(.+?)\*\*/g, "$1")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "0.625rem 0.75rem",
        borderTop: "1px solid var(--color-border)",
        display: "flex",
        gap: "0.5rem",
        flexShrink: 0,
        background: "var(--color-surface)",
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about a prospect, compare players…"
          style={{
            flex: 1,
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            color: "var(--color-text)",
            fontSize: "0.75rem",
            padding: "0.45rem 0.75rem",
            outline: "none",
            fontFamily: "var(--font-body)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--color-accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--color-border)")}
        />
        <button
          onClick={handleSend}
          style={{
            background: "var(--color-accent)",
            border: "none",
            borderRadius: "8px",
            color: "#06120a",
            fontFamily: "var(--font-display)",
            fontSize: "0.72rem",
            fontWeight: 700,
            padding: "0 0.875rem",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}
