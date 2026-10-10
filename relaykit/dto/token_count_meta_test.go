package dto

import (
	"testing"

	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Agent loops replay tool definitions, tool calls, and tool output on every
// turn; the prompt estimate must see all of them as the model reads them.
func TestTokenCountMetaCountsAgentLoopContent(t *testing.T) {
	const toolOutput = "package main\n\nfunc main() {\n\tprintln(\"hi\")\n}"
	const imageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

	for _, tc := range []struct {
		name      string
		raw       string
		request   interface{ GetTokenCountMeta() *types.TokenCountMeta }
		contains  []string
		files     int
		detail    string
		toolCount int
	}{
		{
			name: "chat",
			raw: `{"model":"m","messages":[
				{"role":"user","content":[{"type":"text","text":"show main.go"},{"type":"image_url","image_url":{"url":"data:image/png;base64,` + imageData + `"}}]},
				{"role":"assistant","content":null,"tool_calls":[{"id":"c1","type":"function","function":{"name":"read_file","arguments":"{\"path\":\"main.go\"}"}}]},
				{"role":"tool","tool_call_id":"c1","content":"package main\n\nfunc main() {\n\tprintln(\"hi\")\n}"}],
				"tools":[{"type":"function","function":{"name":"read_file","description":"Read a file","parameters":{"type":"object","properties":{"path":{"type":"string"}}}}}]}`,
			request:  &GeneralOpenAIRequest{},
			contains: []string{"read_file", `{"path":"main.go"}`, toolOutput, "Read a file", `"properties":{"path":{"type":"string"}}`},
			// An omitted detail stays empty so the estimate uses the upstream default (auto).
			files:     1,
			toolCount: 1,
		},
		{
			name: "responses",
			raw: `{"model":"m","instructions":"Be brief.\nUse tools.","input":[
				{"type":"message","role":"user","content":[{"type":"input_text","text":"show main.go"}]},
				{"type":"message","role":"assistant","content":[{"type":"output_text","text":"Reading it now."}]},
				{"type":"function_call","call_id":"c1","name":"read_file","arguments":"{\"path\":\"main.go\"}"},
				{"type":"function_call_output","call_id":"c1","output":"package main\n\nfunc main() {\n\tprintln(\"hi\")\n}"},
				{"type":"custom_tool_call","call_id":"c2","name":"apply_patch","input":"*** Begin Patch"},
				{"type":"custom_tool_call_output","call_id":"c2","output":[{"type":"input_text","text":"Done!"}]}]}`,
			request:  &OpenAIResponsesRequest{},
			contains: []string{"Be brief.\nUse tools.", "Reading it now.", "read_file", `{"path":"main.go"}`, toolOutput, "apply_patch", "*** Begin Patch", "Done!"},
		},
		{
			name: "claude",
			raw: `{"model":"m","max_tokens":1,"messages":[
				{"role":"user","content":"show main.go"},
				{"role":"assistant","content":[{"type":"tool_use","id":"c1","name":"read_file","input":{"path":"main.go"}}]},
				{"role":"user","content":[
					{"type":"tool_result","tool_use_id":"c1","content":"package main\n\nfunc main() {\n\tprintln(\"hi\")\n}"},
					{"type":"tool_result","tool_use_id":"c2","content":[{"type":"text","text":"screenshot taken"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"` + imageData + `"}}]}]}],
				"tools":[{"name":"read_file","description":"Read a file","input_schema":{"type":"object","properties":{"path":{"type":"string"}}}}]}`,
			request:   &ClaudeRequest{},
			contains:  []string{"read_file", `{"path":"main.go"}`, toolOutput, "screenshot taken", "Read a file", `"properties":{"path":{"type":"string"}}`},
			files:     1,
			toolCount: 1,
		},
		{
			name: "gemini",
			raw: `{"systemInstruction":{"parts":[{"text":"Be brief."}]},"contents":[
				{"role":"user","parts":[{"text":"show main.go"}]},
				{"role":"model","parts":[{"functionCall":{"name":"read_file","args":{"path":"main.go"}}}]},
				{"role":"user","parts":[{"functionResponse":{"name":"read_file","response":{"output":"package main\n\nfunc main() {\n\tprintln(\"hi\")\n}","exit_code":0}}}]},
				{"role":"user","parts":[{"functionResponse":{"name":"screenshot","response":{},"parts":[{"inlineData":{"mimeType":"image/png","data":"` + imageData + `"}}]}}]}],
				"generationConfig":{"mediaResolution":"MEDIA_RESOLUTION_LOW"},
				"tools":[{"functionDeclarations":[{"name":"read_file","description":"Read a file"}]}]}`,
			request:  &GeminiChatRequest{},
			contains: []string{"Be brief.", "read_file", `{"path":"main.go"}`, toolOutput, "Read a file"},
			files:    1,
			detail:   "MEDIA_RESOLUTION_LOW",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, kitutil.Unmarshal([]byte(tc.raw), tc.request))
			meta := tc.request.GetTokenCountMeta()
			for _, want := range tc.contains {
				assert.Contains(t, meta.CombineText, want)
			}
			// Tool output and instructions are counted as raw text, not JSON-escaped,
			// and images stay out of the text.
			assert.NotContains(t, meta.CombineText, `\n`)
			assert.NotContains(t, meta.CombineText, "map[")
			assert.NotContains(t, meta.CombineText, imageData)
			require.Len(t, meta.Files, tc.files)
			for _, file := range meta.Files {
				assert.Equal(t, types.FileTypeImage, file.FileType)
				assert.Equal(t, tc.detail, file.Detail)
			}
			assert.Equal(t, tc.toolCount, meta.ToolsCount)
		})
	}
}
