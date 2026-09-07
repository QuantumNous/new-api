package common

import (
	"encoding/json"
	"io"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func newPassthroughStorage(t *testing.T, payload string) common.BodyStorage {
	t.Helper()
	storage, err := common.CreateBodyStorage([]byte(payload))
	require.NoError(t, err)
	t.Cleanup(func() { _ = storage.Close() })
	return storage
}

func readBody(t *testing.T, body io.Reader) string {
	t.Helper()
	raw, err := io.ReadAll(body)
	require.NoError(t, err)
	return string(raw)
}

func mappedRelayInfo(mapped bool, upstreamModel string) *RelayInfo {
	return &RelayInfo{
		ChannelMeta: &ChannelMeta{
			UpstreamModelName: upstreamModel,
			IsModelMapped:     mapped,
		},
	}
}

// 核心回归：透传 + 映射命中 → 上游收到映射后的模型名，其余字节一字不动。
func TestNewPassthroughBodyRewritesModelWhenMapped(t *testing.T) {
	payload := `{"model":"public-a","messages":[{"role":"user","content":"hi"}],"temperature":0.7,"unknown_field":123,"extra":{"model":"nested-keep"}}`
	storage := newPassthroughStorage(t, payload)

	body, closer, err := NewPassthroughBody(storage, mappedRelayInfo(true, "upstream-b"))
	require.NoError(t, err)
	require.NotNil(t, closer)
	defer closer.Close()

	got := readBody(t, body)
	require.Contains(t, got, `"model":"upstream-b"`)
	// 其余字段（含嵌套结构里的同名 key）逐字节保持
	require.Contains(t, got, `"temperature":0.7,"unknown_field":123,"extra":{"model":"nested-keep"}`)
	require.NotContains(t, got, "public-a")

	var decoded map[string]any
	require.NoError(t, json.Unmarshal([]byte(got), &decoded))
	require.Equal(t, "upstream-b", decoded["model"])
	require.Equal(t, float64(123), decoded["unknown_field"])
	require.Equal(t, "nested-keep", decoded["extra"].(map[string]any)["model"])
}

// 未发生映射时绝不改写：closer 为 nil，内容与入站完全一致。
func TestNewPassthroughBodyLeavesBodyUntouchedWhenNotMapped(t *testing.T) {
	payload := `{"model":"public-a","messages":[{"role":"user","content":"hi"}]}`
	storage := newPassthroughStorage(t, payload)

	body, closer, err := NewPassthroughBody(storage, mappedRelayInfo(false, "public-a"))
	require.NoError(t, err)
	require.Nil(t, closer)
	require.Equal(t, payload, readBody(t, body))
}

// ChannelMeta 缺失（老路径/任务轮询构造的裸 RelayInfo）不能 panic。
func TestNewPassthroughBodyWithoutChannelMeta(t *testing.T) {
	storage := newPassthroughStorage(t, `{"model":"public-a"}`)

	body, closer, err := NewPassthroughBody(storage, &RelayInfo{})
	require.NoError(t, err)
	require.Nil(t, closer)
	require.Equal(t, `{"model":"public-a"}`, readBody(t, body))
}

func TestReplaceTopLevelModel(t *testing.T) {
	tests := []struct {
		name     string
		src      string
		model    string
		want     string
		changed  bool
		contains string
	}{
		{
			name:    "顶层改写/保留未知字段",
			src:     `{"model":"a","top":1}`,
			model:   "b",
			want:    `{"model":"b","top":1}`,
			changed: true,
		},
		{
			name:    "键前后有空白与换行",
			src:     "{\n  \"model\" : \"a\" ,\n  \"top\":1\n}",
			model:   "b",
			want:    "{\n  \"model\" : \"b\" ,\n  \"top\":1\n}",
			changed: true,
		},
		{
			name:    "模型名需要转义",
			src:     `{"model":"a"}`,
			model:   `we"ird`,
			want:    `{"model":"we\"ird"}`,
			changed: true,
		},
		{
			name:    "值相同则不动",
			src:     `{"model":"a"}`,
			model:   "a",
			changed: false,
		},
		{
			name:    "model 在嵌套结构之后仍能被找到",
			src:     `{"messages":[{"model":"keep"}],"model":"a"}`,
			model:   "b",
			want:    `{"messages":[{"model":"keep"}],"model":"b"}`,
			changed: true,
		},
		{
			name:    "model 非字符串不改",
			src:     `{"model":null}`,
			model:   "b",
			changed: false,
		},
		{
			name:    "没有 model 字段不改",
			src:     `{"prompt":"hi"}`,
			model:   "b",
			changed: false,
		},
		{
			name:    "非对象 body 不改",
			src:     `["a","b"]`,
			model:   "b",
			changed: false,
		},
		{
			name:    "非法 JSON 不改",
			src:     `{"model":`,
			model:   "b",
			changed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := ReplaceTopLevelModel([]byte(tt.src), tt.model)
			require.Equal(t, tt.changed, changed)
			if tt.changed {
				require.Equal(t, tt.want, string(got))
			} else {
				require.Nil(t, got)
			}
		})
	}
}

// 改写后的 body 必须仍是合法 JSON，且除 model 外与原文等价。
func TestReplaceTopLevelModelKeepsEverythingElseByteIdentical(t *testing.T) {
	src := []byte(`{"stream":true,"model":"public-a","messages":[{"role":"user","content":"\"quoted\""}], "max_tokens":  10}`)
	got, changed := ReplaceTopLevelModel(src, "upstream-b")
	require.True(t, changed)
	require.Equal(t,
		`{"stream":true,"model":"upstream-b","messages":[{"role":"user","content":"\"quoted\""}], "max_tokens":  10}`,
		string(got))
}
