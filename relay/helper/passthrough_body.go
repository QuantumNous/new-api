package helper

import (
	"bytes"
	"fmt"
	"io"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/sjson"
)

// BuildPassThroughRequestBody builds request body for pass-through mode and
// syncs the top-level "model" field when model redirection changed upstream model.
func BuildPassThroughRequestBody(c *gin.Context, info *relaycommon.RelayInfo, syncModelField bool) (io.Reader, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}

	if !shouldSyncPassThroughModel(c, info, syncModelField) {
		return common.ReaderOnly(storage), nil
	}

	requestBodyBytes, err := storage.Bytes()
	if err != nil {
		return nil, err
	}

	updatedBody, err := setPassThroughModel(requestBodyBytes, info.UpstreamModelName)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(updatedBody), nil
}

func shouldSyncPassThroughModel(c *gin.Context, info *relaycommon.RelayInfo, syncModelField bool) bool {
	if !syncModelField || info == nil || info.UpstreamModelName == "" {
		return false
	}
	if !isJSONRequest(c) {
		return false
	}
	return info.IsModelMapped || info.UpstreamModelName != info.OriginModelName
}

func isJSONRequest(c *gin.Context) bool {
	if c == nil {
		return false
	}

	contentType := strings.ToLower(strings.TrimSpace(c.ContentType()))
	if contentType == "" && c.Request != nil {
		contentType = strings.ToLower(strings.TrimSpace(c.Request.Header.Get("Content-Type")))
	}
	return strings.Contains(contentType, "json")
}

func setPassThroughModel(requestBodyBytes []byte, upstreamModelName string) ([]byte, error) {
	if upstreamModelName == "" || len(bytes.TrimSpace(requestBodyBytes)) == 0 {
		return requestBodyBytes, nil
	}

	updatedBody, err := sjson.SetBytes(requestBodyBytes, "model", upstreamModelName)
	if err != nil {
		return nil, fmt.Errorf("set model in pass-through body failed: %w", err)
	}
	return updatedBody, nil
}
