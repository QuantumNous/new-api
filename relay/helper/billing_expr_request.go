package helper

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

func ResolveIncomingBillingExprRequestInput(c *gin.Context, info *relaycommon.RelayInfo) (billingexpr.RequestInput, error) {
	if info != nil && info.BillingRequestInput != nil {
		input := cloneRequestInput(*info.BillingRequestInput)
		merged := cloneStringMap(info.RequestHeaders)
		for k, v := range input.Headers {
			merged[k] = v
		}
		input.Headers = merged
		return input, nil
	}

	input := billingexpr.RequestInput{}
	if info != nil {
		input.Headers = cloneStringMap(info.RequestHeaders)
	}

	bodyBytes, err := readIncomingBillingExprBody(c)
	if err != nil {
		return billingexpr.RequestInput{}, err
	}
	if info != nil {
		if imageRequest, ok := info.Request.(*dto.ImageRequest); ok {
			bodyBytes, err = mergeValidatedImageBillingFields(bodyBytes, imageRequest)
			if err != nil {
				return billingexpr.RequestInput{}, err
			}
		}
	}
	input.Body = bodyBytes
	return input, nil
}

func BuildBillingExprRequestInputFromRequest(request dto.Request, headers map[string]string) (billingexpr.RequestInput, error) {
	input := billingexpr.RequestInput{
		Headers: cloneStringMap(headers),
	}
	if request == nil {
		return input, nil
	}

	bodyBytes, err := common.Marshal(request)
	if err != nil {
		return billingexpr.RequestInput{}, err
	}
	if imageRequest, ok := request.(*dto.ImageRequest); ok {
		bodyBytes, err = mergeValidatedImageBillingFields(bodyBytes, imageRequest)
		if err != nil {
			return billingexpr.RequestInput{}, err
		}
	}
	input.Body = bodyBytes
	return input, nil
}

func mergeValidatedImageBillingFields(body []byte, request *dto.ImageRequest) ([]byte, error) {
	fields := make(map[string]json.RawMessage)
	if len(body) > 0 {
		if err := common.Unmarshal(body, &fields); err != nil {
			return nil, err
		}
		if fields == nil {
			return nil, errors.New("image billing request body must be a JSON object")
		}
	}
	for key, value := range request.Extra {
		if _, exists := fields[key]; !exists {
			fields[key] = value
		}
	}

	imageN := uint(1)
	if request.N != nil && *request.N > 0 {
		imageN = *request.N
	}
	fields["n"], _ = common.Marshal(imageN)
	fields["resolution"], _ = common.Marshal(request.BillingResolution())
	return common.Marshal(fields)
}

func readIncomingBillingExprBody(c *gin.Context) ([]byte, error) {
	if c == nil || c.Request == nil || !isJSONContentType(c.Request.Header.Get("Content-Type")) {
		return nil, nil
	}
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	return storage.Bytes()
}

func cloneRequestInput(src billingexpr.RequestInput) billingexpr.RequestInput {
	input := billingexpr.RequestInput{
		Headers: cloneStringMap(src.Headers),
	}
	if len(src.Body) > 0 {
		input.Body = append([]byte(nil), src.Body...)
	}
	return input
}

func isJSONContentType(contentType string) bool {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	return strings.HasPrefix(contentType, "application/json")
}

func cloneStringMap(src map[string]string) map[string]string {
	if len(src) == 0 {
		return map[string]string{}
	}
	dst := make(map[string]string, len(src))
	for key, value := range src {
		if strings.TrimSpace(key) == "" {
			continue
		}
		dst[key] = value
	}
	return dst
}
