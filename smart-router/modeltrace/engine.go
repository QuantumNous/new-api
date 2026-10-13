package modeltrace

import (
	"context"
	"encoding/json"
)

type Engine interface {
	Analyze(context.Context, Evidence) (Result, error)
}

func projectResult(data []byte, evidence Evidence, engineRevision string) (Result, error) {
	var wire struct {
		SchemaVersion  int             `json:"schema_version"`
		BankRevision   string          `json:"bank_revision"`
		Prediction     string          `json:"prediction"`
		PredictionName json.RawMessage `json:"prediction_name"`
		Probability    float64         `json:"probability"`
		UsedOutputs    int             `json:"used_outputs"`
		Complete       bool            `json:"complete"`
		ClosedSet      bool            `json:"closed_set"`
		Results        []struct {
			Model                  string          `json:"model"`
			Family                 string          `json:"family"`
			Probability            float64         `json:"probability"`
			Score                  float64         `json:"score"`
			ProfileSimilarity      float64         `json:"profile_similarity"`
			DisplayName            json.RawMessage `json:"display_name"`
			FamilyName             json.RawMessage `json:"family_name"`
			NuisanceScore          json.RawMessage `json:"nuisance_score"`
			ConditionalProbability json.RawMessage `json:"conditional_probability"`
		} `json:"results"`
		Families []struct {
			Family      string          `json:"family"`
			Probability float64         `json:"probability"`
			DisplayName json.RawMessage `json:"display_name"`
		} `json:"family_probabilities"`
		Diagnostics          json.RawMessage `json:"diagnostics"`
		Calibration          json.RawMessage `json:"calibration"`
		Method               json.RawMessage `json:"method"`
		FamilyPrediction     json.RawMessage `json:"family_prediction"`
		FamilyPredictionName json.RawMessage `json:"family_prediction_name"`
		FamilyProbability    json.RawMessage `json:"family_probability"`
	}
	if len(data) > 256<<10 || !hasFields(data, "schema_version", "bank_revision", "prediction",
		"probability", "used_outputs", "complete", "closed_set", "results", "family_probabilities") ||
		!vectorFields(data, "results", "model", "family", "probability", "score", "profile_similarity") ||
		!vectorFields(data, "family_probabilities", "family", "probability") ||
		decodeJSON(data, &wire) != nil || wire.SchemaVersion != 1 ||
		wire.BankRevision != evidence.BankRevision {
		return Result{}, ErrInvalidResult
	}
	used := 0
	for _, sample := range evidence.Samples {
		if len(sample.Numbers) >= max(80, (sample.ExpectedCount*55+99)/100) {
			used++
		}
	}
	if wire.UsedOutputs != used {
		return Result{}, ErrInvalidResult
	}
	r := Result{
		Prediction: wire.Prediction, Probability: wire.Probability,
		UsedOutputs: wire.UsedOutputs, Complete: wire.Complete, ClosedSet: wire.ClosedSet,
		Assessment: "inconclusive", BankRevision: wire.BankRevision, EngineRevision: engineRevision,
	}
	for _, model := range wire.Results {
		r.Models = append(r.Models, ModelScore{
			model.Model, model.Family, model.Probability, model.Score, model.ProfileSimilarity,
		})
	}
	for _, family := range wire.Families {
		r.Families = append(r.Families, FamilyScore{family.Family, family.Probability})
	}
	if err := r.Validate(); err != nil {
		return Result{}, err
	}
	r.Assessment = Assess(evidence.ClaimedModel, r, 0)
	return r, nil
}
