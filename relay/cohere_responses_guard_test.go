package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCohereResponsesStreamRejectsLossyToolConversion(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeCohere)
	request := &dto.OpenAIResponsesRequest{Model: "command-a", Tools: []byte(`[{"type":"function","name":"lookup"}]`)}
	info := &relaycommon.RelayInfo{Request: request, IsStream: true}
	err := ResponsesHelper(c, info)
	require.NotNil(t, err)
	require.Equal(t, http.StatusBadRequest, err.StatusCode)
}
