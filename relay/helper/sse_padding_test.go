package helper

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"

	"github.com/gin-gonic/gin"
)

// TestAnthropicSSEPaddingIsVariableSpacesOnly verifies that, with normalization
// enabled, the padding is composed only of ASCII spaces, stays within
// [0, anthropicSSEPaddingMax], and is not a fixed/predictable length across
// many invocations (R3.1/R3.4).
func TestAnthropicSSEPaddingIsVariableSpacesOnly(t *testing.T) {
	old := constant.AnthropicResponseNormalize
	constant.AnthropicResponseNormalize = true
	defer func() { constant.AnthropicResponseNormalize = old }()

	seen := make(map[int]bool)
	for i := 0; i < 2000; i++ {
		p := anthropicSSEPadding()
		if len(p) > anthropicSSEPaddingMax {
			t.Fatalf("padding length %d exceeds max %d", len(p), anthropicSSEPaddingMax)
		}
		if strings.Trim(p, " ") != "" {
			t.Fatalf("padding must contain only ASCII spaces, got %q", p)
		}
		seen[len(p)] = true
	}
	if len(seen) < 2 {
		t.Fatalf("padding length never varied across 2000 calls (got lengths %v); fixed padding is no padding (R3.4)", seen)
	}
}

// TestAnthropicSSEPaddingDisabled verifies the rollback path: with the switch
// off, no padding is ever emitted so the wire format is unchanged (R3.3).
func TestAnthropicSSEPaddingDisabled(t *testing.T) {
	old := constant.AnthropicResponseNormalize
	constant.AnthropicResponseNormalize = false
	defer func() { constant.AnthropicResponseNormalize = old }()

	for i := 0; i < 100; i++ {
		if p := anthropicSSEPadding(); p != "" {
			t.Fatalf("expected no padding when normalize disabled, got %q", p)
		}
	}
}

// TestAnthropicSSEPaddingJSONStillParses verifies that a JSON payload with the
// padding appended (after the value, before the newline) still unmarshals
// cleanly once the trailing whitespace is present — i.e. the padding is
// JSON-insignificant (R3.2).
func TestAnthropicSSEPaddingJSONStillParses(t *testing.T) {
	old := constant.AnthropicResponseNormalize
	constant.AnthropicResponseNormalize = true
	defer func() { constant.AnthropicResponseNormalize = old }()

	const payload = `{"type":"message_start","message":{"id":"msg_01abc"}}`
	for i := 0; i < 500; i++ {
		line := payload + anthropicSSEPadding()
		var v map[string]any
		if err := json.Unmarshal([]byte(line), &v); err != nil {
			t.Fatalf("padded JSON line failed to parse: %q err=%v", line, err)
		}
	}
}

// TestClaudeChunkDataPadsDataLineOnly drives ClaudeChunkData and asserts the
// rendered SSE block has padding only on the data: line (trailing spaces before
// its newline) and never on the event: line.
func TestClaudeChunkDataPadsDataLineOnly(t *testing.T) {
	old := constant.AnthropicResponseNormalize
	constant.AnthropicResponseNormalize = true
	defer func() { constant.AnthropicResponseNormalize = old }()

	const payload = `{"type":"content_block_delta"}`
	sawPadded := false
	sawUnpadded := false

	for i := 0; i < 200; i++ {
		rec := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(rec)
		ClaudeChunkData(c, dto.ClaudeResponse{Type: "content_block_delta"}, payload)

		out := rec.Body.String()
		lines := strings.Split(out, "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "event:") {
				if line != "event: content_block_delta" {
					t.Fatalf("event line must not be padded, got %q", line)
				}
			}
			if strings.HasPrefix(line, "data:") {
				if !strings.HasPrefix(line, "data: "+payload) {
					t.Fatalf("data line lost its payload prefix: %q", line)
				}
				trailing := strings.TrimPrefix(line, "data: "+payload)
				if strings.Trim(trailing, " ") != "" {
					t.Fatalf("data line trailing must be spaces only, got %q", trailing)
				}
				if len(trailing) == 0 {
					sawUnpadded = true
				} else {
					sawPadded = true
				}
				// the JSON before the padding must still parse
				var v map[string]any
				if err := json.Unmarshal([]byte(payload), &v); err != nil {
					t.Fatalf("payload not valid JSON: %v", err)
				}
			}
		}
	}

	if !sawPadded {
		t.Fatalf("ClaudeChunkData never emitted padded data lines across 200 runs")
	}
	// random 0..15 makes the zero-length case appear with high probability; if it
	// never showed up across 200 runs the range is suspicious but not fatal, so
	// only log.
	if !sawUnpadded {
		t.Logf("note: zero-padding case did not occur in 200 runs (expected ~1/16 each)")
	}
}

// TestClaudeChunkDataNoPaddingWhenDisabled verifies the data line carries no
// trailing spaces when the switch is off.
func TestClaudeChunkDataNoPaddingWhenDisabled(t *testing.T) {
	old := constant.AnthropicResponseNormalize
	constant.AnthropicResponseNormalize = false
	defer func() { constant.AnthropicResponseNormalize = old }()

	const payload = `{"type":"content_block_delta"}`
	for i := 0; i < 50; i++ {
		rec := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(rec)
		ClaudeChunkData(c, dto.ClaudeResponse{Type: "content_block_delta"}, payload)

		for _, line := range strings.Split(rec.Body.String(), "\n") {
			if strings.HasPrefix(line, "data:") && line != "data: "+payload {
				t.Fatalf("expected unpadded data line %q, got %q", "data: "+payload, line)
			}
		}
	}
}
