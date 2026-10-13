package modeltrace

import (
	"encoding/json"
	"strings"
	"testing"

	"smart-router/api"
)

func validEvidence() Evidence {
	numbers := make([]int, 80)
	for i := range numbers {
		numbers[i] = i%355 + 1
	}
	return Evidence{1, "probe-1", "bnd_AAAAAAAAAAAAAAAAAAAAAAAA", "model-a",
		api.ProtocolChat, strings.Repeat("a", 64), []Sample{{"slot-1", 0, numbers}}}
}

func modelLabelCases() []struct {
	name, label string
	valid       bool
} {
	return []struct {
		name, label string
		valid       bool
	}{
		{"ascii", "model-a", true},
		{"slash", "org/model-0", true},
		{"unicode", "org/\u6a21\u578b", true},
		{"prefix", "_model.v1", true},
		{"spaces", "Model Version 1", true},
		{"safe_word_prefix", "Tokenizer Models", true},
		{"unicode_word_boundary", "\u6a21token\u578b", true},
		{"ascii_256", strings.Repeat("a", 256), true},
		{"unicode_256", strings.Repeat("\u6a21", 256), true},
		{"utf8_1024", strings.Repeat("\U00020000", 256), true},
		{"empty", "", false},
		{"blank", "   ", false},
		{"unicode_blank", "\u2003\u00a0", false},
		{"ascii_257", strings.Repeat("a", 257), false},
		{"unicode_257", strings.Repeat("\u6a21", 257), false},
		{"utf8_1028", strings.Repeat("\U00020000", 257), false},
		{"invalid_utf8", "model-\xff", false},
		{"newline", "org/model\n", false},
		{"control", "model\x00", false},
		{"delete", "model\x7f", false},
		{"url", "https://provider.invalid/model", false},
		{"url_scheme", "CUSTOM://model", false},
		{"auth_prefix", "AuThOrIzAtIoN: sentinel", false},
		{"bearer_prefix", "BeArEr sentinel", false},
		{"query_key", "org/model?api_key=sentinel", false},
		{"query_token", "org/model?token=sentinel", false},
		{"secret", "client_secret", false},
		{"password", "PASSWORD", false},
		{"credential", "service credential", false},
	}
}

func TestEvidenceSafeModelLabels(t *testing.T) {
	for _, tc := range modelLabelCases() {
		t.Run(tc.name, func(t *testing.T) {
			e := validEvidence()
			e.ClaimedModel = tc.label
			if err := e.Validate(); (err == nil) != tc.valid {
				t.Errorf("safe model label admission: valid=%t, error=%v", tc.valid, err)
			}
			if !tc.valid {
				return
			}
			first, err := e.Digest()
			if err != nil {
				t.Fatalf("safe model label digest rejected: %v", err)
			}
			data, err := json.Marshal(e)
			if err != nil {
				t.Fatal(err)
			}
			var decoded Evidence
			if err := json.Unmarshal(data, &decoded); err != nil || decoded.Validate() != nil ||
				decoded.ClaimedModel != tc.label {
				t.Fatal("safe model label JSON round trip rejected or changed")
			}
			second, err := decoded.Digest()
			if err != nil || first != second {
				t.Fatal("safe model label digest changed after JSON round trip")
			}
			decoded.ClaimedModel += "x"
			changed, err := decoded.Digest()
			if len([]rune(tc.label)) < 256 && (err != nil || first == changed) {
				t.Fatal("claimed model absent from evidence digest")
			}
		})
	}
}

func TestEvidenceRejectsInvalidUTF8JSON(t *testing.T) {
	data, err := json.Marshal(validEvidence())
	if err != nil {
		t.Fatal(err)
	}
	data = []byte(strings.Replace(string(data), "model-a", "model-\xff", 1))
	var e Evidence
	if json.Unmarshal(data, &e) == nil {
		t.Fatal("invalid UTF-8 model label JSON admitted")
	}
}

func TestEvidenceRejectsNonOpaqueBinding(t *testing.T) {
	e := validEvidence()
	e.BindingID = "illegalbinding"
	if e.Validate() == nil {
		t.Fatal("non-opaque binding admitted")
	}
}

func TestEvidenceAdmissionBounds(t *testing.T) {
	cases := []struct {
		name string
		edit func(*Evidence)
	}{
		{"schema", func(e *Evidence) { e.SchemaVersion = 2 }},
		{"probe", func(e *Evidence) { e.ProbeID = "../probe" }},
		{"challenge", func(e *Evidence) { e.Samples[0].ChallengeID = "bad\nid" }},
		{"claim", func(e *Evidence) { e.ClaimedModel = "https://provider.invalid/model" }},
		{"protocol", func(e *Evidence) { e.Protocol = "unknown" }},
		{"revision", func(e *Evidence) { e.BankRevision = strings.Repeat("A", 64) }},
		{"empty", func(e *Evidence) { e.Samples = nil }},
		{"four", func(e *Evidence) {
			e.Samples = []Sample{{"a", 0, e.Samples[0].Numbers}, {"b", 0, nil}, {"c", 0, nil}, {"d", 0, nil}}
		}},
		{"duplicate", func(e *Evidence) { e.Samples = append(e.Samples, e.Samples[0]) }},
		{"negative_expected", func(e *Evidence) { e.Samples[0].ExpectedCount = -1 }},
		{"oversize_expected", func(e *Evidence) { e.Samples[0].ExpectedCount = 4097 }},
		{"oversize_numbers", func(e *Evidence) { e.Samples[0].Numbers = make([]int, 4097) }},
		{"zero_number", func(e *Evidence) { e.Samples[0].Numbers[0] = 0 }},
		{"oversize_number", func(e *Evidence) { e.Samples[0].Numbers[0] = 356 }},
		{"all_invalid", func(e *Evidence) { e.Samples[0].Numbers = e.Samples[0].Numbers[:79] }},
		{"ceil_threshold", func(e *Evidence) {
			e.Samples[0].ExpectedCount = 147
			e.Samples[0].Numbers = e.Samples[0].Numbers[:80]
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			e := validEvidence()
			tc.edit(&e)
			if e.Validate() == nil {
				t.Fatal("invalid evidence admitted")
			}
		})
	}
}

func TestEvidenceAllowsPartialSamplesAndInclusiveBounds(t *testing.T) {
	e := validEvidence()
	e.Samples = append(e.Samples, Sample{"slot-2", 4096, []int{1, 355}})
	if err := e.Validate(); err != nil {
		t.Fatal("one valid output with a short output rejected")
	}
	e.Samples[0].ExpectedCount = 147
	e.Samples[0].Numbers = append(e.Samples[0].Numbers, 355)
	if err := e.Validate(); err != nil {
		t.Fatal("ceil threshold rejected")
	}
	e.Samples[1].Numbers = make([]int, 4096)
	for i := range e.Samples[1].Numbers {
		e.Samples[1].Numbers[i] = 355
	}
	if err := e.Validate(); err != nil {
		t.Fatal("inclusive upper bounds rejected")
	}
}

func TestBankRevisionChangesEvidenceDigest(t *testing.T) {
	e := validEvidence()
	first, err := e.Digest()
	if err != nil || !revisionPattern.MatchString(first) {
		t.Fatal("digest is not canonical SHA-256")
	}
	second, _ := e.Digest()
	if first != second {
		t.Fatal("digest is not stable")
	}
	e.BankRevision = strings.Repeat("b", 64)
	changed, _ := e.Digest()
	if first == changed {
		t.Fatal("bank revision absent from digest")
	}
	e.BindingID = "bad"
	if _, err := e.Digest(); err == nil {
		t.Fatal("invalid evidence hashed")
	}
}

func TestEvidenceStrictJSONAdmission(t *testing.T) {
	data, _ := json.Marshal(validEvidence())
	text := string(data)
	cases := []string{
		text + "{}",
		strings.Replace(text, `"schema_version":1`, `"schema_version":1,"raw":"forbidden"`, 1),
		strings.Replace(text, `"expected_count":0`, `"expected_count":0.5`, 1),
		strings.Replace(text, `"schema_version":1`, `"schema_version":1,"schema_version":1`, 1),
	}
	for i, input := range cases {
		var e Evidence
		if api.DecodeStrict(strings.NewReader(input), &e) == nil {
			t.Fatalf("invalid JSON case %d admitted", i)
		}
	}
	var e Evidence
	if api.DecodeStrict(strings.NewReader(text), &e) != nil {
		t.Fatal("valid JSON rejected")
	}
}

func TestEvidenceRejectsJSONFieldAliases(t *testing.T) {
	e := validEvidence()
	e.Samples = append(e.Samples, Sample{"empty", 0, []int{}})
	data, err := json.Marshal(e)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	cases := []struct {
		name, input string
		valid       bool
	}{
		{"canonical_partial_empty", text, true},
		{"escaped_canonical_key", strings.Replace(text, `"claimed_model"`, `"claimed_\u006dodel"`, 1), true},
		{"canonical_null_numbers", strings.Replace(text, `"numbers":[]`, `"numbers":null`, 1), false},
		{"numbers_alias_null", strings.Replace(text, `"numbers":[]`, `"numbers":[],"NUMBERS":null`, 1), false},
		{"numbers_alias_only", strings.Replace(text, `"numbers":[]`, `"Numbers":[]`, 1), false},
		{"claim_alias_override", text[:len(text)-1] + `,"CLAIMED_MODEL":"model-b"}`, false},
		{"claim_alias_before_canonical", strings.Replace(text, `"claimed_model":`, `"Claimed_Model":"model-b","claimed_model":`, 1), false},
		{"sample_expected_alias_override", strings.Replace(text, `"expected_count":0`, `"expected_count":0,"EXPECTED_COUNT":1`, 1), false},
		{"sample_id_alias_override", strings.Replace(text, `"challenge_id":"empty"`, `"challenge_id":"empty","CHALLENGE_ID":"other"`, 1), false},
		{"samples_unicode_fold_alias", text[:len(text)-1] + `,"\u017famples":[]}`, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var decoded Evidence
			err := api.DecodeStrict(strings.NewReader(tc.input), &decoded)
			if (err == nil) != tc.valid {
				t.Fatalf("JSON field alias admission: want valid=%t, error=%v", tc.valid, err)
			}
			if tc.valid && (decoded.ClaimedModel != e.ClaimedModel || len(decoded.Samples) != 2 ||
				decoded.Samples[1].Numbers == nil || len(decoded.Samples[1].Numbers) != 0) {
				t.Fatal("canonical partial/empty evidence changed")
			}
		})
	}
}

func TestEvidenceJSONRejectsNullAndMissingSampleFields(t *testing.T) {
	data, _ := json.Marshal(validEvidence())
	for _, text := range []string{
		strings.Replace(string(data), `"expected_count":0`, `"expected_count":null`, 1),
		strings.Replace(string(data), `"expected_count":0,`, ``, 1),
		strings.Replace(string(data), `"numbers":[1,`, `"numbers":[null,`, 1),
	} {
		var e Evidence
		if api.DecodeStrict(strings.NewReader(text), &e) == nil {
			t.Error("non-integer or missing sample field admitted")
		}
	}
}

func TestDecodeJSONExactTypedKeys(t *testing.T) {
	type entry struct {
		Value int `json:"value,omitempty"`
	}
	type document struct {
		Entries map[string]*entry `json:"entries"`
		Rows    [1]entry          `json:"rows"`
		Opaque  *json.RawMessage  `json:"opaque"`
		Ignored int               `json:"-"`
		Default int
	}
	for _, tc := range []struct {
		name, input string
		valid       bool
	}{
		{"dynamic_unicode_case_keys", `{"entries":{"Files":{"value":1},"files":{"value":2},"\u6a21":{"value":3}},"rows":[{"value":4}],"Default":5}`, true},
		{"opaque_object", `{"opaque":{"Files":1,"files":2,"nested":[{"VALUE":null}]}}`, true},
		{"opaque_array", `{"opaque":[{"VALUE":null}]}`, true},
		{"null_controls", `{"entries":null,"opaque":null}`, true},
		{"map_entry_alias", `{"entries":{"Files":{"value":1,"VALUE":2}}}`, false},
		{"array_entry_alias", `{"rows":[{"value":1,"Value":2}]}`, false},
		{"untagged_alias", `{"default":1}`, false},
		{"ignored_field", `{"Ignored":1}`, false},
		{"nested_unknown", `{"entries":{"Files":{"other":1}}}`, false},
		{"escaped_duplicate", `{"entries":{"Files":{"value":1,"\u0076alue":2}}}`, false},
		{"opaque_duplicate", `{"opaque":{"Files":1,"Files":2}}`, false},
		{"trailing_value", `{} {}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var decoded document
			if err := decodeJSON([]byte(tc.input), &decoded); (err == nil) != tc.valid {
				t.Fatalf("exact typed key admission: want valid=%t, error=%v", tc.valid, err)
			}
			if tc.name == "dynamic_unicode_case_keys" &&
				(len(decoded.Entries) != 3 || decoded.Entries["Files"].Value != 1 ||
					decoded.Entries["files"].Value != 2 || decoded.Entries["\u6a21"].Value != 3 ||
					decoded.Rows[0].Value != 4 || decoded.Default != 5) {
				t.Fatal("dynamic keys or exact field values changed")
			}
		})
	}
}
