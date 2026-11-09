package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestIQArtifactExtractionAndFinalText(t *testing.T) {
	for _, input := range []string{`<html><head><meta http-equiv="refresh" content="0;url=https://bad.test"><base href="https://bad.test"></head><body><svg></svg><canvas></canvas><script>document.querySelector('canvas');</script><script src="https://bad.test/x.js"></script><iframe srcdoc="bad"></iframe></body></html>`, "```html\n<html><body><script>const canvas = 1;</script><svg></svg></body></html>\n```"} {
		kind, artifact, err := ExtractIQArtifact(input)
		require.NoError(t, err)
		require.Equal(t, "html", kind)
		require.Contains(t, artifact, "<script>")
		require.NotContains(t, artifact, "bad.test")
		require.NotContains(t, artifact, "iframe")
		require.NotContains(t, artifact, "<meta")
		require.NotContains(t, artifact, "<base")
	}
	kind, _, err := ExtractIQArtifact("```svg\n<svg xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"2\"/></svg>\n```")
	require.NoError(t, err)
	require.Equal(t, "svg", kind)
	for _, invalid := range []string{"/mnt/pelican.html", "https://example.test/pelican.html", "<html><body><svg></svg>", "<svg><g>", strings.Repeat("x", model.IQMaxResponseBytes+1), "<svg>" + strings.Repeat("x", model.IQMaxArtifactBytes) + "</svg>"} {
		_, _, err := ExtractIQArtifact(invalid)
		require.Error(t, err)
	}
	text, err := IQVisibleText([]byte(`{"output":[{"type":"reasoning","content":[{"type":"text","text":"SECRET"}]},{"type":"message","role":"assistant","content":[{"type":"output_text","text":"<svg></svg>"}]}]}`), false)
	require.NoError(t, err)
	require.Equal(t, "<svg></svg>", text)
	text, err = IQVisibleText([]byte(`{"candidates":[{"finishReason":"STOP","content":{"parts":[{"thought":true,"text":"SECRET"},{"text":"<svg></svg>"}]}}]}`), false)
	require.NoError(t, err)
	require.Equal(t, "<svg></svg>", text)
	stream := "data: {\"type\":\"response.output_text.delta\",\"delta\":\"<svg>\"}\n\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"<svg></svg>\"}]}]}}\n\n"
	text, err = IQVisibleText([]byte(stream), true)
	require.NoError(t, err)
	require.Equal(t, "<svg></svg>", text)
	_, err = IQVisibleText([]byte(`{"choices":[{"finish_reason":"length","message":{"content":"<svg></svg>"}}]}`), false)
	require.Error(t, err)
	text, err = IQVisibleText([]byte(`{"choices":[{"message":{"reasoning_content":"<svg></svg>","tool_calls":[{}]}}]}`), false)
	require.NoError(t, err)
	require.Empty(t, text)
}
