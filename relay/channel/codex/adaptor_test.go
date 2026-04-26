package codex

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestNormalizeCodexResponsesInput_BareStringWrapsAsUserMessage(t *testing.T) {
	in := json.RawMessage(`"hello world"`)
	out, err := normalizeCodexResponsesInput(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	var items []map[string]string
	if err := common.Unmarshal(out, &items); err != nil {
		t.Fatalf("expected JSON array, got %s (err=%v)", out, err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if items[0]["role"] != "user" || items[0]["content"] != "hello world" {
		t.Fatalf("unexpected wrapped item: %+v", items[0])
	}
}

func TestNormalizeCodexResponsesInput_FunctionCallStringStays(t *testing.T) {
	in := json.RawMessage(`[{"type":"function_call","arguments":"{\"path\":\"/etc\"}"}]`)
	out, err := normalizeCodexResponsesInput(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(string(out), `"arguments":"{\"path\":\"/etc\"}"`) {
		t.Fatalf("expected function_call.arguments to remain a string, got %s", out)
	}
}

func TestNormalizeCodexResponsesInput_ToolSearchCallStringToObject(t *testing.T) {
	in := json.RawMessage(`[{"type":"tool_search_call","arguments":"{\"query\":\"hello\"}"}]`)
	out, err := normalizeCodexResponsesInput(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(string(out), `"arguments":{"query":"hello"}`) {
		t.Fatalf("expected tool_search_call.arguments to become an object, got %s", out)
	}
}

func TestNormalizeCodexResponsesInput_ToolSearchCallObjectStays(t *testing.T) {
	in := json.RawMessage(`[{"type":"tool_search_call","arguments":{"query":"hi"}}]`)
	out, err := normalizeCodexResponsesInput(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(string(out), `"arguments":{"query":"hi"}`) {
		t.Fatalf("expected object to remain object, got %s", out)
	}
}

func TestNormalizeCodexResponsesInput_OtherObjectArgItemTypes(t *testing.T) {
	cases := []struct {
		typ string
	}{
		{"web_search_call"},
		{"file_search_call"},
		{"local_shell_call"},
		{"computer_call"},
		{"image_generation_call"},
		{"code_interpreter_call"},
		{"mcp_call"},
	}
	for _, tc := range cases {
		t.Run(tc.typ, func(t *testing.T) {
			in := json.RawMessage(`[{"type":"` + tc.typ + `","arguments":"{\"a\":1}"}]`)
			out, err := normalizeCodexResponsesInput(in)
			if err != nil {
				t.Fatalf("err: %v", err)
			}
			if !strings.Contains(string(out), `"arguments":{"a":1}`) {
				t.Fatalf("expected %s.arguments to become object, got %s", tc.typ, out)
			}
		})
	}
}

func TestNormalizeCodexResponsesInput_MixedArrayHandlesEachItemType(t *testing.T) {
	in := json.RawMessage(`[` +
		`{"type":"function_call","arguments":"{\"k\":1}"},` +
		`{"type":"tool_search_call","arguments":"{\"k\":2}"},` +
		`{"type":"message","role":"user","content":"hi"}` +
		`]`)
	out, err := normalizeCodexResponsesInput(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	s := string(out)
	if !strings.Contains(s, `"arguments":"{\"k\":1}"`) {
		t.Fatalf("function_call.arguments should remain string, got %s", s)
	}
	if !strings.Contains(s, `"arguments":{"k":2}`) {
		t.Fatalf("tool_search_call.arguments should become object, got %s", s)
	}
	if !strings.Contains(s, `"role":"user"`) {
		t.Fatalf("message item should be preserved, got %s", s)
	}
}

func TestNormalizeCodexResponsesInput_EmptyOrNilStaysSame(t *testing.T) {
	for _, in := range []json.RawMessage{nil, []byte(""), []byte("   ")} {
		out, err := normalizeCodexResponsesInput(in)
		if err != nil {
			t.Fatalf("err: %v", err)
		}
		if len(out) > 0 && strings.TrimSpace(string(out)) != "" {
			t.Fatalf("expected empty pass-through, got %q", out)
		}
	}
}

func TestNormalizeCodexResponsesInput_ObjectInputPassesThrough(t *testing.T) {
	// The Responses API spec allows `input` to be a string or an array of
	// items. A bare object is non-conforming client input; the relay should
	// not silently rewrite it. Pass it through verbatim and let the upstream
	// surface the actual error.
	in := json.RawMessage(`{"unexpected":"shape"}`)
	out, err := normalizeCodexResponsesInput(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if string(out) != string(in) {
		t.Fatalf("expected verbatim pass-through, got %s", out)
	}
}

func TestNormalizeCodexResponsesInput_NullArgumentsBecomesEmptyObject(t *testing.T) {
	// Whitelisted item types should never carry a JSON `null` arguments
	// upstream; turn it into an empty object so the upstream schema check
	// always sees an object shape.
	in := json.RawMessage(`[{"type":"tool_search_call","arguments":null}]`)
	out, err := normalizeCodexResponsesInput(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(string(out), `"arguments":{}`) {
		t.Fatalf("expected null -> {}, got %s", out)
	}
}

func TestNormalizeCodexResponsesInput_FunctionCallObjectPassesThrough(t *testing.T) {
	// function_call with object-shaped arguments is non-conforming client
	// input. The relay does not "fix" it because the spec is clear that
	// function_call.arguments must be a string. Let the upstream reject it.
	in := json.RawMessage(`[{"type":"function_call","arguments":{"k":1}}]`)
	out, err := normalizeCodexResponsesInput(in)
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if !strings.Contains(string(out), `"arguments":{"k":1}`) {
		t.Fatalf("expected verbatim object pass-through (no relay-side fix), got %s", out)
	}
}

func TestParseStringArgsToObject(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{name: "empty", in: "", want: `{}`},
		{name: "valid object", in: `{"a":1}`, want: `{"a":1}`},
		{name: "valid array", in: `[1,2]`, want: `{"value":[1,2]}`},
		{name: "valid scalar", in: `42`, want: `{"value":42}`},
		{name: "invalid json wraps as value", in: `not-json`, want: `{"value":"not-json"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := parseStringArgsToObject(tc.in)
			b, err := common.Marshal(got)
			if err != nil {
				t.Fatalf("Marshal: %v", err)
			}
			if string(b) != tc.want {
				t.Fatalf("got %s want %s", b, tc.want)
			}
		})
	}
}
