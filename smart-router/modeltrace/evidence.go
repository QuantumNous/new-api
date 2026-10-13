package modeltrace

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"reflect"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"smart-router/api"
)

var (
	ErrInvalidEvidence  = errors.New("invalid modeltrace evidence")
	idPattern           = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
	labelPattern        = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
	revisionPattern     = regexp.MustCompile(`^[0-9a-f]{64}$`)
	sensitiveModelLabel = regexp.MustCompile(`(?i)api[^\p{L}\p{N}]*key|authorization|bearer|secret|token|password|credential`)
)

// Model labels follow numeric-row bounds and bank-label safety, not path identity.
func safeModelLabel(label string) bool {
	if len(label) > 1024 || !utf8.ValidString(label) || utf8.RuneCountInString(label) > 256 ||
		strings.TrimSpace(label) == "" || strings.Contains(label, "://") {
		return false
	}
	lowered := strings.ToLower(label)
	if strings.HasPrefix(lowered, "authorization:") || strings.HasPrefix(lowered, "bearer ") {
		return false
	}
	for _, r := range label {
		if r < 32 || r == 127 {
			return false
		}
	}
	for _, span := range sensitiveModelLabel.FindAllStringIndex(label, -1) {
		before, _ := utf8.DecodeLastRuneInString(label[:span[0]])
		after, _ := utf8.DecodeRuneInString(label[span[1]:])
		if !unicode.IsLetter(before) && !unicode.IsNumber(before) &&
			!unicode.IsLetter(after) && !unicode.IsNumber(after) {
			return false
		}
	}
	return true
}

type Sample struct {
	ChallengeID   string `json:"challenge_id"`
	ExpectedCount int    `json:"expected_count"`
	Numbers       []int  `json:"numbers"`
}

func (s *Sample) UnmarshalJSON(data []byte) error {
	type plain Sample
	var value plain
	if !hasFields(data, "challenge_id", "expected_count", "numbers") || decodeJSON(data, &value) != nil {
		return ErrInvalidEvidence
	}
	*s = Sample(value)
	return nil
}

type Evidence struct {
	SchemaVersion int          `json:"schema_version"`
	ProbeID       string       `json:"probe_id"`
	BindingID     string       `json:"binding_id"`
	ClaimedModel  string       `json:"claimed_model"`
	Protocol      api.Protocol `json:"protocol"`
	BankRevision  string       `json:"bank_revision"`
	Samples       []Sample     `json:"samples"`
}

func (e Evidence) Validate() error {
	if api.ValidateBindingID(e.BindingID) != nil || e.SchemaVersion != 1 ||
		!idPattern.MatchString(e.ProbeID) || !safeModelLabel(e.ClaimedModel) ||
		!revisionPattern.MatchString(e.BankRevision) || len(e.Samples) < 1 || len(e.Samples) > 3 {
		return ErrInvalidEvidence
	}
	switch e.Protocol {
	case api.ProtocolChat, api.ProtocolResponses, api.ProtocolMessages, api.ProtocolTaskBridge:
	default:
		return ErrInvalidEvidence
	}
	seen := make(map[string]bool)
	valid := 0
	for _, s := range e.Samples {
		if !idPattern.MatchString(s.ChallengeID) || seen[s.ChallengeID] ||
			s.ExpectedCount < 0 || s.ExpectedCount > 4096 || len(s.Numbers) > 4096 {
			return ErrInvalidEvidence
		}
		seen[s.ChallengeID] = true
		for _, n := range s.Numbers {
			if n < 1 || n > 355 {
				return ErrInvalidEvidence
			}
		}
		if len(s.Numbers) >= max(80, (s.ExpectedCount*55+99)/100) {
			valid++
		}
	}
	if valid == 0 {
		return ErrInvalidEvidence
	}
	return nil
}

func (e Evidence) Digest() (string, error) {
	if err := e.Validate(); err != nil {
		return "", err
	}
	data, err := json.Marshal(e)
	if err != nil {
		return "", ErrInvalidEvidence
	}
	return digestBytes(data), nil
}

func digestBytes(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

func (e *Evidence) UnmarshalJSON(data []byte) error {
	type plain Evidence
	var value plain
	if len(data) > 256<<10 || !utf8.Valid(data) || !hasFields(data, "schema_version", "probe_id", "binding_id",
		"claimed_model", "protocol", "bank_revision", "samples") || decodeJSON(data, &value) != nil {
		return ErrInvalidEvidence
	}
	*e = Evidence(value)
	return nil
}

func hasFields(data []byte, fields ...string) bool {
	var object map[string]json.RawMessage
	if json.Unmarshal(data, &object) != nil {
		return false
	}
	for _, field := range fields {
		value, exists := object[field]
		if !exists || bytes.Equal(bytes.TrimSpace(value), []byte("null")) {
			return false
		}
	}
	return true
}

// Reject nonexact struct keys and duplicates before the typed decoder can overwrite them.
func decodeJSON(data []byte, dst any) error {
	d := json.NewDecoder(bytes.NewReader(data))
	if err := jsonValue(d, 0, reflect.TypeOf(dst)); err != nil {
		return err
	}
	if _, err := d.Token(); err != io.EOF {
		return ErrInvalidEvidence
	}
	d = json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	return d.Decode(dst)
}

func jsonValue(d *json.Decoder, depth int, expected reflect.Type) error {
	if depth > 64 {
		return ErrInvalidEvidence
	}
	for expected != nil && expected.Kind() == reflect.Pointer {
		expected = expected.Elem()
	}
	// Opaque JSON retains syntax/duplicate checks, without a struct-key whitelist.
	if expected == reflect.TypeOf(json.RawMessage{}) {
		expected = nil
	}
	token, err := d.Token()
	if err != nil {
		return ErrInvalidEvidence
	}
	delim, compound := token.(json.Delim)
	if !compound {
		return nil
	}
	switch delim {
	case '{':
		var fields map[string]reflect.Type
		var element reflect.Type
		if expected != nil {
			switch expected.Kind() {
			case reflect.Struct:
				fields = make(map[string]reflect.Type)
				for i := 0; i < expected.NumField(); i++ {
					field := expected.Field(i)
					name, _, _ := strings.Cut(field.Tag.Get("json"), ",")
					if field.PkgPath != "" || name == "-" {
						continue
					}
					if name == "" {
						name = field.Name
					}
					fields[name] = field.Type
				}
			case reflect.Map:
				element = expected.Elem()
			}
		}
		seen := make(map[string]bool)
		for d.More() {
			key, err := d.Token()
			name, ok := key.(string)
			if err != nil || !ok || seen[name] {
				return ErrInvalidEvidence
			}
			seen[name] = true
			child := element
			if fields != nil {
				var exists bool
				child, exists = fields[name]
				if !exists {
					return ErrInvalidEvidence
				}
			}
			if err := jsonValue(d, depth+1, child); err != nil {
				return err
			}
		}
	case '[':
		var element reflect.Type
		if expected != nil && (expected.Kind() == reflect.Slice || expected.Kind() == reflect.Array) {
			element = expected.Elem()
		}
		for d.More() {
			if err := jsonValue(d, depth+1, element); err != nil {
				return err
			}
		}
	default:
		return ErrInvalidEvidence
	}
	_, err = d.Token()
	return err
}
