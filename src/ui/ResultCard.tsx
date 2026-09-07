import type { ExplainResponse, Restaurant, TallyResult } from "../types";

interface Props {
  result: TallyResult;
  explanation: ExplainResponse | null;
  candidates: Restaurant[];
}

export function ResultCard({ result, explanation, candidates }: Props) {
  const ordered = [...candidates].sort(
    (a, b) => result.scores[b.id] - result.scores[a.id],
  );

  return (
    <section>
      <h2>Result</h2>
      <p className="winner">{result.winner.name}</p>
      <p>{explanation ? explanation.explanation : "Explaining…"}</p>
      <ul>
        {explanation?.highlights.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <h2>Scores</h2>
      <ol>
        {ordered.map((c) => (
          <li key={c.id}>
            {c.name} — {result.scores[c.id]}
          </li>
        ))}
      </ol>
    </section>
  );
}
