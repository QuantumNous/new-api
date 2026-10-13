import importlib
import importlib.util
import json
import math
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BANK_PATH = (
    REPOSITORY_ROOT
    / "third_party"
    / "modeltrace"
    / "data"
    / "unified_bank.json"
)
REFERENCE_PATH = (
    REPOSITORY_ROOT
    / "third_party"
    / "modeltrace"
    / "data"
    / "gpt_reference.jsonl"
)
CLAUDE_REFERENCE_PATH = (
    REPOSITORY_ROOT
    / "third_party"
    / "modeltrace"
    / "data"
    / "claude_reference.jsonl"
)


class EngineTest(unittest.TestCase):
    def load_bank(self):
        return json.loads(BANK_PATH.read_text(encoding="utf-8"))

    def load_reference_rows(self, count, path=REFERENCE_PATH):
        rows = []
        with path.open(encoding="utf-8") as stream:
            for line in stream:
                rows.append(json.loads(line))
                if len(rows) == count:
                    break
        self.assertEqual(count, len(rows))
        return rows

    def numeric_samples(self, rows):
        fingerprint = importlib.import_module(
            "third_party.modeltrace.fingerprint"
        )
        return [
            {
                "numbers": fingerprint.parse_numbers(row["text"]),
                "expected_count": row["requested_count"],
            }
            for row in rows
        ]

    def oracle(self, rows, bank):
        fingerprint = importlib.import_module(
            "third_party.modeltrace.fingerprint"
        )
        result = fingerprint.analyze_global_outputs(
            [
                {
                    "text": row["text"],
                    "expected_count": row["requested_count"],
                }
                for row in rows
            ],
            bank,
        )
        result["complete"] = len(rows) == 3
        result["closed_set"] = True
        return result

    def assert_nested_equal(self, expected, actual, path="result"):
        if isinstance(expected, dict):
            self.assertIsInstance(actual, dict, path)
            self.assertEqual(set(expected), set(actual), path)
            for key in expected:
                self.assert_nested_equal(
                    expected[key],
                    actual[key],
                    f"{path}.{key}",
                )
            return
        if isinstance(expected, list):
            self.assertIsInstance(actual, list, path)
            self.assertEqual(len(expected), len(actual), path)
            for index, value in enumerate(expected):
                self.assert_nested_equal(
                    value,
                    actual[index],
                    f"{path}[{index}]",
                )
            return
        if isinstance(expected, float):
            self.assertIsInstance(actual, (int, float), path)
            self.assertNotIsInstance(actual, bool, path)
            self.assertAlmostEqual(
                expected,
                actual,
                delta=1e-10,
                msg=path,
            )
            return
        self.assertEqual(expected, actual, path)

    def assert_engine_error(self, samples, bank, expected_message):
        engine = importlib.import_module("modeltrace_runtime.engine")
        error = None
        try:
            engine.analyze_samples(samples, bank)
        except Exception as caught:
            error = caught
        self.assertIs(type(error), ValueError)
        self.assertEqual(expected_message, str(error))

    def test_analyze_samples_callable_capability_probe(self):
        module_name = "modeltrace_runtime.engine"
        spec = importlib.util.find_spec(module_name)

        self.assertIsNotNone(
            spec,
            "modeltrace_runtime.engine capability is missing",
        )
        module = importlib.import_module(module_name)
        analyzer = getattr(module, "analyze_samples", None)
        self.assertTrue(callable(analyzer), "analyze_samples must be callable")

    def test_one_sample_matches_vendor_oracle(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        rows = self.load_reference_rows(1)
        error = None
        try:
            actual = engine.analyze_samples(self.numeric_samples(rows), bank)
        except Exception as caught:
            error = caught
        self.assertIsNone(error, f"one-sample analysis failed: {error!r}")
        self.assert_nested_equal(self.oracle(rows, bank), actual)

    def test_two_samples_match_vendor_oracle(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        rows = self.load_reference_rows(2)
        error = None
        try:
            actual = engine.analyze_samples(self.numeric_samples(rows), bank)
        except Exception as caught:
            error = caught
        self.assertIsNone(error, f"two-sample analysis failed: {error!r}")
        self.assert_nested_equal(self.oracle(rows, bank), actual)

    def test_three_samples_match_vendor_oracle_and_are_complete(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        rows = self.load_reference_rows(3)
        error = None
        try:
            actual = engine.analyze_samples(self.numeric_samples(rows), bank)
        except Exception as caught:
            error = caught
        self.assertIsNone(error, f"three-sample analysis failed: {error!r}")
        self.assert_nested_equal(self.oracle(rows, bank), actual)

    def test_analyze_samples_handles_large_valid_uniform_model_counts(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        validator = importlib.import_module(
            "modeltrace_runtime.bank_validation"
        )
        bank = self.load_bank()
        uniform_model = bank["models"][0]
        uniform_model["counts"] = [10**25] * 355
        self.assertIsNone(validator.validate_bank(bank))
        sample = {
            "numbers": list(range(1, 356)),
            "expected_count": 355,
        }

        def assert_finite_floats(value, path="result"):
            if isinstance(value, float):
                self.assertTrue(math.isfinite(value), path)
            elif isinstance(value, dict):
                for key, item in value.items():
                    assert_finite_floats(item, f"{path}.{key}")
            elif isinstance(value, list):
                for index, item in enumerate(value):
                    assert_finite_floats(item, f"{path}[{index}]")

        for sample_count in (1, 2, 3):
            with self.subTest(sample_count=sample_count):
                error = None
                try:
                    actual = engine.analyze_samples(
                        [sample] * sample_count,
                        bank,
                    )
                except Exception as caught:
                    error = caught
                self.assertIsNone(
                    error,
                    f"{sample_count}-sample analysis failed: {error!r}",
                )
                assert_finite_floats(actual)
                uniform_result = next(
                    item
                    for item in actual["results"]
                    if item["model"] == uniform_model["id"]
                )
                self.assertAlmostEqual(
                    1.0,
                    uniform_result["profile_similarity"],
                    delta=1e-12,
                )

    def test_family_probability_parity_uses_oracle_model_probabilities(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        rows = self.load_reference_rows(3)
        expected = self.oracle(rows, bank)
        actual = engine.analyze_samples(self.numeric_samples(rows), bank)

        models = {model["id"]: model for model in bank["models"]}
        family_order = list(
            dict.fromkeys(model["family"] for model in bank["models"])
        )
        family_names = {
            model["family"]: model["family_name"]
            for model in bank["models"]
        }
        expected_probabilities = {
            family: sum(
                item["probability"]
                for item in expected["results"]
                if models[item["model"]]["family"] == family
            )
            for family in family_order
        }
        expected_entries = [
            {
                "family": family,
                "display_name": family_names[family],
                "probability": expected_probabilities[family],
            }
            for family in family_order
        ]
        self.assertEqual(expected_entries, actual["family_probabilities"])

        top_family = max(family_order, key=expected_probabilities.get)
        self.assertEqual(top_family, actual["family_prediction"])
        self.assertEqual(
            family_names[top_family],
            actual["family_prediction_name"],
        )
        self.assertEqual(
            expected_probabilities[top_family],
            actual["family_probability"],
        )

    def test_more_than_three_valid_samples_is_rejected(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        rows = self.load_reference_rows(4)
        error = None
        try:
            engine.analyze_samples(self.numeric_samples(rows), bank)
        except Exception as caught:
            error = caught
        self.assertIs(type(error), ValueError)
        self.assertEqual(
            "numeric analysis supports at most three valid samples",
            str(error),
        )

    def test_ordered_features_preserve_sequence_without_sort_or_set(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        rows = self.load_reference_rows(1, CLAUDE_REFERENCE_PATH)
        samples = self.numeric_samples(rows)
        numbers = samples[0]["numbers"]

        self.assertNotEqual(numbers, sorted(numbers))
        self.assertLess(len(set(numbers)), len(numbers))

        actual = engine.analyze_samples(samples, bank)
        self.assert_nested_equal(self.oracle(rows, bank), actual)

    def test_invalid_samples_use_threshold_and_keep_diagnostics_order(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        rows = self.load_reference_rows(1)
        valid_sample = self.numeric_samples(rows)[0]
        samples = [
            {
                "numbers": list(range(1, 80)),
                "expected_count": 100,
            },
            valid_sample,
            {
                "numbers": [1] * 80,
                "expected_count": 147,
            },
        ]

        expected = self.oracle(rows, bank)
        expected["diagnostics"] = [
            {
                "index": 0,
                "parsed_numbers": 79,
                "minimum_numbers": 80,
                "accepted": False,
            },
            {
                "index": 1,
                "parsed_numbers": len(valid_sample["numbers"]),
                "minimum_numbers": 120,
                "accepted": True,
            },
            {
                "index": 2,
                "parsed_numbers": 80,
                "minimum_numbers": 81,
                "accepted": False,
            },
        ]

        actual = engine.analyze_samples(samples, bank)
        self.assert_nested_equal(expected, actual)

    def test_expected_count_threshold_uses_exact_integer_ceiling(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()

        actual = engine.analyze_samples(
            [
                {"numbers": [1] * 99, "expected_count": 180},
                {"numbers": [2] * 80, "expected_count": 0},
            ],
            bank,
        )

        self.assertEqual(99, actual["diagnostics"][0]["minimum_numbers"])
        self.assertTrue(actual["diagnostics"][0]["accepted"])
        for expected_count in range(4097):
            with self.subTest(expected_count=expected_count):
                self.assertEqual(
                    max(80, (expected_count * 55 + 99) // 100),
                    engine._minimum_numbers(expected_count),
                )

    def test_diagnostics_preserve_sample_challenge_id(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        rows = self.load_reference_rows(1)
        valid_sample = self.numeric_samples(rows)[0]
        valid_sample["challenge_id"] = "probe-valid"
        invalid_sample = {
            "challenge_id": "probe-short",
            "numbers": [1] * 79,
            "expected_count": 100,
        }

        actual = engine.analyze_samples(
            [invalid_sample, valid_sample],
            bank,
        )
        self.assertEqual(
            ["probe-short", "probe-valid"],
            [
                item.get("challenge_id")
                for item in actual["diagnostics"]
            ],
        )

    def test_no_valid_outputs_raises_stable_error(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()
        samples = [
            {
                "numbers": [1] * 79,
                "expected_count": 100,
            },
            {
                "numbers": [2] * 80,
                "expected_count": 147,
            },
        ]

        error = None
        try:
            engine.analyze_samples(samples, bank)
        except Exception as caught:
            error = caught
        self.assertIs(type(error), ValueError)
        self.assertEqual(
            "没有可用回答：请粘贴完整数字序列；"
            "拒答或严重截断的回答不会计入。",
            str(error),
        )

    def test_sample_shape_number_types_and_range_are_fail_closed(self):
        bank = self.load_bank()
        cases = (
            (
                None,
                "invalid numeric samples: samples must be a list",
            ),
            (
                [None],
                "invalid numeric samples: samples[0] must be a dict",
            ),
            (
                [{"numbers": (1,) * 80, "expected_count": 80}],
                "invalid numeric samples: samples[0].numbers must be a list",
            ),
            (
                [{"numbers": [1] * 80, "expected_count": True}],
                "invalid numeric samples: samples[0].expected_count "
                "must be an integer from 0 to 4096",
            ),
            (
                [{"numbers": [1] * 80, "expected_count": -1}],
                "invalid numeric samples: samples[0].expected_count "
                "must be an integer from 0 to 4096",
            ),
            (
                [{"numbers": [True] + [1] * 79, "expected_count": 80}],
                "invalid numeric samples: samples[0].numbers[0] "
                "must be an integer from 1 to 355",
            ),
            (
                [{"numbers": [1.0] + [1] * 79, "expected_count": 80}],
                "invalid numeric samples: samples[0].numbers[0] "
                "must be an integer from 1 to 355",
            ),
            (
                [{"numbers": [0] + [1] * 79, "expected_count": 80}],
                "invalid numeric samples: samples[0].numbers[0] "
                "must be an integer from 1 to 355",
            ),
            (
                [{"numbers": [356] + [1] * 79, "expected_count": 80}],
                "invalid numeric samples: samples[0].numbers[0] "
                "must be an integer from 1 to 355",
            ),
        )
        for samples, message in cases:
            with self.subTest(message=message):
                self.assert_engine_error(samples, bank, message)

    def test_numbers_length_4096_scores_normally(self):
        engine = importlib.import_module("modeltrace_runtime.engine")
        bank = self.load_bank()

        result = engine.analyze_samples(
            [{"numbers": [1] * 4096, "expected_count": 4096}],
            bank,
        )

        self.assertEqual(1, result["used_outputs"])
        self.assertEqual(4096, result["diagnostics"][0]["parsed_numbers"])

    def test_numbers_length_4097_is_rejected_before_item_validation(self):
        bank = self.load_bank()
        expected_message = (
            "invalid numeric samples: samples[0].numbers "
            "must contain at most 4096 items"
        )

        for numbers in ([1] * 4097, [True] + [1] * 4096):
            with self.subTest(first_value=numbers[0]):
                self.assert_engine_error(
                    [{"numbers": numbers, "expected_count": 4096}],
                    bank,
                    expected_message,
                )

    def test_expected_count_above_4096_is_rejected_before_threshold_math(self):
        bank = self.load_bank()
        expected_message = (
            "invalid numeric samples: samples[0].expected_count "
            "must be an integer from 0 to 4096"
        )

        for expected_count in (4097, 2**60 + 1, 10**400):
            with self.subTest(expected_count=expected_count):
                self.assert_engine_error(
                    [
                        {
                            "numbers": [1] * 80,
                            "expected_count": expected_count,
                        }
                    ],
                    bank,
                    expected_message,
                )


if __name__ == "__main__":
    unittest.main()
