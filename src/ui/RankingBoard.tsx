import type { Restaurant } from "../types";

interface Props {
  candidates: Restaurant[];
  ranking: string[];
  onToggle: (id: string) => void;
}

/** Click a restaurant to append it to your ranking; click again to remove it. */
export function RankingBoard({ candidates, ranking, onToggle }: Props) {
  return (
    <ul className="candidates">
      {candidates.map((c) => {
        const position = ranking.indexOf(c.id);
        return (
          <li key={c.id}>
            <span className="rank">{position >= 0 ? position + 1 : "–"}</span>
            <button type="button" onClick={() => onToggle(c.id)}>
              {position >= 0 ? "Remove" : "Rank"}
            </button>
            <span>{c.name}</span>
            <span className="meta">
              {c.cuisine}
              {c.priceLevel ? ` · ${"₫".repeat(c.priceLevel)}` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
