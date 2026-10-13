import math

import numpy as np

from modeltrace_runtime.bank_validation import validate_bank


VALUE_MIN = 1
VALUE_MAX = 355
DIMENSION = VALUE_MAX - VALUE_MIN + 1
ALPHA = 0.5
FAMILY_DISPLAY_NAMES = {"gpt": "GPT", "claude": "Claude"}


def _minimum_numbers(expected_count: int) -> int:
    return max(80, (expected_count * 55 + 99) // 100)


def _count_numbers(numbers: list[int]) -> list[int]:
    counts = [0] * DIMENSION
    for number in numbers:
        counts[number - VALUE_MIN] += 1
    return counts


def _standardize(values: list[float]) -> list[float]:
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    scale = max(math.sqrt(variance), 1e-12)
    return [(value - mean) / scale for value in values]


def _hellinger_feature(counts: list[int]) -> np.ndarray:
    values = np.asarray(counts, dtype=np.float64) + ALPHA
    return np.sqrt(values / values.sum())


def _ordered_block_feature(numbers: list[int]) -> np.ndarray:
    values = np.asarray(numbers, dtype=np.float64)
    pieces = []
    for chunk in np.array_split(values, 4):
        counts, _ = np.histogram(chunk, bins=16, range=(1.0, 356.0))
        smoothed = counts.astype(np.float64) + 0.5
        pieces.append(np.sqrt(smoothed / smoothed.sum()))
    last_digits = (
        np.bincount(values.astype(int) % 10, minlength=10).astype(np.float64)
        + 0.5
    )
    pieces.append(np.sqrt(last_digits / last_digits.sum()))
    return np.concatenate(pieces)


def _score_counts(counts: list[int], bank: dict) -> dict[str, list[float]]:
    hellinger = bank["robust"]["hellinger"]
    feature = _hellinger_feature(counts)
    mean = np.asarray(hellinger["feature_mean"], dtype=np.float64)
    scale = np.asarray(hellinger["feature_scale"], dtype=np.float64)
    projected = (feature - mean) / scale
    basis = np.asarray(hellinger["nuisance_basis"], dtype=np.float64)
    if basis.size:
        projected -= (projected @ basis.T) @ basis
    norm = max(float(np.linalg.norm(projected)), 1e-12)
    centroids = np.asarray(hellinger["centroids"], dtype=np.float64)
    nuisance = (projected / norm) @ centroids.T
    nuisance = np.asarray(_standardize(nuisance.tolist()))
    fused = _standardize(nuisance.tolist())
    return {
        "fused": fused,
        "nuisance": nuisance.tolist(),
    }


def _ordered_block_scores(numbers: list[int], bank: dict) -> list[float]:
    artifact = bank["robust"]["ordered_blocks"]
    feature = _ordered_block_feature(numbers)
    mean = np.asarray(artifact["feature_mean"], dtype=np.float64)
    scale = np.asarray(artifact["feature_scale"], dtype=np.float64)
    standardized_feature = (feature - mean) / scale

    normalized = standardized_feature / max(
        float(np.linalg.norm(standardized_feature)),
        1e-12,
    )
    templates = np.asarray(
        artifact["environment_centroids"],
        dtype=np.float64,
    )
    environment_scores = np.stack(
        [normalized @ centroids.T for centroids in templates]
    )
    template = np.max(environment_scores, axis=0)
    template = np.asarray(_standardize(template.tolist()))

    basis = np.asarray(artifact["nuisance_basis"], dtype=np.float64)
    projected = standardized_feature.copy()
    if basis.size:
        projected -= (projected @ basis.T) @ basis
    projected /= max(float(np.linalg.norm(projected)), 1e-12)
    centroids = np.asarray(artifact["centroids"], dtype=np.float64)
    nuisance = projected @ centroids.T
    nuisance = np.asarray(_standardize(nuisance.tolist()))
    return _standardize((0.5 * template + 0.5 * nuisance).tolist())


def _score_numbers(numbers: list[int], bank: dict) -> dict[str, list[float]]:
    marginal = _score_counts(_count_numbers(numbers), bank)
    artifact = bank["robust"]["ordered_blocks"]
    ordered_weight = float(artifact["weight"])
    ordered = _ordered_block_scores(numbers, bank)
    fused = [
        (1.0 - ordered_weight) * marginal_score
        + ordered_weight * ordered_score
        for marginal_score, ordered_score in zip(marginal["fused"], ordered)
    ]
    return {
        **marginal,
        "fused": fused,
        "marginal_fused": marginal["fused"],
        "ordered": ordered,
    }


def _softmax(values: list[float]) -> list[float]:
    maximum = max(values)
    weights = [math.exp(value - maximum) for value in values]
    total = sum(weights)
    return [weight / total for weight in weights]


def _js_similarity(left: list[int], right: list[int]) -> float:
    left_total = sum(left)
    right_total = sum(right) + ALPHA * DIMENSION
    p = [value / left_total for value in left]
    q = [(value + ALPHA) / right_total for value in right]
    midpoint = [(a + b) / 2.0 for a, b in zip(p, q)]

    def divergence(values: list[float], middle: list[float]) -> float:
        return sum(
            value * math.log(value / target)
            for value, target in zip(values, middle)
            if value
        )

    maximum_js = math.log(2.0)
    js = (divergence(p, midpoint) + divergence(q, midpoint)) / 2.0
    js = min(max(js, 0.0), maximum_js)
    return 1.0 - math.sqrt(js / maximum_js)


def analyze_samples(samples: list[dict], bank: dict) -> dict:
    validate_bank(bank)
    if not isinstance(samples, list):
        raise ValueError("invalid numeric samples: samples must be a list")
    model_ids = [model["id"] for model in bank["models"]]
    valid = []
    diagnostics = []
    for index, sample in enumerate(samples):
        if not isinstance(sample, dict):
            raise ValueError(
                f"invalid numeric samples: samples[{index}] must be a dict"
            )
        numbers = sample.get("numbers")
        if not isinstance(numbers, list):
            raise ValueError(
                f"invalid numeric samples: samples[{index}].numbers "
                "must be a list"
            )
        if len(numbers) > 4096:
            raise ValueError(
                f"invalid numeric samples: samples[{index}].numbers "
                "must contain at most 4096 items"
            )
        expected = sample.get("expected_count", 0)
        if type(expected) is not int or not 0 <= expected <= 4096:
            raise ValueError(
                f"invalid numeric samples: samples[{index}].expected_count "
                "must be an integer from 0 to 4096"
            )
        for number_index, number in enumerate(numbers):
            if (
                type(number) is not int
                or not VALUE_MIN <= number <= VALUE_MAX
            ):
                raise ValueError(
                    f"invalid numeric samples: samples[{index}].numbers"
                    f"[{number_index}] must be an integer from 1 to 355"
                )
        minimum = _minimum_numbers(expected)
        accepted = len(numbers) >= minimum
        diagnostic = {
            "index": index,
            "parsed_numbers": len(numbers),
            "minimum_numbers": minimum,
            "accepted": accepted,
        }
        if "challenge_id" in sample:
            diagnostic["challenge_id"] = sample["challenge_id"]
        diagnostics.append(diagnostic)
        if accepted:
            components = _score_numbers(numbers, bank)
            valid.append(
                {
                    "counts": _count_numbers(numbers),
                    "scores": components["fused"],
                    **components,
                }
            )

    if not valid:
        raise ValueError(
            "没有可用回答：请粘贴完整数字序列；"
            "拒答或严重截断的回答不会计入。"
        )
    if len(valid) > 3:
        raise ValueError("numeric analysis supports at most three valid samples")

    combined_scores = [
        sum(item["scores"][index] for item in valid) / len(valid)
        for index in range(len(model_ids))
    ]
    combined_nuisance = [
        sum(item["nuisance"][index] for item in valid) / len(valid)
        for index in range(len(model_ids))
    ]
    calibration_key = str(len(valid))
    calibration = bank["calibration"][calibration_key]
    beta = float(calibration["beta"])
    probabilities = _softmax(
        [beta * value for value in combined_scores]
    )
    pooled_counts = [
        sum(item["counts"][index] for item in valid)
        for index in range(DIMENSION)
    ]
    bank_models = {model["id"]: model for model in bank["models"]}
    results = [
        {
            "model": model_id,
            "display_name": bank_models[model_id]["display_name"],
            "probability": probabilities[index],
            "profile_similarity": _js_similarity(
                pooled_counts,
                bank_models[model_id]["counts"],
            ),
            "score": combined_scores[index],
            "nuisance_score": combined_nuisance[index],
        }
        for index, model_id in enumerate(model_ids)
    ]
    results.sort(key=lambda item: item["probability"], reverse=True)

    family_order = list(
        dict.fromkeys(
            model.get("family") or "models"
            for model in bank["models"]
        )
    )
    family_names = {
        family_id: next(
            (
                model.get("family_name")
                for model in bank["models"]
                if (model.get("family") or "models") == family_id
                and model.get("family_name")
            ),
            FAMILY_DISPLAY_NAMES.get(family_id, family_id),
        )
        for family_id in family_order
    }
    family_probabilities = {
        family_id: sum(
            item["probability"]
            for item in results
            if (
                bank_models[item["model"]].get("family") or "models"
            )
            == family_id
        )
        for family_id in family_order
    }
    for item in results:
        model = bank_models[item["model"]]
        family_id = model.get("family") or "models"
        item["family"] = family_id
        item["family_name"] = family_names[family_id]
        item["conditional_probability"] = (
            item["probability"] / family_probabilities[family_id]
        )
    winning_family = max(family_order, key=family_probabilities.get)

    return {
        "prediction": results[0]["model"],
        "prediction_name": results[0]["display_name"],
        "probability": results[0]["probability"],
        "used_outputs": len(valid),
        "results": results,
        "diagnostics": diagnostics,
        "calibration": {
            "queries": calibration_key,
            "beta": beta,
            "cv_accuracy": calibration["cv_accuracy"],
        },
        "method": "统一全局稳健数字指纹",
        "family_prediction": winning_family,
        "family_prediction_name": family_names[winning_family],
        "family_probability": family_probabilities[winning_family],
        "family_probabilities": [
            {
                "family": family_id,
                "display_name": family_names[family_id],
                "probability": family_probabilities[family_id],
            }
            for family_id in family_order
        ],
        "complete": len(valid) == 3,
        "closed_set": True,
    }
