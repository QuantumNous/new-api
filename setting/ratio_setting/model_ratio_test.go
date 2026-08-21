package ratio_setting_test

import (
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	rootconstant "github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/groksubscription"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGrokImagineImageDefaultPriceModelListAndNMultiplier(t *testing.T) {
	const model = groksubscription.GrokImageModel

	ratio_setting.InitRatioSettings()

	price, ok := ratio_setting.GetDefaultModelPriceMap()[model]
	require.True(t, ok)
	require.Equal(t, 0.04, price)

	require.Contains(t, (&groksubscription.Adaptor{}).GetModelList(), model)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: model,
		UserGroup:       "default",
		UsingGroup:      "default",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: rootconstant.ChannelTypeGrokSubscription,
			ApiType:     rootconstant.APITypeGrokSubscription,
		},
	}
	priceData, err := helper.ModelPriceHelperPerCall(c, info)
	require.NoError(t, err)
	require.True(t, priceData.UsePrice)
	require.Equal(t, price, priceData.ModelPrice)

	baseQuota := priceData.Quota
	require.Equal(t, int(price*common.QuotaPerUnit), baseQuota)

	priceData.AddOtherRatio("n", 2)
	got := int(math.Round(priceData.ModelPrice * common.QuotaPerUnit * priceData.GroupRatioInfo.GroupRatio * priceData.OtherRatios["n"]))
	require.Equal(t, baseQuota*2, got)
}
