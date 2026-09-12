package ali

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func oaiFormEdit2WanxImageEdit(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (*AliImageRequest, error) {
	count, err := request.ImageCount(true)
	if err != nil {
		return nil, err
	}
	var imageRequest AliImageRequest
	imageRequest.Model = request.Model
	imageRequest.ResponseFormat = request.ResponseFormat
	wanInput := WanImageInput{
		Prompt: request.Prompt,
	}

	if err := common.UnmarshalBodyReusable(c, &wanInput); err != nil {
		return nil, err
	}
	if wanInput.Images, err = getImageBase64sFromForm(c, "image"); err != nil {
		return nil, fmt.Errorf("get image base64s from form failed: %w", err)
	}
	imageRequest.Input = wanInput
	imageRequest.Parameters = AliImageParameters{
		N: common.GetPointer(uint(count)),
	}
	if request.BillingParameters != nil {
		imageRequest.Parameters.PromptExtend = request.BillingParameters.PromptExtend
	}

	return &imageRequest, nil
}

func isOldWanModel(modelName string) bool {
	return strings.Contains(modelName, "wan") &&
		!lo.SomeBy([]string{"wan2.6", "wan2.7"}, func(v string) bool { return strings.Contains(modelName, v) })
}

func isWanModel(modelName string) bool {
	return strings.Contains(modelName, "wan")
}
