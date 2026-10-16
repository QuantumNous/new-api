package modeltraceapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"time"
	"unicode/utf8"

	"smart-router/api"
	"smart-router/modeltrace"
)

const MaxBodyBytes = 256 << 10

var ErrInvalidRecord = errors.New("modeltrace: invalid record")
var opaqueID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
var digestPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

type Backend interface {
	Submit(context.Context, modeltrace.Evidence) (modeltrace.Record, error)
	GetProbe(context.Context, string) (modeltrace.Record, error)
	LatestAttribution(context.Context, string, string, api.Protocol) (modeltrace.Record, error)
}

type Record struct {
	ProbeID        string             `json:"probe_id"`
	BindingID      string             `json:"binding_id"`
	ClaimedModel   string             `json:"claimed_model"`
	Protocol       api.Protocol       `json:"protocol"`
	EvidenceSHA256 string             `json:"evidence_sha256"`
	State          modeltrace.State   `json:"state"`
	ObservedAt     time.Time          `json:"observed_at"`
	Result         *modeltrace.Result `json:"result"`
	ErrorCode      string             `json:"error_code"`
}

func DecodeEvidence(data []byte) (modeltrace.Evidence, error) {
	var evidence modeltrace.Evidence
	if len(data) > MaxBodyBytes || json.Unmarshal(data, &evidence) != nil || evidence.Validate() != nil {
		return modeltrace.Evidence{}, modeltrace.ErrInvalidEvidence
	}
	return evidence, nil
}

func (r Record) Validate() error {
	numbers := make([]int, 80)
	for i := range numbers {
		numbers[i] = 1
	}
	identity := modeltrace.Evidence{
		SchemaVersion: 1, ProbeID: r.ProbeID, BindingID: r.BindingID, ClaimedModel: r.ClaimedModel,
		Protocol: r.Protocol, BankRevision: "0000000000000000000000000000000000000000000000000000000000000000",
		Samples: []modeltrace.Sample{{ChallengeID: "identity", ExpectedCount: 80, Numbers: numbers}},
	}
	if identity.Validate() != nil || !digestPattern.MatchString(r.EvidenceSHA256) ||
		r.ObservedAt.IsZero() || !time.Unix(0, r.ObservedAt.UnixNano()).Equal(r.ObservedAt) {
		return ErrInvalidRecord
	}
	switch r.State {
	case modeltrace.StateRunning:
		if r.Result != nil || r.ErrorCode != "" {
			return ErrInvalidRecord
		}
	case modeltrace.StateSucceeded:
		if r.Result == nil || r.ErrorCode != "" || r.Result.Validate() != nil ||
			r.Result.Assessment != modeltrace.Assess(r.ClaimedModel, *r.Result, 0) {
			return ErrInvalidRecord
		}
	case modeltrace.StateCancelled:
		if r.Result != nil || r.ErrorCode != "cancelled" {
			return ErrInvalidRecord
		}
	case modeltrace.StateFailed:
		if r.Result != nil {
			return ErrInvalidRecord
		}
		switch r.ErrorCode {
		case "deadline_exceeded", "execution_failed", "configuration_invalid", "integrity_failed", "process_limit", "invalid_result", "interrupted":
		default:
			return ErrInvalidRecord
		}
	default:
		return ErrInvalidRecord
	}
	return nil
}

func EncodeRecord(source modeltrace.Record) ([]byte, error) {
	r := Record{source.ProbeID, source.BindingID, source.ClaimedModel, source.Protocol,
		source.EvidenceSHA256, source.State, source.ObservedAt.UTC(), source.Result, source.ErrorCode}
	if r.Result != nil {
		result := *r.Result
		result.Models = append([]modeltrace.ModelScore(nil), result.Models...)
		result.Families = append([]modeltrace.FamilyScore(nil), result.Families...)
		r.Result = &result
	}
	if r.Validate() != nil {
		return nil, ErrInvalidRecord
	}
	data, err := json.Marshal(r)
	if err != nil || len(data) > MaxBodyBytes {
		return nil, ErrInvalidRecord
	}
	return data, nil
}

func DecodeRecord(data []byte) (Record, error) {
	var r Record
	if len(data) > MaxBodyBytes || !utf8.Valid(data) {
		return r, ErrInvalidRecord
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	start, err := decoder.Token()
	if err != nil || start != json.Delim('{') {
		return r, ErrInvalidRecord
	}
	allowed := map[string]bool{"probe_id": true, "binding_id": true, "claimed_model": true, "protocol": true,
		"evidence_sha256": true, "state": true, "observed_at": true, "result": true, "error_code": true}
	seen := make(map[string]bool)
	for decoder.More() {
		token, err := decoder.Token()
		name, ok := token.(string)
		if err != nil || !ok || !allowed[name] || seen[name] {
			return r, ErrInvalidRecord
		}
		seen[name] = true
		var value json.RawMessage
		if decoder.Decode(&value) != nil || (name != "result" && bytes.Equal(bytes.TrimSpace(value), []byte("null"))) {
			return r, ErrInvalidRecord
		}
	}
	if _, err := decoder.Token(); err != nil || len(seen) != len(allowed) {
		return r, ErrInvalidRecord
	}
	if _, err := decoder.Token(); err != io.EOF {
		return r, ErrInvalidRecord
	}
	if json.Unmarshal(data, &r) != nil || r.Validate() != nil {
		return Record{}, ErrInvalidRecord
	}
	return r, nil
}
