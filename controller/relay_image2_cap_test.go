package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestImage2OversizeRequestFailsBeforeLegacyChannelSelection(t *testing.T) {
	old := common.Image2SmartRoutingEnabled
	common.Image2SmartRoutingEnabled = true
	t.Cleanup(func() { common.Image2SmartRoutingEnabled = old })
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-image-2",
		RelayMode:       relayconstant.RelayModeImagesGenerations,
	}
	for _, size := range []string{"4097x4096", "8192x8192"} {
		t.Run(size, func(t *testing.T) {
			validationErr := image2SmartRequestValidationError(info, &dto.ImageRequest{Size: size})
			require.NotNil(t, validationErr)
			require.Equal(t, http.StatusBadRequest, validationErr.StatusCode)
			require.Equal(t, types.ErrorCodeInvalidRequest, validationErr.GetErrorCode())
			require.True(t, types.IsSkipRetryError(validationErr))
		})
	}
}
