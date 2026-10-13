package modeltrace

import (
	"encoding/json"
	"strings"
	"testing"
)

func wireResult(e Evidence) []byte {
	r := validResult()
	used := 0
	for _, s := range e.Samples {
		if len(s.Numbers) >= max(80, (s.ExpectedCount*55+99)/100) {
			used++
		}
	}
	data, _ := json.Marshal(map[string]any{
		"schema_version": 1, "bank_revision": e.BankRevision,
		"prediction": r.Prediction, "probability": r.Probability,
		"used_outputs": used, "complete": used == 3, "closed_set": true,
		"results": r.Models, "family_probabilities": r.Families,
		"diagnostics": []any{map[string]any{"private": "omitted"}},
		"calibration": map[string]any{"beta": 1}, "method": "diagnostic",
	})
	return data
}

func TestWorkerProjection(t *testing.T) {
	e := validEvidence()
	for count := 1; count <= 3; count++ {
		if count > 1 {
			s := e.Samples[0]
			s.ChallengeID = string(rune('a' + count))
			e.Samples = append(e.Samples, s)
		}
		r, err := projectResult(wireResult(e), e, strings.Repeat("b", 64))
		if err != nil || r.Validate() != nil || r.UsedOutputs != count ||
			r.Complete != (count == 3) || r.BankRevision != e.BankRevision {
			t.Error("typed worker projection incorrect")
		}
		data, _ := json.Marshal(r)
		if strings.Contains(string(data), "private") || strings.Contains(string(data), "diagnostics") {
			t.Error("diagnostics escaped projection")
		}
	}
}

func TestWorkerProjectionSafeModelLabels(t *testing.T) {
	e := validEvidence()
	for _, id := range []string{"slot-2", "slot-3"} {
		s := e.Samples[0]
		s.ChallengeID = id
		e.Samples = append(e.Samples, s)
	}
	for _, label := range []string{"org/model-0", "org/\u6a21\u578b", strings.Repeat("\u6a21", 256)} {
		t.Run(label, func(t *testing.T) {
			e.ClaimedModel = label
			data := strings.ReplaceAll(string(wireResult(e)), "model-a", label)
			r, err := projectResult([]byte(data), e, strings.Repeat("b", 64))
			if err != nil || r.Validate() != nil || r.Prediction != label || r.Assessment != "matched" {
				t.Fatalf("safe worker model label rejected or assessment incorrect: %v", err)
			}
			e.ClaimedModel = "absent-model"
			r, err = projectResult([]byte(data), e, strings.Repeat("b", 64))
			if err != nil || r.Assessment != "inconclusive" {
				t.Fatal("absent custom model claim changed assessment")
			}
		})
	}
}

func TestWorkerProjectionRejectsMalformed(t *testing.T) {
	e := validEvidence()
	data := string(wireResult(e))
	for _, text := range []string{
		`{`, data + "{}",
		strings.Replace(data, `"schema_version":1`, `"schema_version":2`, 1),
		strings.Replace(data, `"schema_version":1`, `"schema_version":1,"raw_body":"omitted"`, 1),
		strings.Replace(data, `"schema_version":1`, `"schema_version":1,"schema_version":1`, 1),
		strings.Replace(data, e.BankRevision, strings.Repeat("c", 64), 1),
		strings.Replace(data, `"used_outputs":1`, `"used_outputs":2`, 1),
		strings.Replace(data, `"score":1`, `"score":1e999`, 1),
	} {
		if _, err := projectResult([]byte(text), e, strings.Repeat("b", 64)); err == nil {
			t.Error("malformed worker result accepted")
		}
	}
}

func TestWorkerProjectionRequiresMetrics(t *testing.T) {
	e := validEvidence()
	data := string(wireResult(e))
	for _, text := range []string{
		strings.Replace(data, `"score":1`, `"score":null`, 1),
		strings.Replace(data, `"score":1,`, ``, 1),
		strings.Replace(data, `"profile_similarity":0.8`, `"profile_similarity":null`, 1),
	} {
		if _, err := projectResult([]byte(text), e, strings.Repeat("b", 64)); err == nil {
			t.Error("worker missing metric accepted")
		}
	}
}

func TestWorkerProjectionRejectsJSONFieldAliases(t *testing.T) {
	e := validEvidence()
	data := string(wireResult(e))
	replacement := `[{"model":"model-a","family":"family-a","probability":0.95,"score":null,"profile_similarity":null},` +
		`{"model":"model-b","family":"family-b","probability":0.05}]`
	for _, tc := range []struct{ name, input string }{
		{"results_alias_null_missing_metrics", data[:len(data)-1] + `,"RESULTS":` + replacement + `}`},
		{"score_alias_null", strings.Replace(data, `"score":1`, `"score":1,"SCORE":null`, 1)},
		{"similarity_alias_null", strings.Replace(data, `"profile_similarity":0.8`, `"profile_similarity":0.8,"PROFILE_SIMILARITY":null`, 1)},
		{"family_probability_alias", strings.Replace(data, `"family":"family-a","probability":0.95}`, `"family":"family-a","probability":0.95,"Probability":0.95}`, 1)},
		{"schema_alias", data[:len(data)-1] + `,"SCHEMA_VERSION":1}`},
		{"opaque_field_alias", data[:len(data)-1] + `,"DIAGNOSTICS":{}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := projectResult([]byte(tc.input), e, strings.Repeat("b", 64)); err == nil {
				t.Fatal("worker JSON field alias admitted")
			}
		})
	}
	t.Run("canonical_opaque_content", func(t *testing.T) {
		input := strings.Replace(data, `"calibration":{"beta":1}`,
			`"calibration":{"Files":1,"files":2,"\u6a21":3,"nested":[{"SCORE":null}]}`, 1)
		r, err := projectResult([]byte(input), e, strings.Repeat("b", 64))
		if err != nil || r.Validate() != nil {
			t.Fatal("canonical worker with opaque content rejected")
		}
	})
}
