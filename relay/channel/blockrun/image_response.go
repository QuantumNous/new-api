package blockrun

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// ensureImageB64 fills item.B64Json by downloading item.Url when only a URL is
// present (whitelabel: the client receives bytes, never the upstream CDN host),
// then blanks the URL. On download failure it degrades — keep the URL, log a
// warning — because the upstream charge already happened and failing a paid,
// completed generation is worse than a rare whitelabel leak.
func ensureImageB64(c *gin.Context, info *relaycommon.RelayInfo, item *dto.ImageData) {
	if item.B64Json != "" || item.Url == "" {
		return
	}
	b64, err := downloadImageAsBase64(c, info, item.Url)
	if err != nil {
		logger.LogWarn(c, fmt.Sprintf("blockrun image: b64 conversion failed, returning upstream url (whitelabel degraded): %s", err))
		return
	}
	item.B64Json = b64
	item.Url = ""
}

// imageJSONResponseB64 is the non-streaming image DoResponse: read the completed
// upstream body, convert each image to base64 (ensureImageB64), write a clean
// OpenAI-compatible {created, data:[{b64_json, …}]} response. Settlement signals
// were captured in resolveImageResult, so usage is empty and ImageHelper applies
// the per-image price.
func imageJSONResponseB64(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	body, err := readAndCloseBody(resp)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeReadResponseBodyFailed, types.ErrOptionWithSkipRetry())
	}
	var ir dto.ImageResponse
	if uerr := common.Unmarshal(body, &ir); uerr != nil || len(ir.Data) == 0 {
		return nil, types.NewError(fmt.Errorf("blockrun: image response carried no image data"), types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}
	for i := range ir.Data {
		ensureImageB64(c, info, &ir.Data[i])
	}
	out, merr := common.Marshal(ir)
	if merr != nil {
		return nil, types.NewError(merr, types.ErrorCodeBadResponseBody, types.ErrOptionWithSkipRetry())
	}
	c.Writer.Header().Set("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)
	_, _ = c.Writer.Write(out)
	return &dto.Usage{}, nil
}
