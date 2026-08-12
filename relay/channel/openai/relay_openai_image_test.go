package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
)

func TestOpenaiHandlerWithUsageRejectsEmptyImageDataBeforeWritingResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	response := &http.Response{Body: io.NopCloser(strings.NewReader(`{"created":1,"data":[]}`))}

	usage, apiErr := OpenaiHandlerWithUsage(context, &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}, response)
	if usage != nil || apiErr == nil {
		t.Fatalf("empty image response = usage %#v, error %#v; want error before success", usage, apiErr)
	}
	if recorder.Body.Len() != 0 {
		t.Fatalf("empty image response was written to client: %q", recorder.Body.String())
	}
}

func TestOpenaiHandlerWithUsageAcceptsURLOrBase64ImageData(t *testing.T) {
	for _, responseBody := range []string{
		`{"created":1,"data":[{"url":"https://example.invalid/image.png"}]}`,
		`{"created":1,"data":[{"b64_json":"aGVsbG8="}]}`,
	} {
		t.Run(responseBody, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(recorder)
			response := &http.Response{Body: io.NopCloser(strings.NewReader(responseBody))}

			usage, apiErr := OpenaiHandlerWithUsage(context, &relaycommon.RelayInfo{
				RelayMode:   relayconstant.RelayModeImagesEdits,
				ChannelMeta: &relaycommon.ChannelMeta{},
			}, response)
			if usage == nil || apiErr != nil {
				t.Fatalf("valid image response = usage %#v, error %#v", usage, apiErr)
			}
			if recorder.Body.String() != responseBody {
				t.Fatalf("response body = %q, want %q", recorder.Body.String(), responseBody)
			}
		})
	}
}
