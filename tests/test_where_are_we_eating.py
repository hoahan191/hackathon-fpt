import pytest

from where_are_we_eating import RestaurantPicker


def test_pick_winner_uses_preference_scores():
    picker = RestaurantPicker()

    picker.add_ranking("Ava", ["Korean", "Vietnamese", "Italian"])
    picker.add_ranking("Ben", ["Vietnamese", "Korean", "Italian"])
    picker.add_ranking("Cao", ["Korean", "Italian", "Vietnamese"])

    result = picker.pick_winner()

    assert result["winner"] == "Korean"
    assert result["scores"]["Korean"] == 8
    assert result["scores"]["Vietnamese"] == 6
    assert result["scores"]["Italian"] == 4


def test_tie_breaks_alphabetically():
    picker = RestaurantPicker()

    picker.add_ranking("Ava", ["Korean", "Italian"])
    picker.add_ranking("Ben", ["Italian", "Korean"])

    result = picker.pick_winner()

    assert result["winner"] == "Italian"


def test_explain_winner_mentions_reason():
    picker = RestaurantPicker()

    picker.add_ranking("Ava", ["Banh Mi", "Pho", "Hotpot"])
    picker.add_ranking("Ben", ["Pho", "Banh Mi", "Hotpot"])

    explanation = picker.explain_winner()

    assert "Banh Mi" in explanation or "Pho" in explanation
    assert "winner" in explanation.lower()


def test_reject_duplicate_restaurants_in_one_ranking():
    picker = RestaurantPicker()

    with pytest.raises(ValueError):
        picker.add_ranking("Ava", ["Pho", "Pho", "Banh Mi"])


def test_pretty_summary_renders_judge_friendly_output():
    picker = RestaurantPicker()
    picker.add_ranking("Ava", ["Korean", "Vietnamese", "Italian"])
    picker.add_ranking("Ben", ["Vietnamese", "Korean", "Italian"])
    picker.add_ranking("Cao", ["Korean", "Italian", "Vietnamese"])

    summary = picker.render_summary()

    assert "GROUP RESTAURANT DECISION" in summary
    assert "Winner" in summary
    assert "Korean" in summary
    assert "Vietnamese" in summary
    assert "Italian" in summary
