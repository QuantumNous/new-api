package dto

import "encoding/json"

// MarshalJSON drops the "function" object for tools that do not carry one.
//
// encoding/json ignores omitempty on struct fields, so a custom tool and a
// custom tool call would otherwise be sent as
// {"type":"custom","function":{"name":""},...} and rejected by upstreams that
// validate the tool shape.
func (t ToolCallRequest) MarshalJSON() ([]byte, error) {
	type wireToolCallRequest struct {
		ID       string           `json:"id,omitempty"`
		Type     string           `json:"type"`
		Function *FunctionRequest `json:"function,omitempty"`
		Custom   json.RawMessage  `json:"custom,omitempty"`
	}
	wire := wireToolCallRequest{ID: t.ID, Type: t.Type, Custom: t.Custom}
	hasFunction := t.Function.Name != "" ||
		t.Function.Description != "" ||
		t.Function.Arguments != "" ||
		t.Function.Parameters != nil
	if t.Type == "" || t.Type == "function" || hasFunction {
		function := t.Function
		wire.Function = &function
	}
	return json.Marshal(wire)
}
