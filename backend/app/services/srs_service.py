"""
SM-2 Spaced Repetition Service.
Pure functions — no DB dependency.
"""
from datetime import date, timedelta

MIN_EASE = 1.3
DEFAULT_EASE = 2.5


def review(state, is_correct: bool):
    """
    Update an SRSState object in-place using the SM-2 algorithm.
    Returns the same object so callers can chain.

    Correct: interval grows (1 → 6 → interval * ease_factor), ease rises.
    Incorrect: interval resets to 0, ease is penalised (min MIN_EASE).
    """
    if is_correct:
        if state.repetitions == 0:
            new_interval = 1
        elif state.repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(state.interval * state.ease_factor)
        state.ease_factor = state.ease_factor + 0.1
        state.repetitions = state.repetitions + 1
        state.interval = new_interval
    else:
        state.ease_factor = max(MIN_EASE, state.ease_factor - 0.2)
        state.repetitions = 0
        state.interval = 0

    # next_review is at least 1 day from now even when interval is 0
    state.next_review = date.today() + timedelta(days=max(state.interval, 1))
    return state


def is_due(state) -> bool:
    """Return True if the question is due for review today."""
    return state.next_review <= date.today()
