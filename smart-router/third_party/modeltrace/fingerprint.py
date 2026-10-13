from __future__ import annotations

import json
import math
import random
import re
import secrets
from pathlib import Path
from typing import Iterable

import numpy as np

VALUE_MIN = 1
VALUE_MAX = 355
DIMENSION = VALUE_MAX - VALUE_MIN + 1
ALPHA = 0.5
ORDERED_BLOCK_WEIGHT = 0.25
DEFAULT_BANK = Path(__file__).with_name("data") / "gpt_bank.json"
FAMILY_DISPLAY_NAMES = {"gpt": "GPT", "claude": "Claude"}


def parse_numbers(text: str) -> list[int]:
    runs: list[list[int]] = []
    current: list[int] = []
    previous_end = 0
    for match in re.finditer(r"\d+", text):
        separator = text[previous_end : match.start()]
        value = int(match.group())
        if current and any(character.isalpha() for character in separator):
            runs.append(current)
            current = []
        if VALUE_MIN <= value <= VALUE_MAX:
            current.append(value)
        previous_end = match.end()
    if current:
        runs.append(current)
    return max(runs, key=len) if runs else []


def count_numbers(numbers: Iterable[int]) -> list[int]:
    counts = [0] * DIMENSION
    for number in numbers:
        counts[number - VALUE_MIN] += 1
    return counts


def standardize(values: list[float]) -> list[float]:
    mean = sum(values) / len(values)
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    scale = max(math.sqrt(variance), 1e-12)
    return [(value - mean) / scale for value in values]


def hellinger_feature(counts: list[int]) -> np.ndarray:
    values = np.asarray(counts, dtype=np.float64) + ALPHA
    return np.sqrt(values / values.sum())


def ordered_block_feature(numbers: list[int]) -> np.ndarray:
    values = np.asarray(numbers, dtype=np.float64)
    pieces = []
    for chunk in np.array_split(values, 4):
        counts, _ = np.histogram(chunk, bins=16, range=(1.0, 356.0))
        smoothed = counts.astype(np.float64) + 0.5
        pieces.append(np.sqrt(smoothed / smoothed.sum()))
    last_digits = np.bincount(values.astype(int) % 10, minlength=10).astype(np.float64) + 0.5
    pieces.append(np.sqrt(last_digits / last_digits.sum()))
    return np.concatenate(pieces)


def robust_score_counts(counts: list[int], bank: dict) -> dict[str, list[float]]:
    robust = bank["robust"]
    model_count = len(robust["model_order"])

    hellinger = robust["hellinger"]
    feature = hellinger_feature(counts)
    mean = np.asarray(hellinger["feature_mean"], dtype=np.float64)
    scale = np.asarray(hellinger["feature_scale"], dtype=np.float64)
    projected = (feature - mean) / scale
    basis = np.asarray(hellinger["nuisance_basis"], dtype=np.float64)
    if basis.size:
        projected -= (projected @ basis.T) @ basis
    norm = max(float(np.linalg.norm(projected)), 1e-12)
    centroids = np.asarray(hellinger["centroids"], dtype=np.float64)
    nuisance = (projected / norm) @ centroids.T
    nuisance = np.asarray(standardize(nuisance.tolist()))

    fused = standardize(nuisance.tolist())
    assert len(fused) == model_count
    return {
        "fused": fused,
        "nuisance": nuisance.tolist(),
    }


def ordered_block_scores(numbers: list[int], bank: dict) -> list[float]:
    artifact = bank["robust"]["ordered_blocks"]
    feature = ordered_block_feature(numbers)
    mean = np.asarray(artifact["feature_mean"], dtype=np.float64)
    scale = np.asarray(artifact["feature_scale"], dtype=np.float64)
    standardized_feature = (feature - mean) / scale

    normalized = standardized_feature / max(float(np.linalg.norm(standardized_feature)), 1e-12)
    templates = np.asarray(artifact["environment_centroids"], dtype=np.float64)
    environment_scores = np.stack([normalized @ centroids.T for centroids in templates])
    template = np.max(environment_scores, axis=0)
    template = np.asarray(standardize(template.tolist()))

    basis = np.asarray(artifact["nuisance_basis"], dtype=np.float64)
    projected = standardized_feature.copy()
    if basis.size:
        projected -= (projected @ basis.T) @ basis
    projected /= max(float(np.linalg.norm(projected)), 1e-12)
    centroids = np.asarray(artifact["centroids"], dtype=np.float64)
    nuisance = projected @ centroids.T
    nuisance = np.asarray(standardize(nuisance.tolist()))
    return standardize((0.5 * template + 0.5 * nuisance).tolist())


def robust_score_numbers(numbers: list[int], bank: dict) -> dict[str, list[float]]:
    marginal = robust_score_counts(count_numbers(numbers), bank)
    artifact = bank["robust"].get("ordered_blocks")
    ordered_weight = float(artifact.get("weight", 0.0)) if artifact else 0.0
    if not artifact or ordered_weight == 0.0:
        return {**marginal, "marginal_fused": marginal["fused"], "ordered": marginal["fused"]}
    ordered = ordered_block_scores(numbers, bank)
    fused = [
        (1.0 - ordered_weight) * marginal_score + ordered_weight * ordered_score
        for marginal_score, ordered_score in zip(marginal["fused"], ordered)
    ]
    return {**marginal, "fused": fused, "marginal_fused": marginal["fused"], "ordered": ordered}


def softmax(values: list[float]) -> list[float]:
    maximum = max(values)
    weights = [math.exp(value - maximum) for value in values]
    total = sum(weights)
    return [weight / total for weight in weights]


def js_similarity(left: list[int], right: list[int]) -> float:
    left_total = sum(left)
    right_total = sum(right) + ALPHA * DIMENSION
    p = [value / left_total for value in left]
    q = [(value + ALPHA) / right_total for value in right]
    midpoint = [(a + b) / 2.0 for a, b in zip(p, q)]

    def divergence(values: list[float], middle: list[float]) -> float:
        return sum(value * math.log(value / target) for value, target in zip(values, middle) if value)

    js = (divergence(p, midpoint) + divergence(q, midpoint)) / 2.0
    return 1.0 - math.sqrt(js / math.log(2.0))


def load_bank(path: Path = DEFAULT_BANK) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def analyze_global_outputs(outputs: list[dict], bank: dict) -> dict:
    result = analyze_outputs(outputs, bank)
    model_entries = {model["id"]: model for model in bank["models"]}
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
            for item in result["results"]
            if (model_entries[item["model"]].get("family") or "models") == family_id
        )
        for family_id in family_order
    }
    for item in result["results"]:
        model = model_entries[item["model"]]
        family_id = model.get("family") or "models"
        item["family"] = family_id
        item["family_name"] = family_names[family_id]
        item["conditional_probability"] = (
            item["probability"] / family_probabilities[family_id]
        )
    winning_family = max(family_order, key=family_probabilities.get)
    return {
        **result,
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
        "method": "统一全局稳健数字指纹",
    }


def analyze_outputs(outputs: list[dict], bank: dict) -> dict:
    model_ids = [model["id"] for model in bank["models"]]
    valid = []
    diagnostics = []
    for index, item in enumerate(outputs):
        text = str(item.get("text", ""))
        expected = int(item.get("expected_count") or 0)
        numbers = parse_numbers(text)
        minimum = max(80, math.ceil(expected * 0.55)) if expected else 80
        accepted = len(numbers) >= minimum
        diagnostics.append(
            {
                "index": index,
                "parsed_numbers": len(numbers),
                "minimum_numbers": minimum,
                "accepted": accepted,
            }
        )
        if accepted:
            counts = count_numbers(numbers)
            components = robust_score_numbers(numbers, bank)
            valid.append({"counts": counts, "scores": components["fused"], **components})

    if not valid:
        raise ValueError("没有可用回答：请粘贴完整数字序列；拒答或严重截断的回答不会计入。")

    combined_scores = [
        sum(item["scores"][index] for item in valid) / len(valid)
        for index in range(len(model_ids))
    ]
    combined_nuisance = [
        sum(item.get("nuisance", item["scores"])[index] for item in valid) / len(valid)
        for index in range(len(model_ids))
    ]
    calibration_key = str(min(len(valid), 3))
    beta = float(bank["calibration"][calibration_key]["beta"])
    probabilities = softmax([beta * value for value in combined_scores])
    pooled_counts = [sum(item["counts"][index] for item in valid) for index in range(DIMENSION)]
    bank_models = {model["id"]: model for model in bank["models"]}
    results = [
        {
            "model": model_id,
            "display_name": bank_models[model_id]["display_name"],
            "probability": probabilities[index],
            "profile_similarity": js_similarity(pooled_counts, bank_models[model_id]["counts"]),
            "score": combined_scores[index],
            "nuisance_score": combined_nuisance[index],
        }
        for index, model_id in enumerate(model_ids)
    ]
    results.sort(key=lambda item: item["probability"], reverse=True)
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
            "cv_accuracy": bank["calibration"][calibration_key]["cv_accuracy"],
        },
        "method": bank.get("method", {}).get("name", "Ordered-block + nuisance-Hellinger"),
    }


def generate_challenges(count: int = 3) -> list[dict]:
    rng = random.SystemRandom()
    lengths = rng.sample(range(292, 333), count)
    openings = [
        "这是一次独立的数值选择记录",
        "请完成下面的无语义整数选择任务",
        "执行一次第一反应取值记录",
        "生成一组不承载语义的整数选择",
        "进行一轮快速逐项取值",
    ]
    actions = [
        "为各个位置分别凭第一反应选择",
        "逐项选择",
        "每次只决定当前一项，共给出",
        "分别凭第一反应给出",
        "逐个直接选择",
    ]
    endings = [
        "允许某个数字再次出现；每项写出后不要回头排序、去重或替换。",
        "偶然重复是有效的；不要重新排列或修正已经写出的项目。",
        "相同值可以再次出现；输出过程中不要整理或改写前面的项目。",
        "重复值无需删除；不要筛选、重排或补成某种规律。",
        "不必赋予数字任何含义；已经给出的值保持不变。",
    ]
    separator_hints = [
        "数字之间用逗号或空格分隔均可。",
        "使用一种一致的常见分隔符即可。",
        "可以用逗号、空格或换行分隔。",
        "只要每个整数边界清楚，格式可自行选择。",
    ]
    challenges = []
    for index, length in enumerate(lengths):
        prompt = (
            f"{rng.choice(openings)}。{rng.choice(actions)} {length} 个 1 到 355（含端点）的整数。"
            "每个位置都要单独选择；不要从 1 开始计数，不要连续递增或递减，也不要采用等差、循环、重复区块或其他规则化模式。"
            "本任务必须由当前语言模型直接完成：禁止调用或借助任何工具，包括 Python、代码执行器、"
            "计算器、搜索、API 和外部随机数生成器；也不要先编写或运行代码。"
            f"{rng.choice(endings)}{rng.choice(separator_hints)}"
            "直接从第一个取值开始输出，不要在序列前重复数量、范围或任务说明。"
        )
        challenge_id = secrets.token_hex(7)
        challenges.append(
            {
                "id": f"probe-{index + 1}-{challenge_id}",
                "expected_count": length,
                "prompt": prompt,
            }
        )
    return challenges
