import type { ActivityEntry } from "../types";

interface Props {
  entries: ActivityEntry[];
}

export function ActivityFeed({ entries }: Props) {
  if (entries.length === 0) {
    return <p className="muted">Nothing recorded yet.</p>;
  }

  return (
    <ul className="feed">
      {entries.map((e) => (
        <li key={e.seq}>
          {new Date(e.timestamp).toLocaleTimeString()} · {e.actor} · {e.action}{" "}
          · {JSON.stringify(e.metadata)}
        </li>
      ))}
    </ul>
  );
}
