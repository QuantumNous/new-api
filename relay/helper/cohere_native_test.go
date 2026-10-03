package helper

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCohereNativeRequestAcceptsProviderSpecificFields(t *testing.T) {
	for _, body := range []string{
		`{"model":"command-a","messages":[{"role":"user","content":"Hi"}],"documents":[{"data":{"id":1}}],"thinking":{"type":"enabled"},"stream":true}`,
		`{"model":"embed-v4.0","images":["data:image/png;base64,AA=="],"input_type":"image","output_dimension":256}`,
		`{"model":"rerank-v3.5","query":"Hi","documents":["text",{"data":"value"}],"priority":1}`,
	} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v2/chat", strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		req, err := GetAndValidateRequest(c, types.RelayFormatCohereNative)
		require.NoError(t, err)
		require.NotEmpty(t, req.(*dto.CohereNativeRequest).Model)
	}
}
