import type {
  ExplainResponse,
  LlmClient,
  Restaurant,
  TallyResult,
} from "../types";
import { buildExplanationPrompt } from "./prompt";

/** REQ-108: the four bands are read off consensusMargin alone. */
function deterministicText(result: TallyResult): string {
  const name = result.winner.name;
  const margin = result.consensusMargin;

  if (margin === 1) {
    return `${name} won unanimously — every voter put it first.`;
  }
  if (margin >= 0.25) {
    return `${name} won clearly, well ahead of the runner-up.`;
  }
  if (margin > 0) {
    return `${name} won by a narrow edge over the runner-up.`;
  }
  return `${name} won only on the tie-break — the top scores were level.`;
}

/** REQ-108: model text is only phrasing — it must name the winner and no rival. */
function agreesWithTally(
  text: string,
  result: TallyResult,
  candidates: Restaurant[],
): boolean {
  if (text.trim() === "") {
    return false;
  }
  const lower = text.toLowerCase();
  if (!lower.includes(result.winner.name.toLowerCase())) {
    return false;
  }
  return !candidates.some(
    (c) => c.id !== result.winner.id && lower.includes(c.name.toLowerCase()),
  );
}

function buildHighlights(result: TallyResult): string[] {
  return [
    `Winner: ${result.winner.name}`,
    `Scores: ${Object.entries(result.scores)
      .map(([id, score]) => `${id} ${score}`)
      .join(", ")}`,
    `Consensus margin: ${result.consensusMargin}`,
  ];
}

/** REQ-108/REQ-110: deterministic text always; the model is polish, never a dependency. */
export async function explain(
  result: TallyResult,
  candidates: Restaurant[],
  client?: LlmClient,
): Promise<ExplainResponse> {
  // REQ-110: winnerId comes from the tally, never from the model.
  const response: ExplainResponse = {
    winnerId: result.winner.id,
    explanation: deterministicText(result),
    highlights: buildHighlights(result),
  };

  if (!client) {
    return response;
  }

  try {
    const text = await client.complete(
      buildExplanationPrompt(result, candidates),
    );
    if (!agreesWithTally(text, result, candidates)) {
      return response;
    }
    return { ...response, explanation: text };
  } catch {
    // REQ-110: an unreachable model degrades to the deterministic text.
    return response;
  }
}
