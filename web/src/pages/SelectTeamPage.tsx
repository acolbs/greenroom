import { useEffect, useState } from "react";
import { useSmoothNavigate } from "../hooks/useSmoothNavigate";
import { TEAMS } from "../data/constants";
import { useSimulatorStore, type TeamStageSummary } from "../store/simulatorStore";
import type { Team, TeamStrengthLabel } from "../types/simulator";
import AppHeader from "../components/AppHeader";
import TeamLogo from "../components/TeamLogo";

type Grouping = "stage" | "conference";

const STAGE_GROUPS: { label: TeamStrengthLabel; title: string }[] = [
  { label: "Contender", title: "Contenders" },
  { label: "Middle", title: "In the middle" },
  { label: "Rebuilding", title: "Rebuilding" },
];

function TeamCard({
  team,
  stage,
  disabled,
  onSelect,
}: {
  team: Team;
  stage?: TeamStageSummary;
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button type="button" className="team-card" disabled={disabled} onClick={() => onSelect(team.id)}>
      <TeamLogo teamId={team.id} size={36} />
      <div style={{ minWidth: 0 }}>
        <div className="team-card__city">{team.city}</div>
        <div className="team-card__name">{team.name}</div>
      </div>
      {stage && (
        <div>
          <div className="team-card__score">{stage.score}</div>
          <div className={`team-card__stage stage--${stage.label}`}>{stage.label}</div>
        </div>
      )}
    </button>
  );
}

export default function SelectTeamPage() {
  const navigate = useSmoothNavigate();
  const selectTeam = useSimulatorStore((s) => s.selectTeam);
  const loadTeamStages = useSimulatorStore((s) => s.loadTeamStages);
  const loading = useSimulatorStore((s) => s.loading);
  const error = useSimulatorStore((s) => s.error);

  const [stages, setStages] = useState<Record<string, TeamStageSummary> | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [grouping, setGrouping] = useState<Grouping>("stage");

  useEffect(() => {
    let live = true;
    loadTeamStages()
      .then((s) => live && setStages(s))
      .catch((e) => live && setStageError(e instanceof Error ? e.message : "Couldn't load team data."));
    return () => {
      live = false;
    };
  }, [loadTeamStages]);

  async function handleSelect(teamId: string) {
    await selectTeam(teamId);
    if (useSimulatorStore.getState().error) return;
    navigate("/analysis");
  }

  const groups =
    grouping === "stage" && stages
      ? STAGE_GROUPS.map((g) => ({
          title: g.title,
          teams: TEAMS.filter((t) => stages[t.id]?.label === g.label).sort(
            (a, b) => stages[b.id].score - stages[a.id].score
          ),
        }))
      : [
          { title: "Eastern Conference", teams: TEAMS.filter((t) => t.conference === "East") },
          { title: "Western Conference", teams: TEAMS.filter((t) => t.conference === "West") },
        ];

  return (
    <div className="page">
      <AppHeader />
      <main className="wrap">
        <div className="page-head">
          <div>
            <div className="eyebrow">Step 1</div>
            <h1 className="display h1" style={{ marginTop: "0.5rem" }}>Choose a team</h1>
            <p className="lede">
              Every team is scored 0–100 from its 2025-26 roster and record. The score sets the
              stage, and the stage sets how you should draft.
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Group teams">
            <button type="button" aria-pressed={grouping === "stage"} onClick={() => setGrouping("stage")} disabled={!stages}>
              By stage
            </button>
            <button type="button" aria-pressed={grouping === "conference"} onClick={() => setGrouping("conference")}>
              By conference
            </button>
          </div>
        </div>

        {(error || stageError) && <div className="error-msg" style={{ marginBottom: "1.25rem" }}>{error ?? stageError}</div>}

        {loading || (!stages && !stageError) ? (
          <div className="center-pad">
            <div className="spinner" />
            <span>{loading ? "Building the scouting report…" : "Scoring all 30 teams…"}</span>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.title} style={{ marginBottom: "2.25rem" }}>
              <div className="section-head">
                <h2 className="eyebrow">
                  {g.title} <span className="num">· {g.teams.length}</span>
                </h2>
              </div>
              <div className="team-grid">
                {g.teams.map((team) => (
                  <TeamCard key={team.id} team={team} stage={stages?.[team.id]} disabled={loading} onSelect={handleSelect} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
