package modeltrace

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"testing"

	"smart-router/api"
)

func TestResultFiniteMetricsAreNotProbabilities(t *testing.T) {
	r := validResult()
	r.Models[0].Score = -100
	r.Models[0].ProfileSimilarity = -.01
	if r.Validate() != nil {
		t.Error("finite diagnostic metric incorrectly treated as probability")
	}
	r.Models[0].ProfileSimilarity = 1.01
	if r.Validate() != nil {
		t.Error("finite diagnostic metric incorrectly range constrained")
	}
}

func TestResultStrictJSON(t *testing.T) {
	data, _ := json.Marshal(validResult())
	for _, text := range []string{
		strings.Replace(string(data), `"complete":true`, `"complete":true,"complete":true`, 1),
		strings.Replace(string(data), `"complete":true`, `"complete":true,"numbers":[1]`, 1),
	} {
		var r Result
		if json.Unmarshal([]byte(text), &r) == nil {
			t.Error("non-strict result JSON admitted")
		}
	}
}

func TestResultRequiresNonNullMetrics(t *testing.T) {
	data, _ := json.Marshal(validResult())
	for _, text := range []string{
		strings.Replace(string(data), `"score":1`, `"score":null`, 1),
		strings.Replace(string(data), `"score":1,`, ``, 1),
		strings.Replace(string(data), `"profile_similarity":0.8`, `"profile_similarity":null`, 1),
	} {
		var r Result
		if json.Unmarshal([]byte(text), &r) == nil && r.Validate() == nil {
			t.Error("null or missing metric admitted")
		}
	}
}

func TestResultRejectsJSONFieldAliases(t *testing.T) {
	data, err := json.Marshal(validResult())
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	replacement := `[{"model":"model-a","family":"family-a","probability":0.95,"score":null,"profile_similarity":null},` +
		`{"model":"model-b","family":"family-b","probability":0.05}]`
	cases := []struct {
		name, input string
		valid       bool
	}{
		{"canonical", text, true},
		{"canonical_null_score", strings.Replace(text, `"score":1`, `"score":null`, 1), false},
		{"models_alias_null_missing_metrics", text[:len(text)-1] + `,"MODELS":` + replacement + `}`, false},
		{"nested_score_alias_null", strings.Replace(text, `"score":1`, `"score":1,"SCORE":null`, 1), false},
		{"nested_similarity_alias_null", strings.Replace(text, `"profile_similarity":0.8`, `"profile_similarity":0.8,"PROFILE_SIMILARITY":null`, 1), false},
		{"family_probability_alias", strings.Replace(text, `"family":"family-a","probability":0.95}`, `"family":"family-a","probability":0.95,"PROBABILITY":0.95}`, 1), false},
		{"model_unicode_fold_alias", strings.Replace(text, `"score":1`, `"score":1,"\u017fcore":null`, 1), false},
		{"complete_alias", text[:len(text)-1] + `,"Complete":true}`, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var decoded Result
			if err := api.DecodeStrict(strings.NewReader(tc.input), &decoded); (err == nil) != tc.valid {
				t.Fatalf("JSON field alias admission: want valid=%t, error=%v", tc.valid, err)
			}
			if tc.valid && (decoded.Models[0].Score != 1 || decoded.Models[0].ProfileSimilarity != .8) {
				t.Fatal("canonical result metrics changed")
			}
		})
	}
}

func validResult() Result {
	return Result{"model-a", .95, 3, true, true, "inconclusive",
		strings.Repeat("a", 64), strings.Repeat("b", 64),
		[]ModelScore{{"model-a", "family-a", .95, 1, .8}, {"model-b", "family-b", .05, -1, .6}},
		[]FamilyScore{{"family-a", .95}, {"family-b", .05}}}
}

func TestResultSafeModelLabels(t *testing.T) {
	for _, tc := range modelLabelCases() {
		t.Run(tc.name, func(t *testing.T) {
			r := validResult()
			r.Prediction, r.Models[0].Model = tc.label, tc.label
			if err := r.Validate(); (err == nil) != tc.valid {
				t.Errorf("safe prediction admission: valid=%t, error=%v", tc.valid, err)
			}
			if !tc.valid {
				return
			}
			data, err := json.Marshal(r)
			if err != nil {
				t.Fatal(err)
			}
			var decoded Result
			if err := json.Unmarshal(data, &decoded); err != nil || decoded.Validate() != nil ||
				decoded.Prediction != tc.label || decoded.Models[0].Model != tc.label {
				t.Fatal("safe result label JSON round trip rejected or changed")
			}
			if Assess(tc.label, r, 0) != "matched" || Assess("model-b", r, 0) != "mismatched" ||
				Assess("absent-model", r, 0) != "inconclusive" {
				t.Error("safe model assessment incorrect")
			}
			r = validResult()
			r.Prediction, r.Models[0].Model = "prediction-model", "prediction-model"
			r.Models[1].Model = tc.label
			if r.Validate() != nil || Assess(tc.label, r, 0) != "mismatched" {
				t.Error("safe non-predicted model rejected or assessment incorrect")
			}
		})
	}
}

func TestResultRejectsInvalidUTF8JSON(t *testing.T) {
	data, err := json.Marshal(validResult())
	if err != nil {
		t.Fatal(err)
	}
	data = []byte(strings.Replace(string(data), "model-a", "model-\xff", -1))
	var r Result
	if json.Unmarshal(data, &r) == nil {
		t.Fatal("invalid UTF-8 result label JSON admitted")
	}
}

func TestResultFamilyLabelsRemainStrict(t *testing.T) {
	for _, label := range []string{"org/family", "\u6a21\u578b", strings.Repeat("a", 129)} {
		t.Run(label, func(t *testing.T) {
			r := validResult()
			r.Models[0].Family, r.Families[0].Family = label, label
			if r.Validate() == nil {
				t.Error("model-only label relaxation changed family identity admission")
			}
		})
	}
}

func TestResultAdmission(t *testing.T) {
	cases := []struct {
		name string
		edit func(*Result)
	}{
		{"nan", func(r *Result) { r.Models[0].Score = math.NaN() }},
		{"infinity", func(r *Result) { r.Models[0].ProfileSimilarity = math.Inf(1) }},
		{"probability", func(r *Result) { r.Probability = 1.1 }},
		{"sum", func(r *Result) { r.Models[1].Probability += 2e-9 }},
		{"sort", func(r *Result) { r.Models[0], r.Models[1] = r.Models[1], r.Models[0] }},
		{"duplicate", func(r *Result) { r.Models[1].Model = r.Models[0].Model }},
		{"family_duplicate", func(r *Result) { r.Families[1].Family = r.Families[0].Family }},
		{"family_sum", func(r *Result) { r.Families[1].Probability = .1 }},
		{"family_mismatch", func(r *Result) { r.Models[1].Family = "family-a" }},
		{"raw_label", func(r *Result) { r.Models[0].Model = "https://private.invalid" }},
		{"top", func(r *Result) { r.Prediction = "model-b" }},
		{"top_probability", func(r *Result) { r.Probability = .5 }},
		{"empty", func(r *Result) { r.Models = nil }},
		{"model_limit", func(r *Result) { r.Models = make([]ModelScore, 257) }},
		{"family_limit", func(r *Result) { r.Families = make([]FamilyScore, 33) }},
		{"complete", func(r *Result) { r.Complete = false }},
		{"used", func(r *Result) { r.UsedOutputs = 0 }},
		{"open_set", func(r *Result) { r.ClosedSet = false }},
		{"revision", func(r *Result) { r.EngineRevision = "bad" }},
		{"assessment", func(r *Result) { r.Assessment = "route" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := validResult()
			tc.edit(&r)
			if r.Validate() == nil {
				t.Fatal("invalid result admitted")
			}
		})
	}
}

func TestCompleteAnalysisIsNotAuthoritativeMatch(t *testing.T) {
	r := validResult()
	r.Models[0].Probability, r.Models[1].Probability = .8, .2
	r.Families[0].Probability, r.Families[1].Probability = .8, .2
	r.Probability = .8
	if Assess("model-a", r, 0) != "inconclusive" {
		t.Fatal("completion alone declared match")
	}
}

func TestMissingClaimedLabelIsInconclusive(t *testing.T) {
	if Assess("absent-model", validResult(), .9) != "inconclusive" {
		t.Fatal("missing claimed label declared conclusive")
	}
}

func TestAssessmentAndPartialResults(t *testing.T) {
	r := validResult()
	if r.Validate() != nil || Assess("model-a", r, .9) != "matched" ||
		Assess("model-b", r, .9) != "mismatched" {
		t.Error("complete diagnostic assessment incorrect")
	}
	for _, threshold := range []float64{-1, 1.1, math.NaN(), math.Inf(1)} {
		t.Run("invalid_threshold", func(t *testing.T) {
			if Assess("model-a", r, threshold) != "inconclusive" {
				t.Fatal("invalid threshold accepted")
			}
		})
	}
	for _, used := range []int{1, 2} {
		r.UsedOutputs, r.Complete = used, false
		t.Run("partial", func(t *testing.T) {
			if r.Validate() != nil || Assess("model-a", r, .9) != "inconclusive" {
				t.Fatal("partial result declared conclusive or rejected")
			}
		})
	}
}

func TestResultRejectsConclusivePartialAssessments(t *testing.T) {
	for _, used := range []int{1, 2} {
		for _, assessment := range []string{"matched", "mismatched"} {
			t.Run(fmt.Sprintf("%d_%s", used, assessment), func(t *testing.T) {
				r := validResult()
				r.UsedOutputs, r.Complete, r.Assessment = used, false, assessment
				if err := r.Validate(); !errors.Is(err, ErrInvalidResult) {
					t.Errorf("conclusive partial result admitted directly: %v", err)
				}
				data, err := json.Marshal(r)
				if err != nil {
					t.Fatal(err)
				}
				var decoded Result
				if err := json.Unmarshal(data, &decoded); err != nil {
					t.Fatalf("strict partial result JSON decode failed: %v", err)
				}
				if err := decoded.Validate(); !errors.Is(err, ErrInvalidResult) {
					t.Errorf("conclusive partial result admitted after strict JSON decode: %v", err)
				}
				if Assess("model-a", r, .9) != "inconclusive" {
					t.Error("partial assessment is not conservative")
				}
				r.Assessment = "inconclusive"
				if r.Validate() != nil {
					t.Error("valid inconclusive partial result rejected")
				}
			})
		}
	}
}

func TestCompleteResultAllowsExplicitAssessmentThreshold(t *testing.T) {
	r := validResult()
	r.Probability = .8
	r.Models[0].Probability, r.Models[1].Probability = .8, .2
	r.Families[0].Probability, r.Families[1].Probability = .8, .2
	for _, tc := range []struct{ claimed, assessment string }{
		{"model-a", "matched"}, {"model-b", "mismatched"},
	} {
		t.Run(tc.assessment, func(t *testing.T) {
			r.Assessment = Assess(tc.claimed, r, .8)
			if r.Assessment != tc.assessment || r.Validate() != nil {
				t.Fatal("consistent explicit-threshold complete result rejected")
			}
			data, err := json.Marshal(r)
			if err != nil {
				t.Fatal(err)
			}
			var decoded Result
			if json.Unmarshal(data, &decoded) != nil || decoded.Validate() != nil {
				t.Fatal("explicit-threshold complete result JSON rejected")
			}
			if Assess(tc.claimed, r, 0) != "inconclusive" ||
				Assess("absent-model", r, .8) != "inconclusive" {
				t.Error("default threshold or absent claim lost conservative assessment")
			}
		})
	}
	r.Assessment = "inconclusive"
	if r.Validate() != nil {
		t.Error("complete inconclusive result rejected")
	}
}
