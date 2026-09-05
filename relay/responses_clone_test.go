package relay

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCloneResponsesRequest(t *testing.T) {
	t.Run("nil source", func(t *testing.T) {
		clone, err := cloneResponsesRequest(nil)
		require.Error(t, err)
		assert.Nil(t, clone)
	})

	for _, raw := range []json.RawMessage{nil, {}, []byte(`null`), []byte(`false`), []byte(`0`), []byte(`[]`), []byte(`{"x":1}`)} {
		t.Run(fmt.Sprintf("raw_%q_nil_%t", raw, raw == nil), func(t *testing.T) {
			src := &dto.OpenAIResponsesRequest{}
			populateResponsesCloneFixture(t, reflect.ValueOf(src).Elem(), raw)
			want, err := common.DeepCopy(src)
			require.NoError(t, err)
			clone, err := cloneResponsesRequest(src)
			require.NoError(t, err)
			assert.Equal(t, want, clone, "retain the existing clone contract")
			assert.Equal(t, src, clone, "including internal state and explicit zero pointers")

			// Mutate every reachable field, including nested pointers and raw bytes.
			// A later channel attempt must still see the original request.
			populateResponsesCloneFixture(t, reflect.ValueOf(clone).Elem(), []byte(`true`))
			assert.Equal(t, want, src)
			retry, err := cloneResponsesRequest(src)
			require.NoError(t, err)
			assert.Equal(t, want, retry)
		})
	}

	t.Run("absent optional fields", func(t *testing.T) {
		src := &dto.OpenAIResponsesRequest{Model: "gpt-4.1", Input: []byte(`"hello"`)}
		clone, err := cloneResponsesRequest(src)
		require.NoError(t, err)
		assert.Equal(t, src, clone)
		clone.Input[1] = 'H'
		assert.Equal(t, json.RawMessage(`"hello"`), src.Input)
	})

	t.Run("large input", func(t *testing.T) {
		input := bytes.Repeat([]byte("a"), 1<<20)
		input[0], input[len(input)-1] = '"', '"'
		src := &dto.OpenAIResponsesRequest{Model: "gpt-4.1", Input: input}
		clone, err := cloneResponsesRequest(src)
		require.NoError(t, err)
		assert.Equal(t, src, clone)
		clone.Input[len(input)/2] = 'b'
		assert.Equal(t, byte('a'), src.Input[len(input)/2])
	})

	t.Run("model mapping on successive channel attempts", func(t *testing.T) {
		src := &dto.OpenAIResponsesRequest{Model: "client-model", Input: []byte(`"hello"`)}
		for _, model := range []string{"first-channel-model", "retry-channel-model"} {
			request, err := cloneResponsesRequest(src)
			require.NoError(t, err)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("model_mapping", fmt.Sprintf(`{"client-model":%q}`, model))
			info := &relaycommon.RelayInfo{OriginModelName: src.Model}
			require.NoError(t, helper.ModelMappedHelper(c, info, request))
			assert.Equal(t, model, request.Model)
			assert.Equal(t, "client-model", src.Model)
		}
	})
}

// Populate all mutable fields so newly added request fields also exercise the
// retry-isolation contract, rather than silently escaping a hand-written list.
func populateResponsesCloneFixture(t *testing.T, value reflect.Value, raw json.RawMessage) {
	t.Helper()
	switch value.Kind() {
	case reflect.Struct:
		for i := 0; i < value.NumField(); i++ {
			populateResponsesCloneFixture(t, value.Field(i), raw)
		}
	case reflect.Ptr:
		if value.IsNil() {
			value.Set(reflect.New(value.Type().Elem()))
		}
		populateResponsesCloneFixture(t, value.Elem(), raw)
	case reflect.Slice:
		require.Equal(t, reflect.TypeOf(json.RawMessage{}), value.Type())
		if value.Len() > 0 {
			value.Index(0).SetUint('!')
		}
		value.Set(reflect.ValueOf(json.RawMessage(bytes.Clone(raw))))
	case reflect.String:
		value.SetString(value.String() + "gpt-4.1")
	case reflect.Bool:
		value.SetBool(bytes.Equal(raw, []byte(`true`)))
	case reflect.Int:
		if bytes.Equal(raw, []byte(`true`)) {
			value.SetInt(1)
		}
	case reflect.Uint:
		if bytes.Equal(raw, []byte(`true`)) {
			value.SetUint(1)
		}
	case reflect.Float64:
		if bytes.Equal(raw, []byte(`true`)) {
			value.SetFloat(1)
		}
	default:
		require.FailNow(t, "extend clone fixture for new field type", "%s", value.Type())
	}
}

func BenchmarkResponsesRequestClone(b *testing.B) {
	for _, size := range []int{1 << 20, 10 << 20, 40 << 20} {
		input := bytes.Repeat([]byte("a"), size)
		input[0], input[len(input)-1] = '"', '"'
		src := &dto.OpenAIResponsesRequest{Model: "gpt-4.1", Input: input}
		for _, method := range []struct {
			name string
			copy func(*dto.OpenAIResponsesRequest) (*dto.OpenAIResponsesRequest, error)
		}{
			{"reflect", common.DeepCopy[dto.OpenAIResponsesRequest]},
			{"raw_bytes", cloneResponsesRequest},
		} {
			b.Run(fmt.Sprintf("%dMiB/%s", size>>20, method.name), func(b *testing.B) {
				b.ReportAllocs()
				b.SetBytes(int64(size))
				for b.Loop() {
					clone, err := method.copy(src)
					require.NoError(b, err)
					require.Len(b, clone.Input, size)
				}
			})
		}
	}
}
