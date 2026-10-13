package modeltrace

import (
	"encoding/json"
	"errors"
	"math"
	"unicode/utf8"
)

var ErrInvalidResult = errors.New("invalid modeltrace result")

type ModelScore struct {
	Model             string  `json:"model"`
	Family            string  `json:"family"`
	Probability       float64 `json:"probability"`
	Score             float64 `json:"score"`
	ProfileSimilarity float64 `json:"profile_similarity"`
}

type FamilyScore struct {
	Family      string  `json:"family"`
	Probability float64 `json:"probability"`
}

type Result struct {
	Prediction     string        `json:"prediction"`
	Probability    float64       `json:"probability"`
	UsedOutputs    int           `json:"used_outputs"`
	Complete       bool          `json:"complete"`
	ClosedSet      bool          `json:"closed_set"`
	Assessment     string        `json:"assessment"`
	BankRevision   string        `json:"bank_revision"`
	EngineRevision string        `json:"engine_revision"`
	Models         []ModelScore  `json:"models"`
	Families       []FamilyScore `json:"families"`
}

func (r Result) Validate() error {
	if !safeModelLabel(r.Prediction) || !probability(r.Probability) ||
		r.UsedOutputs < 1 || r.UsedOutputs > 3 || r.Complete != (r.UsedOutputs == 3) ||
		!r.ClosedSet || !revisionPattern.MatchString(r.BankRevision) ||
		!revisionPattern.MatchString(r.EngineRevision) ||
		len(r.Models) < 1 || len(r.Models) > 256 || len(r.Families) < 1 || len(r.Families) > 32 {
		return ErrInvalidResult
	}
	switch r.Assessment {
	case "inconclusive":
	case "matched", "mismatched":
		if !r.Complete || r.UsedOutputs != 3 {
			return ErrInvalidResult
		}
	default:
		return ErrInvalidResult
	}
	seen := make(map[string]bool)
	families := make(map[string]float64)
	total := 0.0
	for i, model := range r.Models {
		if !safeModelLabel(model.Model) || !labelPattern.MatchString(model.Family) ||
			seen[model.Model] || !probability(model.Probability) || !finite(model.Score) ||
			!finite(model.ProfileSimilarity) ||
			(i > 0 && model.Probability > r.Models[i-1].Probability) {
			return ErrInvalidResult
		}
		seen[model.Model] = true
		total += model.Probability
		families[model.Family] += model.Probability
	}
	if math.Abs(total-1) > 1e-9 || r.Prediction != r.Models[0].Model ||
		math.Abs(r.Probability-r.Models[0].Probability) > 1e-9 || len(families) != len(r.Families) {
		return ErrInvalidResult
	}
	seen = make(map[string]bool)
	total = 0
	for _, family := range r.Families {
		sum, exists := families[family.Family]
		if !exists || seen[family.Family] || !labelPattern.MatchString(family.Family) ||
			!probability(family.Probability) || math.Abs(sum-family.Probability) > 1e-9 {
			return ErrInvalidResult
		}
		seen[family.Family] = true
		total += family.Probability
	}
	if math.Abs(total-1) > 1e-9 {
		return ErrInvalidResult
	}
	return nil
}

func finite(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

func probability(value float64) bool { return finite(value) && value >= 0 && value <= 1 }

func (r *Result) UnmarshalJSON(data []byte) error {
	type plain Result
	var value plain
	if len(data) > 256<<10 || !utf8.Valid(data) || !hasFields(data, "prediction", "probability", "used_outputs",
		"complete", "closed_set", "assessment", "bank_revision", "engine_revision", "models", "families") ||
		!vectorFields(data, "models", "model", "family", "probability", "score", "profile_similarity") ||
		!vectorFields(data, "families", "family", "probability") || decodeJSON(data, &value) != nil {
		return ErrInvalidResult
	}
	*r = Result(value)
	return nil
}

func vectorFields(data []byte, key string, fields ...string) bool {
	var object map[string]json.RawMessage
	if json.Unmarshal(data, &object) != nil {
		return false
	}
	var entries []json.RawMessage
	if json.Unmarshal(object[key], &entries) != nil || len(entries) == 0 {
		return false
	}
	for _, entry := range entries {
		if !hasFields(entry, fields...) {
			return false
		}
	}
	return true
}

// Assessment is diagnostic only; it does not confer routing authority.
func Assess(claimed string, result Result, threshold float64) string {
	if threshold == 0 {
		threshold = .90
	}
	if !probability(threshold) || !safeModelLabel(claimed) ||
		result.Validate() != nil || !result.Complete || result.Probability < threshold {
		return "inconclusive"
	}
	present := false
	for _, model := range result.Models {
		present = present || model.Model == claimed
	}
	if !present {
		return "inconclusive"
	}
	if result.Prediction == claimed {
		return "matched"
	}
	return "mismatched"
}
