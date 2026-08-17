package openai

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOaiResponsesCompactionHandlerAuditsUnexpectedObjectAndPassesThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := []byte(`{"id":"cmp_1","object":"compatible.compaction","output":[],"usage":{"input_tokens":3,"output_tokens":1,"total_tokens":4}}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
	info := &relaycommon.RelayInfo{}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(bytes.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}

	usage, apiErr := OaiResponsesCompactionHandler(ctx, info, resp)
	require.Nil(t, apiErr)
	require.Equal(t, "compatible.compaction", info.CompactResponseObject)
	require.Equal(t, body, recorder.Body.Bytes())
	require.Equal(t, 4, usage.TotalTokens)
}

func TestOaiResponsesCompactionHandlerAcceptsOfficialObjectWithoutAuditMarker(t *testing.T) {
	gin.SetMode(gin.TestMode)
	body := []byte(`{"id":"cmp_1","object":"response.compaction","output":[],"usage":{"input_tokens":1,"output_tokens":0,"total_tokens":1}}`)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{}
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(body))}

	_, apiErr := OaiResponsesCompactionHandler(ctx, info, resp)
	require.Nil(t, apiErr)
	require.Empty(t, info.CompactResponseObject)
}

func TestCompactResponseObjectAuditValueRemovesControlsAndBoundsLength(t *testing.T) {
	value := compactResponseObjectAuditValue("  compatible\ncompaction\t" + strings.Repeat("x", 140))
	require.NotContains(t, value, "\n")
	require.NotContains(t, value, "\t")
	require.LessOrEqual(t, len([]rune(strings.TrimSuffix(value, "..."))), maxCompactResponseObjectAuditRunes)
	require.True(t, strings.HasSuffix(value, "..."))
	require.Equal(t, "<missing>", compactResponseObjectAuditValue("\n\t"))
}
