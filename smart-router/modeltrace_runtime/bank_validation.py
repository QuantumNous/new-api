import math


_REQUIRED_TOP_LEVEL_KEYS = (
    "schema",
    "minimum_valid_numbers",
    "recommended_queries",
    "method",
    "models",
    "robust",
    "calibration",
)


def _invalid(detail: str) -> None:
    raise ValueError(f"invalid ModelTrace bank: {detail}")


def _as_finite_float(value) -> float | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    try:
        runtime_value = float(value)
    except (OverflowError, TypeError, ValueError):
        return None
    return runtime_value if math.isfinite(runtime_value) else None


def _matches_number(value, expected: float) -> bool:
    return _as_finite_float(value) is not None and value == expected


def _require_vector_shape(path: str, value, length: int) -> None:
    if not isinstance(value, list) or len(value) != length:
        _invalid(f"{path} must have length {length}")


def _require_matrix_shape(
    path: str,
    value,
    row_count: int,
    column_count: int,
) -> None:
    if not isinstance(value, list) or len(value) != row_count:
        _invalid(f"{path} must have {row_count} rows")
    for index, row in enumerate(value):
        _require_vector_shape(f"{path}[{index}]", row, column_count)


def _require_row_width(path: str, value, column_count: int) -> None:
    if not isinstance(value, list):
        _invalid(f"{path} must be a list")
    for index, row in enumerate(value):
        _require_vector_shape(f"{path}[{index}]", row, column_count)


def _is_finite_number(value) -> bool:
    return _as_finite_float(value) is not None


def _require_finite_vector(path: str, values: list, *, positive: bool = False) -> None:
    for index, value in enumerate(values):
        if positive:
            if not _is_finite_number(value) or value <= 0:
                _invalid(f"{path}[{index}] must be finite and greater than zero")
        elif not _is_finite_number(value):
            _invalid(f"{path}[{index}] must be a finite number")


def _require_finite_matrix(path: str, rows: list) -> None:
    for index, row in enumerate(rows):
        _require_finite_vector(f"{path}[{index}]", row)


def _require_bounded_vector(
    path: str,
    values: list,
    minimum: float,
    maximum: float,
    bounds: str,
) -> None:
    for index, value in enumerate(values):
        if not minimum <= value <= maximum:
            _invalid(f"{path}[{index}] must be between {bounds}")


def _require_bounded_matrix(
    path: str,
    rows: list,
    minimum: float,
    maximum: float,
    bounds: str,
) -> None:
    for index, row in enumerate(rows):
        _require_bounded_vector(
            f"{path}[{index}]",
            row,
            minimum,
            maximum,
            bounds,
        )


def validate_bank(bank: dict) -> None:
    if not isinstance(bank, dict):
        _invalid("bank must be a dict")
    for key in _REQUIRED_TOP_LEVEL_KEYS:
        if key not in bank:
            _invalid(f"missing bank.{key}")
    if bank["schema"] != "robust-number-fingerprint-bank":
        _invalid("bank.schema is unsupported")

    for key, expected_type, type_name in (
        ("method", dict, "dict"),
        ("models", list, "list"),
        ("robust", dict, "dict"),
        ("calibration", dict, "dict"),
    ):
        if not isinstance(bank[key], expected_type):
            _invalid(f"bank.{key} must be a {type_name}")

    robust = bank["robust"]
    for key, expected_type, type_name in (
        ("model_order", list, "list"),
        ("hellinger", dict, "dict"),
        ("ordered_blocks", dict, "dict"),
    ):
        if not isinstance(robust.get(key), expected_type):
            _invalid(f"bank.robust.{key} must be a {type_name}")

    if (
        type(bank["minimum_valid_numbers"]) is not int
        or bank["minimum_valid_numbers"] != 80
    ):
        _invalid("bank.minimum_valid_numbers must equal 80")
    if type(bank["recommended_queries"]) is not int or bank["recommended_queries"] != 3:
        _invalid("bank.recommended_queries must equal 3")

    method = bank["method"]
    value_range = method.get("range")
    if (
        not isinstance(value_range, list)
        or len(value_range) != 2
        or any(type(value) is not int for value in value_range)
        or value_range != [1, 355]
    ):
        _invalid("bank.method.range must equal [1, 355]")
    if not _matches_number(method.get("alpha"), 0.5):
        _invalid("bank.method.alpha must equal 0.5")
    if not _matches_number(method.get("ordered_block_weight"), 0.25):
        _invalid("bank.method.ordered_block_weight must equal 0.25")
    if not _matches_number(robust["ordered_blocks"].get("weight"), 0.25):
        _invalid("bank.robust.ordered_blocks.weight must equal 0.25")
    if not isinstance(method.get("name"), str) or not method["name"].strip():
        _invalid("bank.method.name must be a non-empty string")

    models = bank["models"]
    model_count = len(models)
    if not 1 <= model_count <= 256:
        _invalid("bank.models must contain between 1 and 256 models")
    model_ids = []
    seen_model_ids = set()
    family_names = {}
    for index, model in enumerate(models):
        if not isinstance(model, dict):
            _invalid(f"bank.models[{index}] must be a dict")
        model_id = model.get("id")
        if not isinstance(model_id, str) or not model_id.strip():
            _invalid(f"bank.models[{index}].id must be a non-empty string")
        if model_id in seen_model_ids:
            _invalid("model IDs must be unique")
        seen_model_ids.add(model_id)
        model_ids.append(model_id)

        for key in ("display_name", "family", "family_name"):
            value = model.get(key)
            if not isinstance(value, str) or not value.strip():
                _invalid(
                    f"bank.models[{index}].{key} must be a non-empty string"
                )
        family = model["family"]
        family_name = model["family_name"]
        if family in family_names and family_names[family] != family_name:
            _invalid(f"family {family!r} has inconsistent display names")
        family_names[family] = family_name
        if len(family_names) > 32:
            _invalid("bank.models must contain at most 32 families")

        counts = model.get("counts")
        _require_vector_shape(f"bank.models[{index}].counts", counts, 355)
        for count_index, count in enumerate(counts):
            if type(count) is not int or count < 0:
                _invalid(
                    f"bank.models[{index}].counts[{count_index}] "
                    "must be a non-negative integer"
                )
        counts_total = sum(counts)
        if counts_total <= 0:
            _invalid(f"bank.models[{index}].counts total must be positive")
        if not _is_finite_number(counts_total):
            _invalid(
                f"bank.models[{index}].counts total must be representable "
                "as a finite float"
            )
    if robust["model_order"] != model_ids:
        _invalid(
            "bank.robust.model_order must exactly match bank.models ID order"
        )

    hellinger = robust["hellinger"]
    for key in ("feature_mean", "feature_scale"):
        _require_vector_shape(
            f"bank.robust.hellinger.{key}",
            hellinger.get(key),
            355,
        )
    _require_finite_vector(
        "bank.robust.hellinger.feature_mean",
        hellinger["feature_mean"],
    )
    _require_bounded_vector(
        "bank.robust.hellinger.feature_mean",
        hellinger["feature_mean"],
        0.0,
        1.0,
        "0 and 1",
    )
    _require_finite_vector(
        "bank.robust.hellinger.feature_scale",
        hellinger["feature_scale"],
        positive=True,
    )
    _require_bounded_vector(
        "bank.robust.hellinger.feature_scale",
        hellinger["feature_scale"],
        1e-12,
        1.0,
        "1e-12 and 1",
    )
    _require_matrix_shape(
        "bank.robust.hellinger.centroids",
        hellinger.get("centroids"),
        model_count,
        355,
    )
    _require_finite_matrix(
        "bank.robust.hellinger.centroids",
        hellinger["centroids"],
    )
    _require_bounded_matrix(
        "bank.robust.hellinger.centroids",
        hellinger["centroids"],
        -1.0,
        1.0,
        "-1 and 1",
    )
    _require_row_width(
        "bank.robust.hellinger.nuisance_basis",
        hellinger.get("nuisance_basis"),
        355,
    )
    _require_finite_matrix(
        "bank.robust.hellinger.nuisance_basis",
        hellinger["nuisance_basis"],
    )
    _require_bounded_matrix(
        "bank.robust.hellinger.nuisance_basis",
        hellinger["nuisance_basis"],
        -1.0,
        1.0,
        "-1 and 1",
    )

    ordered = robust["ordered_blocks"]
    for key in ("feature_mean", "feature_scale"):
        _require_vector_shape(
            f"bank.robust.ordered_blocks.{key}",
            ordered.get(key),
            74,
        )
    _require_finite_vector(
        "bank.robust.ordered_blocks.feature_mean",
        ordered["feature_mean"],
    )
    _require_bounded_vector(
        "bank.robust.ordered_blocks.feature_mean",
        ordered["feature_mean"],
        0.0,
        1.0,
        "0 and 1",
    )
    _require_finite_vector(
        "bank.robust.ordered_blocks.feature_scale",
        ordered["feature_scale"],
        positive=True,
    )
    _require_bounded_vector(
        "bank.robust.ordered_blocks.feature_scale",
        ordered["feature_scale"],
        1e-12,
        1.0,
        "1e-12 and 1",
    )
    _require_matrix_shape(
        "bank.robust.ordered_blocks.centroids",
        ordered.get("centroids"),
        model_count,
        74,
    )
    _require_finite_matrix(
        "bank.robust.ordered_blocks.centroids",
        ordered["centroids"],
    )
    _require_bounded_matrix(
        "bank.robust.ordered_blocks.centroids",
        ordered["centroids"],
        -1.0,
        1.0,
        "-1 and 1",
    )
    _require_row_width(
        "bank.robust.ordered_blocks.nuisance_basis",
        ordered.get("nuisance_basis"),
        74,
    )
    _require_finite_matrix(
        "bank.robust.ordered_blocks.nuisance_basis",
        ordered["nuisance_basis"],
    )
    _require_bounded_matrix(
        "bank.robust.ordered_blocks.nuisance_basis",
        ordered["nuisance_basis"],
        -1.0,
        1.0,
        "-1 and 1",
    )
    environment_centroids = ordered.get("environment_centroids")
    if not isinstance(environment_centroids, list) or not environment_centroids:
        _invalid(
            "bank.robust.ordered_blocks.environment_centroids "
            "must be a non-empty list"
        )
    for index, template in enumerate(environment_centroids):
        _require_matrix_shape(
            f"bank.robust.ordered_blocks.environment_centroids[{index}]",
            template,
            model_count,
            74,
        )
        _require_finite_matrix(
            f"bank.robust.ordered_blocks.environment_centroids[{index}]",
            template,
        )
        _require_bounded_matrix(
            f"bank.robust.ordered_blocks.environment_centroids[{index}]",
            template,
            -1.0,
            1.0,
            "-1 and 1",
        )

    calibration = bank["calibration"]
    if set(calibration) != {"1", "2", "3"}:
        _invalid("bank.calibration must contain exactly 1, 2, 3")
    for key in ("1", "2", "3"):
        entry = calibration[key]
        if not isinstance(entry, dict):
            _invalid(f"bank.calibration.{key} must be a dict")
        beta = entry.get("beta")
        if not _is_finite_number(beta) or beta <= 0:
            _invalid(
                f"bank.calibration.{key}.beta "
                "must be finite and greater than zero"
            )
        if not 0.05 <= beta <= 12.0:
            _invalid(
                f"bank.calibration.{key}.beta "
                "must be between 0.05 and 12.0 inclusive"
            )
        accuracy = entry.get("cv_accuracy")
        if not _is_finite_number(accuracy) or not 0 <= accuracy <= 1:
            _invalid(
                f"bank.calibration.{key}.cv_accuracy "
                "must be finite and between zero and one"
            )
