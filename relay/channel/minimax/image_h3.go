package minimax

import (
	"encoding/json"
	"fmt"
	"github.com/QuantumNous/new-api/relaykit/types"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
)

// isH3ImageRelay selects H3 handling after channel model mapping.
func isH3ImageRelay(info *relaycommon.RelayInfo) bool {
	if info.RelayMode != constant.RelayModeImagesGenerations && info.RelayMode != constant.RelayModeImagesEdits {
		return false
	}
	model := info.OriginModelName
	if info.ChannelMeta != nil && info.UpstreamModelName != "" {
		model = info.UpstreamModelName
	}
	return common.IsMiniMaxH3ImageModel(model)
}

// convertH3ImageRequest preserves documented H3 options and the OpenAI SDK file form.
func convertH3ImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (converted any, err error) {
	defer func() {
		if err != nil {
			err = types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
	}()
	if info.RelayMode != constant.RelayModeImagesGenerations && info.RelayMode != constant.RelayModeImagesEdits {
		return nil, fmt.Errorf("unsupported H3 image relay mode: %d", info.RelayMode)
	}
	if request.N != nil && (*request.N < 1 || *request.N > 10) {
		return nil, fmt.Errorf("MiniMax H3 image n must be between 1 and 10")
	}
	if info.RelayMode == constant.RelayModeImagesEdits && strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
		form := c.Request.MultipartForm
		if form == nil {
			var err error
			form, err = common.ParseMultipartFormReusable(c)
			if err != nil {
				return nil, err
			}
			defer form.RemoveAll()
			c.Request.MultipartForm = form
			defer func() { c.Request.MultipartForm = nil }()
		}
		if len(form.File["mask"]) > 0 || len(form.Value["mask"]) > 0 {
			return nil, fmt.Errorf("MiniMax H3 images do not support masks")
		}
		count := 0
		for field, files := range form.File {
			if field == "image" || strings.HasPrefix(field, "image[") {
				count += len(files)
			}
		}
		if count < 1 || count > 16 {
			return nil, fmt.Errorf("MiniMax H3 image edits require 1 to 16 reference images")
		}
		// The OpenAI SDK uses ordered image/image[] file parts. Reuse the
		// replay-safe multipart reconstruction, including the mapped model.
		return (&openai.Adaptor{}).ConvertImageRequest(c, info, request)
	}
	if len(request.Mask) > 0 {
		return nil, fmt.Errorf("MiniMax H3 images do not support masks")
	}
	if request.Stream != nil && *request.Stream && request.ResponseFormat != "" && request.ResponseFormat != "url" {
		return nil, fmt.Errorf("MiniMax H3 image streaming requires response_format=url")
	}
	// ImageRequest.Extra is deliberately not marshaled globally. Only forward
	// the documented H3 extension fields here, preserving explicit false/zero.
	encoded, err := common.Marshal(request)
	if err != nil {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if err := common.Unmarshal(encoded, &fields); err != nil {
		return nil, err
	}
	result := make(map[string]json.RawMessage)
	for _, key := range []string{"model", "prompt", "n", "size", "response_format", "output_format", "output_compression", "stream", "images"} {
		if value, ok := fields[key]; ok {
			result[key] = value
		}
	}
	for _, key := range []string{"aspect_ratio", "area", "disable_prompt_enhanced", "aigc_watermark"} {
		if value, ok := request.Extra[key]; ok {
			result[key] = value
		}
	}
	if _, present := result["aigc_watermark"]; !present && request.Watermark != nil {
		result["aigc_watermark"], err = common.Marshal(request.Watermark)
		if err != nil {
			return nil, err
		}
	}
	return result, nil
}
