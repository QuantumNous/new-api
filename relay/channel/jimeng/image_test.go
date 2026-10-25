package jimeng

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJimengImageHandlerBillsPayloadCount(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	overMax := make([]string, dto.MaxImageN+1)
	for i := range overMax {
		overMax[i] = "https://example.com/image.png"
	}
	for _, tc := range []struct {
		name        string
		requested   int
		urls        []string
		base64      []string
		wantN       float64
		wantEntries int
		expression  bool
		wantBilled  *int
		upstreamErr bool
	}{
		{"fewer than requested", 4, []string{"https://example.com/a.png"}, nil, 1, 1, false, nil, false},
		{"more than requested", 1, []string{"https://example.com/a.png", "https://example.com/b.png"}, nil, 2, 2, false, nil, false},
		{"both representations counted once", 4, []string{"https://example.com/a.png"}, []string{"aW1hZ2U="}, 1, 2, false, nil, false},
		{"base64 larger than urls", 4, []string{"https://example.com/a.png"}, []string{"aW1hZ2Ux", "aW1hZ2Uy"}, 2, 3, false, nil, false},
		{"blank payloads ignored", 3, []string{"https://example.com/a.png", "", "   "}, []string{"aW1hZ2U="}, 1, 4, false, nil, false},
		{"zero keeps reservation", 4, []string{"", "   "}, nil, 4, 2, false, nil, false},
		{"over maximum keeps reservation", 1, overMax, nil, 1, dto.MaxImageN + 1, false, nil, false},
		{"expression uses actual count", 4, []string{"https://example.com/a.png"}, nil, 4, 1, true, common.GetPointer(1), false},
		{"expression zero keeps reservation", 4, nil, nil, 4, 0, true, nil, false},
		{"upstream error keeps reservation", 4, []string{"https://example.com/a.png"}, nil, 4, 0, false, nil, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
			info := &relaycommon.RelayInfo{}
			info.PriceData.UsePrice = !tc.expression
			info.PriceData.ModelPrice = 0.04
			info.PriceData.GroupRatioInfo.GroupRatio = 1
			info.PriceData.AddOtherRatio("n", float64(tc.requested))
			if tc.expression {
				info.TieredBillingSnapshot = &billingexpr.BillingSnapshot{EstimatedImageCount: &tc.requested}
			}
			upstream := ImageResponse{Code: 10000}
			upstream.Data.ImageUrls = tc.urls
			upstream.Data.BinaryDataBase64 = tc.base64
			if tc.upstreamErr {
				upstream.Code = 500
				upstream.Message = "upstream failed"
			}
			body, err := common.Marshal(upstream)
			require.NoError(t, err)
			response := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(body)), Header: make(http.Header)}

			usage, apiErr := jimengImageHandler(ctx, response, info)

			assert.Equal(t, tc.wantN, info.PriceData.OtherRatios()["n"])
			assert.Equal(t, tc.wantBilled, info.BillingImageCount)
			if tc.upstreamErr {
				require.NotNil(t, apiErr)
				assert.Nil(t, usage)
				return
			}
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			var images dto.ImageResponse
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &images))
			assert.Len(t, images.Data, tc.wantEntries)
		})
	}
}
