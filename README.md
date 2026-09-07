# Where Are We Eating?

A polished Python CLI for helping a group choose a restaurant by combining everyone’s ranked preferences. It turns multiple personal rankings into one fair, explainable winner.

## Why this app

Group dinner decisions are often noisy, subjective, and slow. This app reduces that friction by:

- collecting one ranking per person
- giving more weight to higher-preference choices
- resolving ties alphabetically
- rejecting duplicate restaurants in the same ranking
- explaining the final result in plain language

## How it works

Each person submits a list of restaurants in order of preference. A weighted score is computed so that a higher-ranked restaurant contributes more than a lower-ranked one. The winner is the restaurant with the strongest total score.

Example:

```python
from where_are_we_eating import RestaurantPicker

picker = RestaurantPicker()
picker.add_ranking("Ava", ["Korean", "Vietnamese", "Italian"])
picker.add_ranking("Ben", ["Vietnamese", "Korean", "Italian"])
picker.add_ranking("Cao", ["Korean", "Italian", "Vietnamese"])

print(picker.pick_winner())
print(picker.render_summary())
```

## CLI usage

```bash
python where_are_we_eating.py --interactive
```

```bash
python where_are_we_eating.py \
  --ranking "Ava: Korean, Vietnamese, Italian" \
  --ranking "Ben: Vietnamese, Korean, Italian" \
  --ranking "Cao: Korean, Italian, Vietnamese"
```

You can also load rankings from a JSON file:

```bash
python where_are_we_eating.py --file rankings.json
```

## AI-assisted workflow

This project used AI as a coding accelerator, not as a substitute for engineering judgment:

- GitHub Copilot helped draft the ranking logic and CLI polish
- AI assisted with test scenarios, especially duplicate checks and tie handling
- final correctness was enforced through pytest and explicit validation rules

The result is transparent and explainable rather than opaque or magical.

## Project files

- [where_are_we_eating.py](where_are_we_eating.py) — core logic and CLI entry point
- [tests/test_where_are_we_eating.py](tests/test_where_are_we_eating.py) — behavior tests
- [ARCHITECTURE.md](ARCHITECTURE.md) — quick architecture overview
- [JUDGE_TALK.md](JUDGE_TALK.md) — 30-second judge script

## Verification

```bash
cd /Users/hoahan/Desktop/GenAI Trainer/Github_Copilot_hackathon/hackathon-fpt
python -m pytest -q
```

Current result: 12 passed in 0.01s.
