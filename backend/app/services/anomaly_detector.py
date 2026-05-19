import numpy as np
from typing import List, Tuple
from sklearn.ensemble import IsolationForest
from app.models.log_entry import LogEntry, LogLevel
from app.models.anomaly import AnomalySeverity


def _extract_features(entries: List[LogEntry]) -> np.ndarray:
    """Extract numerical features for anomaly detection."""
    features = []

    # Build rolling error rate (5-min window approximation by line count)
    window_size = 50
    levels = [e.level for e in entries]

    for i, entry in enumerate(entries):
        hour_of_day = entry.timestamp.hour if entry.timestamp else 12
        day_of_week = entry.timestamp.weekday() if entry.timestamp else 0
        is_error = 1 if entry.level in (LogLevel.ERROR, LogLevel.CRITICAL) else 0
        message_length = len(entry.message)

        # Rolling error rate in surrounding window
        start = max(0, i - window_size // 2)
        end = min(len(levels), i + window_size // 2)
        window = levels[start:end]
        error_rate = sum(1 for l in window if l in (LogLevel.ERROR, LogLevel.CRITICAL)) / max(len(window), 1)

        features.append([
            hour_of_day / 23.0,
            day_of_week / 6.0,
            float(is_error),
            min(message_length / 500.0, 1.0),
            error_rate,
        ])

    return np.array(features, dtype=np.float32)


def detect_anomalies(entries: List[LogEntry]) -> List[Tuple[int, float, AnomalySeverity]]:
    """
    Run Isolation Forest on entries.
    Returns list of (entry_index, anomaly_score, severity) for anomalous entries.
    """
    if len(entries) < 10:
        return []

    features = _extract_features(entries)

    model = IsolationForest(
        contamination=0.05,
        random_state=42,
        n_estimators=100,
    )
    model.fit(features)

    # Scores from sklearn: negative = more anomalous
    raw_scores = model.decision_function(features)

    # Normalize to 0-1 where 1 = most anomalous
    min_score = raw_scores.min()
    max_score = raw_scores.max()
    score_range = max_score - min_score if max_score != min_score else 1.0
    normalized = 1.0 - (raw_scores - min_score) / score_range

    predictions = model.predict(features)  # -1 = anomaly, 1 = normal

    results = []
    for i, (pred, score) in enumerate(zip(predictions, normalized)):
        if pred == -1:
            if score > 0.8:
                severity = AnomalySeverity.CRITICAL
            elif score > 0.6:
                severity = AnomalySeverity.HIGH
            elif score > 0.4:
                severity = AnomalySeverity.MEDIUM
            else:
                severity = AnomalySeverity.LOW
            results.append((i, float(score), severity))

    return results


def get_context_lines(entries: List[LogEntry], entry_index: int, window: int = 5) -> dict:
    """Get surrounding log lines for context."""
    start = max(0, entry_index - window)
    end = min(len(entries), entry_index + window + 1)

    before = []
    for e in entries[start:entry_index]:
        before.append({
            "line_number": e.line_number,
            "level": e.level.value,
            "message": e.message,
        })

    after = []
    for e in entries[entry_index + 1:end]:
        after.append({
            "line_number": e.line_number,
            "level": e.level.value,
            "message": e.message,
        })

    return {"before": before, "after": after}
