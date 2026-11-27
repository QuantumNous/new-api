package service

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// ImageURLProxyEnabled applies only to the standard image generation and edit APIs.
func ImageURLProxyEnabled(c *gin.Context) bool {
	settings, _ := common.GetContextKeyType[dto.ChannelSettings](c, constant.ContextKeyChannelSetting)
	if !settings.ImageURLProxy {
		return false
	}
	return c.Request.URL.Path == "/v1/images/generations" || c.Request.URL.Path == "/v1/images/edits"
}

// RewriteImageURLs preserves the response envelope and Base64 payloads while
// replacing image URLs in JSON responses and image stream events.
func RewriteImageURLs(c *gin.Context, body []byte) ([]byte, error) {
	if !ImageURLProxyEnabled(c) {
		return body, nil
	}
	paths := []string{"url"}
	data := gjson.GetBytes(body, "data")
	if data.IsObject() {
		paths = append(paths, "data.url")
	} else if data.IsArray() {
		for i := range data.Array() {
			paths = append(paths, "data."+strconv.Itoa(i)+".url")
		}
	}
	channelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	for _, path := range paths {
		value := gjson.GetBytes(body, path)
		if value.Type != gjson.String || value.Str == "" || strings.HasPrefix(value.Str, "data:") {
			continue
		}
		proxyURL, err := BuildImageProxyURL(value.Str, channelID)
		if err != nil {
			return nil, err
		}
		body, err = sjson.SetBytes(body, path, proxyURL)
		if err != nil {
			return nil, err
		}
	}
	return body, nil
}
