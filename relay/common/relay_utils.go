package common

import (
	"fmt"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"net/url"
	"one-api/constant"
	"strings"

	"github.com/gin-gonic/gin"
)

func GetFullRequestURL(baseURL string, requestURL string, channelType int) string {
	if channelType == constant.APITypeOpenAI {
		u, err := url.Parse(baseURL)
		if err == nil && u.Path != "" {
			// 进入 Compatible 方案
			return fmt.Sprintf("%s%s", strings.TrimSuffix(baseURL, "/"), strings.TrimPrefix(requestURL, "/v1"))
		}
	}

	fullRequestURL := fmt.Sprintf("%s%s", baseURL, requestURL)

	if strings.HasPrefix(baseURL, "https://gateway.ai.cloudflare.com") {
		switch channelType {
		case constant.ChannelTypeOpenAI:
			fullRequestURL = fmt.Sprintf("%s%s", baseURL, strings.TrimPrefix(requestURL, "/v1"))
		case constant.ChannelTypeAzure:
			fullRequestURL = fmt.Sprintf("%s%s", baseURL, strings.TrimPrefix(requestURL, "/openai/deployments"))
		}
	}
	return fullRequestURL
}

func GetAPIVersion(c *gin.Context) string {
	query := c.Request.URL.Query()
	apiVersion := query.Get("api-version")
	if apiVersion == "" {
		apiVersion = c.GetString("api_version")
	}
	return apiVersion
}
