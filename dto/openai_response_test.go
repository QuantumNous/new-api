package dto

import (
	"encoding/json"
	"testing"
)

func TestResponsesOutputArgumentsAcceptsObject(t *testing.T) {
	var output ResponsesOutput
	err := json.Unmarshal([]byte(`{"type":"function_call","arguments":{"query":"hello","limit":3}}`), &output)
	if err != nil {
		t.Fatalf("Unmarshal ResponsesOutput failed: %v", err)
	}
	if got := output.Arguments.String(); got != `{"query":"hello","limit":3}` {
		t.Fatalf("unexpected arguments: %s", got)
	}
}

func TestResponsesOutputArgumentsAcceptsNull(t *testing.T) {
	var output ResponsesOutput
	err := json.Unmarshal([]byte(`{"type":"function_call","arguments":null}`), &output)
	if err != nil {
		t.Fatalf("Unmarshal ResponsesOutput failed: %v", err)
	}
	if got := output.Arguments.String(); got != "" {
		t.Fatalf("unexpected arguments: %s", got)
	}
}

func TestResponsesOutputArgumentsAcceptsArray(t *testing.T) {
	var output ResponsesOutput
	err := json.Unmarshal([]byte(`{"type":"function_call","arguments":["hello",3]}`), &output)
	if err != nil {
		t.Fatalf("Unmarshal ResponsesOutput failed: %v", err)
	}
	if got := output.Arguments.String(); got != `["hello",3]` {
		t.Fatalf("unexpected arguments: %s", got)
	}
}

func TestFunctionResponseArgumentsAcceptsString(t *testing.T) {
	var fn FunctionResponse
	err := json.Unmarshal([]byte(`{"name":"x","arguments":"{\"query\":\"hello\"}"}`), &fn)
	if err != nil {
		t.Fatalf("Unmarshal FunctionResponse failed: %v", err)
	}
	if got := fn.Arguments.String(); got != `{"query":"hello"}` {
		t.Fatalf("unexpected arguments: %s", got)
	}
}
