package common

import (
	"encoding/json"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJsonRawMessageToString(t *testing.T) {
	tests := []struct {
		name string
		data json.RawMessage
		want string
	}{
		{
			name: "object",
			data: json.RawMessage(`{"city":"Paris","days":0,"strict":false}`),
			want: `{"city":"Paris","days":0,"strict":false}`,
		},
		{
			name: "string",
			data: json.RawMessage(`"{\"city\":\"Paris\",\"days\":0,\"strict\":false}"`),
			want: `{"city":"Paris","days":0,"strict":false}`,
		},
		{
			name: "null",
			data: json.RawMessage(`null`),
			want: "",
		},
		{
			name: "empty",
			data: nil,
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, JsonRawMessageToString(tt.data))
		})
	}
}

// customMarshaler 用于验证底层 JSON 库仍会调用类型自定义的 MarshalJSON/UnmarshalJSON，
// 不依赖 dto 包（避免 common <-> dto 循环引用）。
type customMarshaler struct {
	V int
}

func (c customMarshaler) MarshalJSON() ([]byte, error) {
	return []byte(`"custom:` + strconv.Itoa(c.V) + `"`), nil
}

func (c *customMarshaler) UnmarshalJSON(b []byte) error {
	var s string
	if err := Unmarshal(b, &s); err != nil {
		return err
	}
	n, err := strconv.Atoi(strings.TrimPrefix(s, "custom:"))
	if err != nil {
		return err
	}
	c.V = n
	return nil
}

// TestMarshalStdCompatible 锁定与 encoding/json 字节级一致的关键契约：
// map key 字典序排序（保护依赖 JSON 字节稳定的签名场景）与自定义 Marshaler 仍然生效。
// （HTML 转义与标准库的字节一致性由 TestMarshalMatchesEncodingJSON 覆盖。）
func TestMarshalStdCompatible(t *testing.T) {
	tests := []struct {
		name string
		in   any
		want string
	}{
		{"map key 字典序排序", map[string]int{"b": 2, "a": 1, "c": 3}, `{"a":1,"b":2,"c":3}`},
		{"嵌套 map 排序", map[string]any{"z": map[string]int{"y": 1, "x": 2}}, `{"z":{"x":2,"y":1}}`},
		{"自定义 Marshaler 生效", customMarshaler{42}, `"custom:42"`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Marshal(tt.in)
			require.NoError(t, err)
			assert.Equal(t, tt.want, string(got))
		})
	}
}

// TestMarshalMatchesEncodingJSON 对同一输入直接比对 common.Marshal 与标准库的输出字节，
// 这是「升级底层库零回归」的核心保证。
func TestMarshalMatchesEncodingJSON(t *testing.T) {
	inputs := []any{
		map[string]int{"b": 2, "a": 1},
		map[string]string{"html": `<a href="x">&`},
		[]any{1, "two", true, nil},
		struct {
			Name string   `json:"name"`
			Tags []string `json:"tags"`
		}{"foo", []string{"a", "b"}},
	}
	for i, in := range inputs {
		t.Run(strconv.Itoa(i), func(t *testing.T) {
			std, err := json.Marshal(in)
			require.NoError(t, err)
			got, err := Marshal(in)
			require.NoError(t, err)
			assert.Equal(t, string(std), string(got))
		})
	}
}

// TestRoundTrip 验证 RawMessage、json.Number、自定义 Marshaler 与 UnmarshalJsonStr
// 编解码后语义不变。
func TestRoundTrip(t *testing.T) {
	t.Run("RawMessage", func(t *testing.T) {
		type wrap struct {
			Raw json.RawMessage `json:"raw"`
		}
		src := wrap{Raw: json.RawMessage(`{"k":1}`)}
		b, err := Marshal(src)
		require.NoError(t, err)
		var dst wrap
		require.NoError(t, Unmarshal(b, &dst))
		assert.JSONEq(t, string(src.Raw), string(dst.Raw))
	})

	t.Run("json.Number", func(t *testing.T) {
		type wrap struct {
			N json.Number `json:"n"`
		}
		b, err := Marshal(wrap{N: "123.456"})
		require.NoError(t, err)
		assert.Equal(t, `{"n":123.456}`, string(b))
		var dst wrap
		require.NoError(t, Unmarshal(b, &dst))
		assert.Equal(t, json.Number("123.456"), dst.N)
	})

	t.Run("自定义 Marshaler", func(t *testing.T) {
		b, err := Marshal(customMarshaler{7})
		require.NoError(t, err)
		var c customMarshaler
		require.NoError(t, Unmarshal(b, &c))
		assert.Equal(t, 7, c.V)
	})

	t.Run("UnmarshalJsonStr", func(t *testing.T) {
		var m map[string]int
		require.NoError(t, UnmarshalJsonStr(`{"a":1,"b":2}`, &m))
		assert.Equal(t, map[string]int{"a": 1, "b": 2}, m)
	})
}

// TestValidJson 覆盖新增的 ValidJson 封装。
func TestValidJson(t *testing.T) {
	assert.True(t, ValidJson([]byte(`{"a":1}`)))
	assert.True(t, ValidJson([]byte(`[1,2,3]`)))
	assert.False(t, ValidJson([]byte(`{"a":}`)))
	assert.False(t, ValidJson([]byte(`not json`)))
}
