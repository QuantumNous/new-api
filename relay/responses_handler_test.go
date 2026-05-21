package relay

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	appconstant "github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestNormalizeCodexResponsesPassthroughBodyForcesStream(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{}
	storage, err := common.CreateBodyStorage([]byte(`{"model":"gpt-5.3-codex","input":"hi","stream":false,"store":true}`))
	require.NoError(t, err)
	defer storage.Close()

	body, err := normalizeCodexResponsesPassthroughBody(c, info, storage)

	require.NoError(t, err)
	var req map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &req))
	require.Equal(t, true, req["stream"])
	require.Equal(t, false, req["store"])
	require.True(t, info.IsStream)
	require.True(t, c.GetBool(string(appconstant.ContextKeyIsStream)))
}
