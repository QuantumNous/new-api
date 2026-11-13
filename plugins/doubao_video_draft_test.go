package plugins_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The OpenAI Videos protocol must declare draft_task references to the host the
// same way the native Ark route does. Without originTaskIds the host never
// resolves the origin task, and buildSubmitRequest has no upstream id to swap
// into the outbound content item.
func TestDoubaoVideoProtocolDeclaresOriginTaskIDs(t *testing.T) {
	_, plugin := newDoubaoPlugin(t)

	value, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_video", "decodeRequest"}, map[string]any{
		"model": "doubao-seedance-2-0-mini-260615",
		"body": map[string]any{"kind": "json", "value": map[string]any{
			"model":   "doubao-seedance-2-0-mini-260615",
			"prompt":  "同样的镜头，输出 480p 正式片",
			"seconds": 5,
			"metadata": map[string]any{
				"resolution": "480p",
				"content": []any{map[string]any{
					"type":       "draft_task",
					"draft_task": map[string]any{"id": "task_origin"},
				}},
			},
		}},
	})
	require.NoError(t, err)

	decoded := alibabaObject(t, value)
	assert.Equal(t, []any{"task_origin"}, decoded["originTaskIds"])
}

// The multipart branch declares originTaskIds on its own code path; without a
// test here, dropping that assignment would still leave the suite green.
func TestDoubaoVideoProtocolMultipartDeclaresOriginTaskIDs(t *testing.T) {
	_, plugin := newDoubaoPlugin(t)

	value, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_video", "decodeRequest"}, map[string]any{
		"model": "doubao-seedance-2-0-mini-260615",
		"body": map[string]any{"kind": "multipart", "fields": map[string][]string{
			"model":    {"doubao-seedance-2-0-mini-260615"},
			"prompt":   {"同样的镜头，输出 480p 正式片"},
			"seconds":  {"5"},
			"metadata": {`{"resolution":"480p","content":[{"type":"draft_task","draft_task":{"id":"task_origin"}}]}`},
		}},
	})
	require.NoError(t, err)

	decoded := alibabaObject(t, value)
	assert.Equal(t, []any{"task_origin"}, decoded["originTaskIds"])
}

// The upstream draft_task id is the vendor id, never the gateway public id.
func TestDoubaoVideoSubmitRewritesDraftTaskToUpstreamID(t *testing.T) {
	_, plugin := newDoubaoPlugin(t)

	value, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
		"apiKey":        "sk-test",
		"baseUrl":       doubaoBaseURL,
		"model":         "doubao-seedance-2-0-mini-260615",
		"upstreamModel": "doubao-seedance-2-0-mini-260615",
		"requestBody": map[string]any{
			"model":   "doubao-seedance-2-0-mini-260615",
			"prompt":  "同样的镜头，输出 480p 正式片",
			"seconds": 5,
			"metadata": map[string]any{
				"resolution": "480p",
				"content": []any{map[string]any{
					"type":       "draft_task",
					"draft_task": map[string]any{"id": "task_origin"},
				}},
			},
		},
		"originTasks": []any{map[string]any{"taskId": "task_origin", "upstreamTaskId": "cgt-20260101"}},
	})
	require.NoError(t, err)

	descriptor := alibabaObject(t, value)
	body := alibabaObject(t, descriptor["body"])
	content, ok := body["content"].([]any)
	require.True(t, ok)
	require.Len(t, content, 2)

	draft, ok := content[0].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "draft_task", draft["type"])
	draftTask, ok := draft["draft_task"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "cgt-20260101", draftTask["id"])

	text, ok := content[1].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "text", text["type"])
	assert.Equal(t, "同样的镜头，输出 480p 正式片", text["text"])
}

// A draft render must reach Ark with the draft flag and the requested output
// tier as top-level body fields: metadata is merged into the body, so anything
// the caller puts there is forwarded verbatim.
func TestDoubaoVideoDraftForwardsFlagAndResolution(t *testing.T) {
	_, plugin := newDoubaoPlugin(t)

	value, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
		"apiKey":        "sk-test",
		"baseUrl":       doubaoBaseURL,
		"model":         "doubao-seedance-2-5-260628",
		"upstreamModel": "doubao-seedance-2-5-260628",
		"requestBody": map[string]any{
			"model":   "doubao-seedance-2-5-260628",
			"prompt":  "机械蝴蝶穿过工厂，最终飞向天窗",
			"seconds": 4,
			"metadata": map[string]any{
				"resolution": "480p",
				"draft":      true,
			},
		},
	})
	require.NoError(t, err)

	descriptor := alibabaObject(t, value)
	assert.Equal(t, "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks", descriptor["url"])
	body := alibabaObject(t, descriptor["body"])
	assert.Equal(t, true, body["draft"])
	assert.Equal(t, "480p", body["resolution"])
	assert.Equal(t, float64(4), body["duration"])
	assert.NotContains(t, body, "metadata")
}

// An unresolved reference must still fail loudly rather than reach Ark with a
// public task id it cannot read.
func TestDoubaoVideoSubmitRejectsUnresolvedDraftTask(t *testing.T) {
	_, plugin := newDoubaoPlugin(t)

	_, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
		"apiKey":        "sk-test",
		"baseUrl":       doubaoBaseURL,
		"model":         "doubao-seedance-2-0-mini-260615",
		"upstreamModel": "doubao-seedance-2-0-mini-260615",
		"requestBody": map[string]any{
			"model":   "doubao-seedance-2-0-mini-260615",
			"prompt":  "同样的镜头",
			"seconds": 5,
			"metadata": map[string]any{
				"resolution": "480p",
				"content": []any{map[string]any{
					"type":       "draft_task",
					"draft_task": map[string]any{"id": "task_origin"},
				}},
			},
		},
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "origin task is unavailable")
}
