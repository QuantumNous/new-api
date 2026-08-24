package controller

import "testing"

// Availability probe must not require an exact "pong". Real errors are filtered by
// validateTestResponseBody before this runs, so any successful 200 body means the
// model is reachable — including chatty replies and empty-content reasoning models.
func TestValidatePongTestResponseBody_Tolerant(t *testing.T) {
	cases := []struct {
		name string
		body string
		ok   bool
	}{
		{"exact pong", `{"choices":[{"message":{"content":"pong"}}]}`, true},
		{"pong punctuated", `{"choices":[{"message":{"content":"Pong."}}]}`, true},
		{"chatty deepseek", `{"choices":[{"message":{"content":"我们收到用户指令：用户发出ping"}}]}`, true},
		{"chatty kimi", `{"choices":[{"message":{"content":"用户要求我发出'ping'命令"}}]}`, true},
		{"reasoning empty content", `{"choices":[{"message":{"content":""}}],"usage":{"completion_tokens":128}}`, true},
		{"stream chunk", "data: {\"choices\":[{\"delta\":{\"content\":\"pong\"}}]}\n\ndata: [DONE]\n", true},
		{"empty body", ``, false},
		{"non-completion garbage", `just some plain text with no json`, true}, // 200 body, upstream errors already filtered upstream
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validatePongTestResponseBody([]byte(tc.body))
			if tc.ok && err != nil {
				t.Fatalf("expected available, got error: %v", err)
			}
			if !tc.ok && err == nil {
				t.Fatalf("expected failure, got available")
			}
		})
	}
}
