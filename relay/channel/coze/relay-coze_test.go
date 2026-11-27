package coze

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestCozeStreamDecodeErrorsRespectRequestLogSuppression(t *testing.T) {
	var logs bytes.Buffer
	common.LogWriterMu.Lock()
	previousWriter := gin.DefaultWriter
	gin.DefaultWriter = &logs
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultWriter = previousWriter
		common.LogWriterMu.Unlock()
	})

	for _, tc := range []struct {
		name  string
		event string
		data  string
		want  string
	}{
		{"completion", "conversation.chat.completed", "!", "invalid character"},
		{"delta", "conversation.message.delta", "!", "invalid character"},
		{"delta content", "conversation.message.delta", `{"content":{}}`, "cannot unmarshal object"},
		{"error event", "error", "!", "invalid character"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
			var responseText string
			var usage dto.Usage
			info := &relaycommon.RelayInfo{}

			logs.Reset()
			handleCozeEvent(c, tc.event, tc.data, &responseText, &usage, "coze-test", info)
			assert.Contains(t, logs.String(), tc.want)

			logs.Reset()
			c.Request = c.Request.WithContext(logger.WithoutRequestLogs(c.Request.Context()))
			handleCozeEvent(c, tc.event, tc.data, &responseText, &usage, "coze-test", info)
			assert.Empty(t, logs.String())
		})
	}
}
