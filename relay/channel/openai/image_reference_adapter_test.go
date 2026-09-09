package openai

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestImageReferenceAdaptationPreservesRequestedSizeAndQuality(t *testing.T) {
	for _, quality := range []string{"low", "high"} {
		for _, provider := range []struct {
			base  string
			array bool
		}{{"https://api.goeasyapi.xyz", true}, {"https://cpa.hardy777.top", false}} {
			t.Run(quality+provider.base, func(t *testing.T) {
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest("POST", "/v1/images/edits", strings.NewReader("{}"))
				c.Request.Header.Set("Content-Type", "application/json")
				body := `{"model":"gpt-image-2","prompt":"reference","images":["https://images.example.test/ref.png"],"size":"960x1280","quality":"` + quality + `","output_format":"jpeg","output_compression":100}`
				var request dto.ImageRequest
				require.NoError(t, common.Unmarshal([]byte(body), &request))
				info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: provider.base}}
				out, err := (&Adaptor{}).ConvertImageRequest(c, info, request)
				require.NoError(t, err)
				data, err := common.Marshal(out)
				require.NoError(t, err)
				path := "images.0.image_url"
				if provider.array {
					path = "images.0"
				}
				require.Equal(t, "https://images.example.test/ref.png", gjson.GetBytes(data, path).String())
				require.Equal(t, "960x1280", gjson.GetBytes(data, "size").String())
				require.Equal(t, quality, gjson.GetBytes(data, "quality").String())
				require.Equal(t, "jpeg", gjson.GetBytes(data, "output_format").String())
				require.EqualValues(t, 100, gjson.GetBytes(data, "output_compression").Int())
			})
		}
	}
}
