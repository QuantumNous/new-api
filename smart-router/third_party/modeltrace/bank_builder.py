from __future__ import annotations

import argparse
import itertools
import json
import math
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


PROJECT = Path(__file__).resolve().parents[1]
WORKSPACE = PROJECT.parent
sys.path.insert(0, str(PROJECT))

from fingerprint import (  # noqa: E402
    ALPHA,
    DIMENSION,
    ORDERED_BLOCK_WEIGHT,
    count_numbers,
    hellinger_feature,
    ordered_block_feature,
    parse_numbers,
    robust_score_numbers,
)


DEFAULT_RESPONSES = PROJECT / "data" / "gpt_reference.jsonl"
DEFAULT_OUTPUT = PROJECT / "data" / "gpt_bank.json"


def read_rows(path: Path) -> list[dict]:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
    output = []
    for row in rows:
        if not row.get("strict_valid"):
            continue
        numbers = parse_numbers(row["text"])
        output.append({**row, "numbers": numbers, "counts": count_numbers(numbers)})
    return output


def fit_robust_artifacts(rows: list[dict], model_ids: list[str]) -> dict:
    environments = sorted({row["condition_id"] for row in rows})
    complete = [
        environment
        for environment in environments
        if {row["source"] for row in rows if row["condition_id"] == environment}
        == set(model_ids)
    ]
    robust_ready = bool(complete)
    if complete:
        robust_rows = [row for row in rows if row["condition_id"] in complete]
    else:
        robust_rows = rows

    features = np.stack([hellinger_feature(row["counts"]) for row in robust_rows])
    feature_mean = features.mean(axis=0)
    feature_scale = features.std(axis=0)
    feature_scale[feature_scale < 1e-12] = 1.0
    standardized = (features - feature_mean) / feature_scale

    nuisance_environments = sorted(
        {
            row.get("nuisance_condition_id", row["condition_id"])
            for row in robust_rows
        }
    )
    environment_means = []
    for environment in nuisance_environments:
        indices = np.asarray(
            [
                row.get("nuisance_condition_id", row["condition_id"]) == environment
                for row in robust_rows
            ],
            dtype=bool,
        )
        environment_means.append(standardized[indices].mean(axis=0))
    offsets = np.stack(environment_means)
    offsets -= offsets.mean(axis=0, keepdims=True)
    basis = np.empty((0, DIMENSION), dtype=np.float64)
    if len(offsets) > 1:
        _, singular, right = np.linalg.svd(offsets, full_matrices=False)
        rank = min(2, int(np.sum(singular > singular[0] * 1e-8))) if singular[0] else 0
        basis = right[:rank]
        standardized -= (standardized @ basis.T) @ basis

    labels = np.asarray([row["source"] for row in robust_rows])
    centroids = np.stack(
        [standardized[labels == model_id].mean(axis=0) for model_id in model_ids]
    )
    centroid_norms = np.linalg.norm(centroids, axis=1, keepdims=True)
    centroids /= np.maximum(centroid_norms, 1e-12)

    ordered_features = np.stack([ordered_block_feature(row["numbers"]) for row in robust_rows])
    ordered_mean = ordered_features.mean(axis=0)
    ordered_scale = ordered_features.std(axis=0)
    ordered_scale[ordered_scale < 1e-12] = 1.0
    ordered_standardized = (ordered_features - ordered_mean) / ordered_scale
    ordered_environment_means = []
    for environment in nuisance_environments:
        indices = np.asarray(
            [
                row.get("nuisance_condition_id", row["condition_id"]) == environment
                for row in robust_rows
            ],
            dtype=bool,
        )
        ordered_environment_means.append(ordered_standardized[indices].mean(axis=0))
    ordered_offsets = np.stack(ordered_environment_means)
    ordered_offsets -= ordered_offsets.mean(axis=0, keepdims=True)
    ordered_basis = np.empty((0, ordered_standardized.shape[1]), dtype=np.float64)
    if len(ordered_offsets) > 1:
        _, singular, right = np.linalg.svd(ordered_offsets, full_matrices=False)
        rank = min(2, int(np.sum(singular > singular[0] * 1e-8))) if singular[0] else 0
        ordered_basis = right[:rank]
        ordered_standardized -= (ordered_standardized @ ordered_basis.T) @ ordered_basis
    ordered_centroids = np.stack(
        [ordered_standardized[labels == model_id].mean(axis=0) for model_id in model_ids]
    )
    ordered_centroids /= np.maximum(np.linalg.norm(ordered_centroids, axis=1, keepdims=True), 1e-12)
    ordered_environment_centroids = []
    unprojected_ordered = (ordered_features - ordered_mean) / ordered_scale
    template_environments = complete or [None]
    for environment in template_environments:
        environment_centroids = []
        for model_id in model_ids:
            indices = np.asarray(
                [
                    (environment is None or row["condition_id"] == environment)
                    and row["source"] == model_id
                    for row in robust_rows
                ],
                dtype=bool,
            )
            centroid = unprojected_ordered[indices].mean(axis=0)
            centroid /= max(float(np.linalg.norm(centroid)), 1e-12)
            environment_centroids.append(centroid)
        ordered_environment_centroids.append(np.stack(environment_centroids))
    ordered_weight = ORDERED_BLOCK_WEIGHT

    return {
        "model_order": model_ids,
        "robust_ready": robust_ready,
        "training_rows": len(robust_rows),
        "complete_environments": complete,
        "hellinger": {
            "feature_mean": feature_mean.tolist(),
            "feature_scale": feature_scale.tolist(),
            "nuisance_rank": len(basis),
            "nuisance_environments": nuisance_environments,
            "nuisance_basis": basis.tolist(),
            "centroids": centroids.tolist(),
        },
        "ordered_blocks": {
            "weight": ordered_weight,
            "feature": "four position blocks x 16 value bins plus final-digit distribution",
            "feature_mean": ordered_mean.tolist(),
            "feature_scale": ordered_scale.tolist(),
            "nuisance_rank": len(ordered_basis),
            "nuisance_basis": ordered_basis.tolist(),
            "centroids": ordered_centroids.tolist(),
            "environment_centroids": [centroids.tolist() for centroids in ordered_environment_centroids],
        },
    }


def calibration_records(rows: list[dict], model_ids: list[str], query_count: int) -> list[tuple[list[float], int]]:
    records = []
    conditions = sorted({row["condition_id"] for row in rows})
    for condition in conditions:
        challenge_ids = sorted({row["challenge_id"] for row in rows if row["condition_id"] == condition})
        challenge_ids = [
            challenge_id
            for challenge_id in challenge_ids
            if all(
                any(
                    row["source"] == model_id and row["challenge_id"] == challenge_id
                    for row in rows
                )
                for model_id in model_ids
            )
        ]
        if len(challenge_ids) < query_count:
            continue
        for held_ids in itertools.combinations(challenge_ids, query_count):
            held_set = set(held_ids)
            train = [row for row in rows if row["challenge_id"] not in held_set]
            robust = fit_robust_artifacts(train, model_ids)
            score_bank = {"robust": robust}
            for truth_index, model_id in enumerate(model_ids):
                held = [
                    row
                    for row in rows
                    if row["source"] == model_id and row["challenge_id"] in held_set
                ]
                if len(held) != query_count:
                    continue
                response_scores = [
                    robust_score_numbers(row["numbers"], score_bank)["fused"] for row in held
                ]
                combined = [
                    sum(scores[index] for scores in response_scores) / query_count
                    for index in range(len(model_ids))
                ]
                records.append((combined, truth_index))
    return records


def fit_beta(records: list[tuple[list[float], int]]) -> tuple[float, float]:
    best_beta = 1.0
    best_loss = float("inf")
    for step in range(801):
        beta = math.exp(math.log(0.05) + step * (math.log(12.0) - math.log(0.05)) / 800)
        loss = 0.0
        for scores, truth in records:
            scaled = [beta * value for value in scores]
            maximum = max(scaled)
            log_sum = maximum + math.log(sum(math.exp(value - maximum) for value in scaled))
            loss += log_sum - scaled[truth]
        loss /= len(records)
        if loss < best_loss:
            best_beta = beta
            best_loss = loss
    return best_beta, best_loss


def build_bank(rows: list[dict], fallback_calibration: dict | None = None) -> dict:
    model_ids = list(dict.fromkeys(row["source"] for row in rows))
    model_entries = []
    for model_id in model_ids:
        selected = [row for row in rows if row["source"] == model_id]
        pooled = [sum(row["counts"][index] for row in selected) for index in range(DIMENSION)]
        family_id = selected[0].get("family_id")
        family_name = selected[0].get("family_name")
        model_entries.append(
            {
                "id": model_id,
                "display_name": model_id,
                "family": family_id,
                "family_name": family_name,
                "response_count": len(selected),
                "valid_number_count": sum(len(row["numbers"]) for row in selected),
                "conditions": dict(Counter(row["condition_id"] for row in selected)),
                "counts": pooled,
            }
        )

    robust = fit_robust_artifacts(rows, model_ids)
    calibration = {}
    for query_count in (1, 2, 3):
        records = calibration_records(rows, model_ids, query_count)
        key = str(query_count)
        if records:
            beta, nll = fit_beta(records)
            correct = sum(max(range(len(scores)), key=lambda index: scores[index]) == truth for scores, truth in records)
            calibration[key] = {
                "beta": beta,
                "cv_accuracy": correct / len(records),
                "cv_correct": correct,
                "cv_samples": len(records),
                "cv_nll": nll,
                "fallback": False,
            }
        else:
            previous = fallback_calibration.get(key) if fallback_calibration else None
            calibration[key] = {
                **(
                    previous
                    or {
                        "beta": 1.0,
                        "cv_accuracy": None,
                        "cv_correct": 0,
                        "cv_samples": 0,
                        "cv_nll": None,
                    }
                ),
                "fallback": True,
            }

    providers = sorted({row.get("provider") for row in rows if row.get("provider")})
    source_scope = "Reference outputs enrolled for the listed model labels."
    method_name = "Ordered-block + nuisance-Hellinger"
    return {
        "schema": "robust-number-fingerprint-bank",
        "built_at": datetime.now(timezone.utc).isoformat(),
        "method": {
            "name": method_name,
            "range": [1, 355],
            "alpha": ALPHA,
            "ordered_block_weight": robust["ordered_blocks"]["weight"],
            "parser": "longest digit run; alphabetic separators split runs; retain values 1..355",
            "response_score": "shared nuisance-Hellinger and ordered-block environment/nuisance fusion",
            "aggregation": "mean of response-wise fused class z-scores",
            "probability": "uniform-prior softmax with fusion-specific grouped cross-validation temperature scaling",
        },
        "recommended_queries": 3,
        "minimum_valid_numbers": 80,
        "source_scope": source_scope,
        "providers": providers,
        "models": model_entries,
        "robust": robust,
        "calibration": calibration,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--responses", type=Path, default=DEFAULT_RESPONSES)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    fallback = None
    if args.output.exists():
        fallback = json.loads(args.output.read_text(encoding="utf-8"))["calibration"]
    bank = build_bank(read_rows(args.responses), fallback)
    args.output.write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {
        "output": str(args.output),
        "method": bank["method"]["name"],
        "robust_training_rows": bank["robust"]["training_rows"],
        "complete_environments": len(bank["robust"]["complete_environments"]),
        "nuisance_rank": bank["robust"]["hellinger"]["nuisance_rank"],
        "models": {
            model["id"]: {
                "responses": model["response_count"],
                "valid_numbers": model["valid_number_count"],
            }
            for model in bank["models"]
        },
        "calibration": bank["calibration"],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
