import numpy as np
from typing import List, Tuple, Optional
from sklearn.cluster import KMeans
from app.models.log_entry import LogEntry, LogLevel


def cluster_entries(
    entries: List[LogEntry],
    embeddings: List[List[float]],
) -> List[int]:
    """
    Run K-means clustering on ERROR/CRITICAL entry embeddings.
    Returns cluster_id assignments for ALL entries (None-eligible entries get -1).
    """
    if not entries or not embeddings:
        return [-1] * len(entries)

    # Only cluster ERROR and CRITICAL entries that have embeddings
    error_indices = [
        i for i, e in enumerate(entries)
        if e.level in (LogLevel.ERROR, LogLevel.CRITICAL) and embeddings[i] is not None
    ]

    if len(error_indices) < 3:
        return [-1] * len(entries)

    error_embeddings = np.array([embeddings[i] for i in error_indices])

    unique_errors = len(error_indices)
    k = min(10, max(2, unique_errors // 3))

    if len(error_indices) < k:
        k = len(error_indices)

    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(error_embeddings)

    # Build full assignment array
    assignments = [-1] * len(entries)
    for idx, entry_idx in enumerate(error_indices):
        assignments[entry_idx] = int(cluster_labels[idx])

    return assignments


def get_cluster_representatives(
    entries: List[LogEntry],
    cluster_assignments: List[int],
    n_representatives: int = 3,
) -> dict:
    """
    Group entries by cluster_id and find representative entries.
    Returns dict mapping cluster_id -> list of representative entries.
    """
    clusters: dict[int, List[LogEntry]] = {}
    for entry, cluster_id in zip(entries, cluster_assignments):
        if cluster_id >= 0:
            clusters.setdefault(cluster_id, []).append(entry)

    result = {}
    for cluster_id, cluster_entries in clusters.items():
        # Pick representatives: prioritize shortest clean messages as most representative
        sorted_entries = sorted(cluster_entries, key=lambda e: len(e.message))
        result[cluster_id] = {
            "size": len(cluster_entries),
            "representatives": sorted_entries[:n_representatives],
        }

    return result
