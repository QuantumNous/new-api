package model

import "testing"

func TestAttachLogEventMergesFields(t *testing.T) {
	other := map[string]interface{}{
		"admin_info": map[string]interface{}{"node_name": "n1"},
	}
	params := map[string]interface{}{
		"quota": 123,
	}

	merged := AttachLogEvent(other, LogEventTopupSuccess, params)

	if merged[LogEventCodeKey] != LogEventTopupSuccess {
		t.Fatalf("expected event code %q, got %v", LogEventTopupSuccess, merged[LogEventCodeKey])
	}
	if merged["admin_info"] == nil {
		t.Fatalf("expected original admin_info to be preserved")
	}
	eventParams, ok := merged[LogEventParamsKey].(map[string]interface{})
	if !ok {
		t.Fatalf("expected event params map, got %T", merged[LogEventParamsKey])
	}
	if eventParams["quota"] != 123 {
		t.Fatalf("expected quota param 123, got %v", eventParams["quota"])
	}
	if _, exists := other[LogEventCodeKey]; exists {
		t.Fatalf("expected source map to remain unchanged")
	}
}
