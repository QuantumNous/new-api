import importlib
import importlib.util
import copy
import json
import unittest
from pathlib import Path


BANK_PATH = (
    Path(__file__).resolve().parents[2]
    / "third_party"
    / "modeltrace"
    / "data"
    / "unified_bank.json"
)


class BankValidationTest(unittest.TestCase):
    def load_bank(self):
        return json.loads(BANK_PATH.read_text(encoding="utf-8"))

    def assert_bank_invalid(self, bank, expected_message):
        module = importlib.import_module("modeltrace_runtime.bank_validation")
        error = None
        try:
            module.validate_bank(bank)
        except Exception as caught:
            error = caught
        self.assertIs(type(error), ValueError)
        self.assertEqual(expected_message, str(error))

    def test_validate_bank_callable_capability_probe(self):
        module_name = "modeltrace_runtime.bank_validation"
        spec = importlib.util.find_spec(module_name)

        self.assertIsNotNone(
            spec,
            "modeltrace_runtime.bank_validation capability is missing",
        )
        module = importlib.import_module(module_name)
        validator = getattr(module, "validate_bank", None)
        self.assertTrue(callable(validator), "validate_bank must be callable")

    def test_actual_vendored_bank_is_valid(self):
        module = importlib.import_module("modeltrace_runtime.bank_validation")
        bank = self.load_bank()
        error = None
        try:
            module.validate_bank(bank)
        except Exception as caught:
            error = caught
        self.assertIsNone(error, f"vendored bank was rejected: {error!r}")

    def test_required_top_level_and_nested_schema_is_fail_closed(self):
        bank = self.load_bank()
        self.assert_bank_invalid(
            None,
            "invalid ModelTrace bank: bank must be a dict",
        )

        required_keys = (
            "schema",
            "minimum_valid_numbers",
            "recommended_queries",
            "method",
            "models",
            "robust",
            "calibration",
        )
        for key in required_keys:
            malformed = copy.deepcopy(bank)
            del malformed[key]
            with self.subTest(missing=key):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: missing bank.{key}",
                )

        malformed = copy.deepcopy(bank)
        malformed["schema"] = "unknown"
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.schema is unsupported",
        )

        for key, replacement, kind in (
            ("method", [], "dict"),
            ("models", {}, "list"),
            ("robust", [], "dict"),
            ("calibration", [], "dict"),
        ):
            malformed = copy.deepcopy(bank)
            malformed[key] = replacement
            with self.subTest(container=key):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: bank.{key} must be a {kind}",
                )

        for key, replacement, kind in (
            ("model_order", {}, "list"),
            ("hellinger", [], "dict"),
            ("ordered_blocks", [], "dict"),
        ):
            malformed = copy.deepcopy(bank)
            malformed["robust"][key] = replacement
            with self.subTest(robust_container=key):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: bank.robust.{key} must be a {kind}",
                )

    def test_range_and_algorithm_constants_match_runtime(self):
        bank = self.load_bank()
        mutations = (
            (
                ("minimum_valid_numbers",),
                79,
                "bank.minimum_valid_numbers must equal 80",
            ),
            (
                ("minimum_valid_numbers",),
                True,
                "bank.minimum_valid_numbers must equal 80",
            ),
            (
                ("recommended_queries",),
                2,
                "bank.recommended_queries must equal 3",
            ),
            (
                ("method", "range"),
                [0, 355],
                "bank.method.range must equal [1, 355]",
            ),
            (
                ("method", "alpha"),
                0.25,
                "bank.method.alpha must equal 0.5",
            ),
            (
                ("method", "alpha"),
                True,
                "bank.method.alpha must equal 0.5",
            ),
            (
                ("method", "ordered_block_weight"),
                0.5,
                "bank.method.ordered_block_weight must equal 0.25",
            ),
            (
                ("robust", "ordered_blocks", "weight"),
                0.5,
                "bank.robust.ordered_blocks.weight must equal 0.25",
            ),
            (
                ("method", "name"),
                "",
                "bank.method.name must be a non-empty string",
            ),
        )
        for path, value, detail in mutations:
            malformed = copy.deepcopy(bank)
            target = malformed
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            with self.subTest(path=".".join(path), value=value):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: {detail}",
                )

    def test_wrong_dimension_is_rejected(self):
        bank = self.load_bank()
        model_count = len(bank["models"])
        cases = []

        malformed = copy.deepcopy(bank)
        malformed["models"][0]["counts"].pop()
        cases.append(
            (
                malformed,
                "bank.models[0].counts must have length 355",
            )
        )

        for key in ("feature_mean", "feature_scale"):
            malformed = copy.deepcopy(bank)
            malformed["robust"]["hellinger"][key].pop()
            cases.append(
                (
                    malformed,
                    f"bank.robust.hellinger.{key} must have length 355",
                )
            )

        malformed = copy.deepcopy(bank)
        malformed["robust"]["hellinger"]["centroids"].pop()
        cases.append(
            (
                malformed,
                f"bank.robust.hellinger.centroids must have {model_count} rows",
            )
        )
        malformed = copy.deepcopy(bank)
        malformed["robust"]["hellinger"]["centroids"][0].pop()
        cases.append(
            (
                malformed,
                "bank.robust.hellinger.centroids[0] must have length 355",
            )
        )
        malformed = copy.deepcopy(bank)
        malformed["robust"]["hellinger"]["nuisance_basis"][0].pop()
        cases.append(
            (
                malformed,
                "bank.robust.hellinger.nuisance_basis[0] must have length 355",
            )
        )

        for key in ("feature_mean", "feature_scale"):
            malformed = copy.deepcopy(bank)
            malformed["robust"]["ordered_blocks"][key].pop()
            cases.append(
                (
                    malformed,
                    f"bank.robust.ordered_blocks.{key} must have length 74",
                )
            )

        malformed = copy.deepcopy(bank)
        malformed["robust"]["ordered_blocks"]["centroids"].pop()
        cases.append(
            (
                malformed,
                f"bank.robust.ordered_blocks.centroids must have {model_count} rows",
            )
        )
        malformed = copy.deepcopy(bank)
        malformed["robust"]["ordered_blocks"]["centroids"][0].pop()
        cases.append(
            (
                malformed,
                "bank.robust.ordered_blocks.centroids[0] must have length 74",
            )
        )
        malformed = copy.deepcopy(bank)
        malformed["robust"]["ordered_blocks"]["nuisance_basis"][0].pop()
        cases.append(
            (
                malformed,
                "bank.robust.ordered_blocks.nuisance_basis[0] must have length 74",
            )
        )
        malformed = copy.deepcopy(bank)
        malformed["robust"]["ordered_blocks"]["environment_centroids"][0].pop()
        cases.append(
            (
                malformed,
                "bank.robust.ordered_blocks.environment_centroids[0] "
                f"must have {model_count} rows",
            )
        )
        malformed = copy.deepcopy(bank)
        malformed["robust"]["ordered_blocks"]["environment_centroids"][0][0].pop()
        cases.append(
            (
                malformed,
                "bank.robust.ordered_blocks.environment_centroids[0][0] "
                "must have length 74",
            )
        )

        for malformed, detail in cases:
            with self.subTest(detail=detail):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: {detail}",
                )

    def test_nonfinite_scale_centroids_and_counts_are_rejected(self):
        bank = self.load_bank()
        mutations = (
            (
                ("models", 0, "counts", 0),
                True,
                "bank.models[0].counts[0] must be a non-negative integer",
            ),
            (
                ("models", 0, "counts", 0),
                -1,
                "bank.models[0].counts[0] must be a non-negative integer",
            ),
            (
                ("robust", "hellinger", "feature_mean", 0),
                float("nan"),
                "bank.robust.hellinger.feature_mean[0] must be a finite number",
            ),
            (
                ("robust", "hellinger", "feature_scale", 0),
                float("inf"),
                "bank.robust.hellinger.feature_scale[0] must be finite "
                "and greater than zero",
            ),
            (
                ("robust", "hellinger", "feature_scale", 0),
                0.0,
                "bank.robust.hellinger.feature_scale[0] must be finite "
                "and greater than zero",
            ),
            (
                ("robust", "hellinger", "centroids", 0, 0),
                float("-inf"),
                "bank.robust.hellinger.centroids[0][0] must be a finite number",
            ),
            (
                ("robust", "hellinger", "nuisance_basis", 0, 0),
                True,
                "bank.robust.hellinger.nuisance_basis[0][0] "
                "must be a finite number",
            ),
            (
                ("robust", "ordered_blocks", "feature_mean", 0),
                float("nan"),
                "bank.robust.ordered_blocks.feature_mean[0] "
                "must be a finite number",
            ),
            (
                ("robust", "ordered_blocks", "feature_scale", 0),
                float("inf"),
                "bank.robust.ordered_blocks.feature_scale[0] must be finite "
                "and greater than zero",
            ),
            (
                ("robust", "ordered_blocks", "feature_scale", 0),
                -0.1,
                "bank.robust.ordered_blocks.feature_scale[0] must be finite "
                "and greater than zero",
            ),
            (
                ("robust", "ordered_blocks", "centroids", 0, 0),
                float("nan"),
                "bank.robust.ordered_blocks.centroids[0][0] "
                "must be a finite number",
            ),
            (
                ("robust", "ordered_blocks", "nuisance_basis", 0, 0),
                float("inf"),
                "bank.robust.ordered_blocks.nuisance_basis[0][0] "
                "must be a finite number",
            ),
            (
                (
                    "robust",
                    "ordered_blocks",
                    "environment_centroids",
                    0,
                    0,
                    0,
                ),
                float("nan"),
                "bank.robust.ordered_blocks.environment_centroids[0][0][0] "
                "must be a finite number",
            ),
        )
        for path, value, detail in mutations:
            malformed = copy.deepcopy(bank)
            target = malformed
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            with self.subTest(path=path, value=value):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: {detail}",
                )

        malformed = copy.deepcopy(bank)
        malformed["models"][0]["counts"] = [0] * 355
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.models[0].counts total must be positive",
        )

    def test_builder_derived_numeric_domains_are_enforced(self):
        bank = self.load_bank()
        mutations = (
            (
                ("robust", "hellinger", "feature_mean", 0),
                -5e-324,
                "bank.robust.hellinger.feature_mean[0] "
                "must be between 0 and 1",
            ),
            (
                ("robust", "ordered_blocks", "feature_mean", 0),
                1.0000000000000002,
                "bank.robust.ordered_blocks.feature_mean[0] "
                "must be between 0 and 1",
            ),
            (
                ("robust", "hellinger", "feature_scale", 0),
                5e-324,
                "bank.robust.hellinger.feature_scale[0] "
                "must be between 1e-12 and 1",
            ),
            (
                ("robust", "ordered_blocks", "feature_scale", 0),
                1.0000000000000002,
                "bank.robust.ordered_blocks.feature_scale[0] "
                "must be between 1e-12 and 1",
            ),
            (
                ("robust", "hellinger", "centroids", 0, 0),
                1e308,
                "bank.robust.hellinger.centroids[0][0] "
                "must be between -1 and 1",
            ),
            (
                ("robust", "ordered_blocks", "centroids", 0, 0),
                -1e308,
                "bank.robust.ordered_blocks.centroids[0][0] "
                "must be between -1 and 1",
            ),
            (
                ("robust", "hellinger", "nuisance_basis", 0, 0),
                1.0000000000000002,
                "bank.robust.hellinger.nuisance_basis[0][0] "
                "must be between -1 and 1",
            ),
            (
                ("robust", "ordered_blocks", "nuisance_basis", 0, 0),
                -1.0000000000000002,
                "bank.robust.ordered_blocks.nuisance_basis[0][0] "
                "must be between -1 and 1",
            ),
            (
                (
                    "robust",
                    "ordered_blocks",
                    "environment_centroids",
                    0,
                    0,
                    0,
                ),
                1e308,
                "bank.robust.ordered_blocks.environment_centroids[0][0][0] "
                "must be between -1 and 1",
            ),
        )

        for path, value, detail in mutations:
            malformed = copy.deepcopy(bank)
            target = malformed
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            with self.subTest(path=path, value=value):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: {detail}",
                )

    def test_oversized_integers_are_stable_value_errors(self):
        bank = self.load_bank()
        oversized = 10**400
        mutations = (
            (
                ("method", "alpha"),
                "bank.method.alpha must equal 0.5",
            ),
            (
                ("robust", "hellinger", "feature_mean", 0),
                "bank.robust.hellinger.feature_mean[0] "
                "must be a finite number",
            ),
            (
                ("robust", "hellinger", "feature_scale", 0),
                "bank.robust.hellinger.feature_scale[0] must be finite "
                "and greater than zero",
            ),
            (
                ("robust", "hellinger", "centroids", 0, 0),
                "bank.robust.hellinger.centroids[0][0] "
                "must be a finite number",
            ),
            (
                ("calibration", "2", "beta"),
                "bank.calibration.2.beta must be finite "
                "and greater than zero",
            ),
            (
                ("calibration", "3", "cv_accuracy"),
                "bank.calibration.3.cv_accuracy must be finite "
                "and between zero and one",
            ),
            (
                ("models", 0, "counts", 0),
                "bank.models[0].counts total must be representable "
                "as a finite float",
            ),
        )

        for path, detail in mutations:
            malformed = copy.deepcopy(bank)
            target = malformed
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = oversized
            with self.subTest(path=path):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: {detail}",
                )

    def test_model_order_duplicate_and_empty_ids_are_rejected(self):
        bank = self.load_bank()

        malformed = copy.deepcopy(bank)
        malformed["models"][0]["id"] = ""
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.models[0].id must be a non-empty string",
        )

        malformed = copy.deepcopy(bank)
        malformed["models"][1]["id"] = malformed["models"][0]["id"]
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: model IDs must be unique",
        )

        malformed = copy.deepcopy(bank)
        malformed["robust"]["model_order"][0:2] = reversed(
            malformed["robust"]["model_order"][0:2]
        )
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.robust.model_order must exactly match "
            "bank.models ID order",
        )

        malformed = copy.deepcopy(bank)
        malformed["robust"]["model_order"][1] = malformed["robust"]["model_order"][0]
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.robust.model_order must exactly match "
            "bank.models ID order",
        )

    def test_model_and_family_limits_are_enforced(self):
        bank = self.load_bank()

        malformed = copy.deepcopy(bank)
        malformed["models"] = []
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.models must contain "
            "between 1 and 256 models",
        )

        malformed = copy.deepcopy(bank)
        template = malformed["models"][0]
        malformed["models"] = []
        for index in range(257):
            model = copy.deepcopy(template)
            model["id"] = f"model-{index}"
            malformed["models"].append(model)
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.models must contain "
            "between 1 and 256 models",
        )

        for key, value in (
            ("display_name", ""),
            ("family", " "),
            ("family_name", False),
        ):
            malformed = copy.deepcopy(bank)
            malformed["models"][0][key] = value
            with self.subTest(key=key):
                self.assert_bank_invalid(
                    malformed,
                    f"invalid ModelTrace bank: bank.models[0].{key} "
                    "must be a non-empty string",
                )

        malformed = copy.deepcopy(bank)
        malformed["models"][1]["family_name"] = "Different GPT"
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: family 'gpt' has inconsistent display names",
        )

        malformed = copy.deepcopy(bank)
        template = malformed["models"][0]
        malformed["models"] = []
        for index in range(33):
            model = copy.deepcopy(template)
            model["id"] = f"model-{index}"
            model["family"] = f"family-{index}"
            model["family_name"] = f"Family {index}"
            malformed["models"].append(model)
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.models must contain at most 32 families",
        )

    def test_calibration_exact_keys_and_finite_values_are_required(self):
        bank = self.load_bank()

        malformed = copy.deepcopy(bank)
        del malformed["calibration"]["3"]
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.calibration must contain exactly 1, 2, 3",
        )

        malformed = copy.deepcopy(bank)
        malformed["calibration"]["4"] = copy.deepcopy(
            malformed["calibration"]["3"]
        )
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.calibration must contain exactly 1, 2, 3",
        )

        malformed = copy.deepcopy(bank)
        malformed["calibration"]["1"] = []
        self.assert_bank_invalid(
            malformed,
            "invalid ModelTrace bank: bank.calibration.1 must be a dict",
        )

        for value in (float("nan"), float("inf"), True, 0.0, -1.0):
            malformed = copy.deepcopy(bank)
            malformed["calibration"]["2"]["beta"] = value
            with self.subTest(field="beta", value=value):
                self.assert_bank_invalid(
                    malformed,
                    "invalid ModelTrace bank: bank.calibration.2.beta "
                    "must be finite and greater than zero",
                )

        for value in (float("nan"), float("-inf"), False, -0.1, 1.1):
            malformed = copy.deepcopy(bank)
            malformed["calibration"]["3"]["cv_accuracy"] = value
            with self.subTest(field="cv_accuracy", value=value):
                self.assert_bank_invalid(
                    malformed,
                    "invalid ModelTrace bank: bank.calibration.3.cv_accuracy "
                    "must be finite and between zero and one",
                )

    def test_calibration_beta_is_bounded_by_fitted_search_interval(self):
        module = importlib.import_module("modeltrace_runtime.bank_validation")
        bank = self.load_bank()
        expected_message = (
            "invalid ModelTrace bank: bank.calibration.2.beta "
            "must be between 0.05 and 12.0 inclusive"
        )

        for value in (0.049, 12.001, 1e308):
            malformed = copy.deepcopy(bank)
            malformed["calibration"]["2"]["beta"] = value
            with self.subTest(rejected=value):
                self.assert_bank_invalid(malformed, expected_message)

        for value in (0.05, 12.0):
            valid = copy.deepcopy(bank)
            valid["calibration"]["2"]["beta"] = value
            with self.subTest(accepted=value):
                module.validate_bank(valid)


if __name__ == "__main__":
    unittest.main()
