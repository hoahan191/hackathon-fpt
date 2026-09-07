from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Iterable


class RestaurantPicker:
    def __init__(self):
        self._rankings: dict[str, list[str]] = {}

    def add_ranking(self, person: str, restaurants: list[str]) -> None:
        if not person or not person.strip():
            raise ValueError("person must be non-empty")

        normalized = []
        seen = set()
        for item in restaurants:
            item_name = str(item).strip()
            if not item_name:
                continue
            if item_name in seen:
                raise ValueError(f"duplicate restaurant in ranking: {item_name}")
            seen.add(item_name)
            normalized.append(item_name)

        if not normalized:
            raise ValueError("ranking must include at least one restaurant")

        self._rankings[person.strip()] = normalized

    def pick_winner(self) -> dict:
        scores = defaultdict(int)
        for ranking in self._rankings.values():
            for rank_position, restaurant in enumerate(ranking):
                scores[restaurant] += len(ranking) - rank_position

        if not scores:
            raise ValueError("no rankings available")

        winner = sorted(scores.items(), key=lambda pair: (-pair[1], pair[0]))[0][0]
        return {
            "winner": winner,
            "scores": dict(sorted(scores.items(), key=lambda item: (-item[1], item[0]))),
        }

    def explain_winner(self) -> str:
        result = self.pick_winner()
        winner = result["winner"]
        scores = result["scores"]
        return (
            f"Winner: {winner}. The final tally was {scores}, and {winner} had the strongest "
            f"combined preference score. That makes {winner} the best pick for the group."
        )

    def render_summary(self) -> str:
        result = self.pick_winner()
        winner = result["winner"]
        scores = result["scores"]

        lines = [
            "=" * 52,
            "GROUP RESTAURANT DECISION",
            "=" * 52,
            f"Winner: {winner}",
            "",
            "Scoreboard:",
        ]

        for restaurant, score in scores.items():
            lines.append(f"  - {restaurant:<15} {score} pts")

        lines.extend([
            "",
            f"Reason: {self.explain_winner()}",
            "=" * 52,
        ])
        return "\n".join(lines)


def parse_ranking_spec(raw_value: str) -> tuple[str, list[str]]:
    if not raw_value or not raw_value.strip():
        raise ValueError("ranking input cannot be empty")

    candidate = raw_value.strip()
    separator = ":" if ":" in candidate else "="
    if separator not in candidate:
        raise ValueError(
            "ranking must use the format 'Name: Restaurant A, Restaurant B, Restaurant C'"
        )

    person, restaurants_text = candidate.split(separator, 1)
    restaurants = [entry.strip() for entry in restaurants_text.split(",") if entry.strip()]
    if not restaurants:
        raise ValueError("ranking must include at least one restaurant")

    return person.strip(), restaurants


def load_rankings_from_file(path: str | Path) -> dict[str, list[str]]:
    file_path = Path(path)
    with file_path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if isinstance(data, dict):
        parsed: dict[str, list[str]] = {}
        for person, restaurants in data.items():
            parsed[str(person)] = [str(item).strip() for item in restaurants]
        return parsed

    if isinstance(data, list):
        parsed = {}
        for item in data:
            if not isinstance(item, dict) or "person" not in item or "restaurants" not in item:
                raise ValueError("JSON ranking entries must be objects with 'person' and 'restaurants'")
            parsed[str(item["person"])] = [str(entry).strip() for entry in item["restaurants"]]
        return parsed

    raise ValueError("ranking file must contain a JSON object or list of ranking objects")


def _format_scores(scores: dict[str, int]) -> str:
    return ", ".join(f"{restaurant}: {score}" for restaurant, score in scores.items())


def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Choose the best restaurant for the group using ranked preferences.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--ranking",
        action="append",
        default=[],
        help="Add one ranking in the format 'Name: Restaurant A, Restaurant B, Restaurant C'.",
    )
    parser.add_argument(
        "--file",
        type=str,
        help="Load rankings from a JSON file containing a mapping of person to restaurants.",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Interactively enter rankings one line at a time.",
    )
    return parser


def run_cli(argv: Iterable[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(list(argv) if argv is not None else None)

    picker = RestaurantPicker()

    if args.file:
        for person, restaurants in load_rankings_from_file(args.file).items():
            picker.add_ranking(person, restaurants)

    if args.ranking:
        for entry in args.ranking:
            person, restaurants = parse_ranking_spec(entry)
            picker.add_ranking(person, restaurants)

    if args.interactive:
        print("🍽️  Welcome to Where Are We Eating?")
        print("Enter each person's ranking as: Name: Restaurant A, Restaurant B, Restaurant C")
        print("Press Enter on a blank line when you're done.\n")
        while True:
            raw = input("Ranking: ").strip()
            if not raw:
                break
            person, restaurants = parse_ranking_spec(raw)
            picker.add_ranking(person, restaurants)

    if not picker._rankings:
        parser.error("No rankings provided. Use --ranking, --file, or --interactive.")

    result = picker.pick_winner()
    print("\n" + picker.render_summary())
    return 0


def main() -> int:
    return run_cli()


if __name__ == "__main__":
    raise SystemExit(main())
