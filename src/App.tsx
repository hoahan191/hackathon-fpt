import { useMemo, useState } from "react";
import { createElection } from "./app/election";
import { explain } from "./explain/explain";
import { createActivityLog } from "./log/activityLog";
import type {
  ActivityEntry,
  ExplainResponse,
  Restaurant,
  TallyResult,
} from "./types";
import { ActivityFeed } from "./ui/ActivityFeed";
import { RankingBoard } from "./ui/RankingBoard";
import { ResultCard } from "./ui/ResultCard";

const CANDIDATES: Restaurant[] = [
  { id: "pho-thin", name: "Phở Thìn", cuisine: "Vietnamese", priceLevel: 1 },
  {
    id: "bun-cha-huong",
    name: "Bún Chả Hương Liên",
    cuisine: "Vietnamese",
    priceLevel: 1,
  },
  { id: "pizza-4ps", name: "Pizza 4P's", cuisine: "Italian", priceLevel: 3 },
  {
    id: "com-tam-ba-ghien",
    name: "Cơm Tấm Ba Ghiền",
    cuisine: "Vietnamese",
    priceLevel: 2,
  },
  {
    id: "sushi-hokkaido",
    name: "Sushi Hokkaido Sachi",
    cuisine: "Japanese",
    priceLevel: 3,
  },
];

const RANGE = { start: 0, end: Number.MAX_SAFE_INTEGER };

export function App() {
  // REQ-007: the clock is injected here, at the edge. Nothing below reads it.
  const { log, election } = useMemo(() => {
    const created = createActivityLog({ clock: () => Date.now() });
    return {
      log: created,
      election: createElection({ candidates: CANDIDATES, log: created }),
    };
  }, []);

  const [voterId, setVoterId] = useState("");
  const [ranking, setRanking] = useState<string[]>([]);
  const [voteCount, setVoteCount] = useState(0);
  const [result, setResult] = useState<TallyResult | null>(null);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [error, setError] = useState("");

  function refreshFeed() {
    setEntries(log.queryByTimeRange(RANGE.start, RANGE.end));
  }

  function toggle(id: string) {
    setRanking((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function submitBallot() {
    try {
      election.castBallot({ voterId: voterId.trim(), rankings: ranking });
      setVoteCount((n) => n + 1);
      setVoterId("");
      setRanking([]);
      setError("");
      refreshFeed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function runTally() {
    try {
      const tallied = election.tally();
      setResult(tallied);
      setError("");
      refreshFeed();
      setExplanation(await explain(tallied, CANDIDATES));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <main>
      <h1>Where are we eating?</h1>
      <p className="muted">
        Everyone ranks the options. Borda count picks the winner, and the app
        says why.
      </p>

      <section>
        <h2>Your ballot</h2>
        <RankingBoard
          candidates={CANDIDATES}
          ranking={ranking}
          onToggle={toggle}
        />
        <div className="row" style={{ marginTop: "1rem" }}>
          <input
            value={voterId}
            onChange={(e) => setVoterId(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
          />
          <button
            type="button"
            onClick={submitBallot}
            disabled={voterId.trim() === "" || ranking.length === 0}
          >
            Submit ballot
          </button>
          <span className="muted">{voteCount} submitted</span>
          <button type="button" onClick={runTally} disabled={voteCount === 0}>
            Decide
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      {result && (
        <ResultCard
          result={result}
          explanation={explanation}
          candidates={CANDIDATES}
        />
      )}

      <section>
        <h2>Activity log</h2>
        <ActivityFeed entries={entries} />
      </section>
    </main>
  );
}
