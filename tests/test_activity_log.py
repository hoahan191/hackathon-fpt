from datetime import datetime

import pytest

from activity_log import ActivityLog


def test_req_001_record_entry_available_to_subsequent_queries():
    log = ActivityLog()
    ts = datetime(2026, 9, 7, 9, 15, 0)

    log.record("alice", "logged_in", {"role": "admin"}, timestamp=ts)

    entries = log.query_by_actor("alice")
    assert len(entries) == 1
    assert entries[0]["actor"] == "alice"
    assert entries[0]["action"] == "logged_in"
    assert entries[0]["metadata"] == {"role": "admin"}


def test_req_002_reject_invalid_entries():
    log = ActivityLog()

    with pytest.raises(ValueError):
        log.record("", "logged_in")

    with pytest.raises(ValueError):
        log.record("alice", "")

    with pytest.raises(ValueError):
        log.record(None, "logged_in")

    assert log.query_by_actor("alice") == []


def test_req_003_same_timestamp_is_ordered_newest_first_and_stable():
    log = ActivityLog()
    ts = datetime(2026, 9, 7, 9, 15, 0)

    log.record("alice", "first_action", timestamp=ts)
    log.record("alice", "second_action", timestamp=ts)

    actions = [entry["action"] for entry in log.query_by_actor("alice")]
    assert actions == ["second_action", "first_action"]
    assert log.query_by_actor("alice") == log.query_by_actor("alice")


def test_req_004_sensitive_metadata_is_redacted():
    log = ActivityLog()
    ts = datetime(2026, 9, 7, 9, 15, 0)

    log.record(
        "bob",
        "updated_profile",
        {"note": "internal", "password": "s3cr3t", "token": "abc123"},
        timestamp=ts,
    )

    entry = log.query_by_actor("bob")[0]
    assert entry["metadata"]["note"] == "internal"
    assert entry["metadata"]["password"] == "[REDACTED]"
    assert entry["metadata"]["token"] == "[REDACTED]"


def test_req_005_time_range_includes_start_and_end_boundaries():
    log = ActivityLog()
    start = datetime(2026, 9, 7, 9, 0, 0)
    mid = datetime(2026, 9, 7, 9, 30, 0)
    end = datetime(2026, 9, 7, 10, 0, 0)

    log.record("alice", "before", timestamp=start)
    log.record("alice", "inside", timestamp=mid)
    log.record("alice", "after", timestamp=end)
    log.record("alice", "outside", timestamp=datetime(2026, 9, 7, 10, 1, 0))

    entries = log.query_by_time_range(start, end)
    actions = [entry["action"] for entry in entries]
    assert actions == ["before", "inside", "after"]


def test_req_006_no_matches_returns_empty_result():
    log = ActivityLog()
    log.record("alice", "login", timestamp=datetime(2026, 9, 7, 9, 10, 0))

    assert log.query_by_actor("ghost") == []
    assert log.query_by_time_range(datetime(2026, 9, 8), datetime(2026, 9, 9)) == []


def test_req_007_clock_is_injected_and_used_for_recording():
    fixed_now = datetime(2026, 9, 7, 12, 0, 0)
    log = ActivityLog(now_provider=lambda: fixed_now)

    log.record("carol", "started")

    entries = log.query_by_actor("carol")
    assert entries[0]["timestamp"] == fixed_now
