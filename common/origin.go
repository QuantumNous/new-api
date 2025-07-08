package common

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetOriginUserId 获取原始用户ID，如果请求头中存在则使用请求头中的值
func GetOriginUserId(c *gin.Context, defaultUserId int) int {
	if originUserId := c.GetHeader("X-Origin-User-ID"); originUserId != "" {
		if userId, err := strconv.Atoi(originUserId); err == nil {
			return userId
		}
	}
	return defaultUserId
}

// GetOriginChannelId 获取原始渠道ID，如果请求头中存在则使用请求头中的值
func GetOriginChannelId(c *gin.Context, defaultChannelId int) int {
	if originChannelId := c.GetHeader("X-Origin-Channel-ID"); originChannelId != "" {
		if channelId, err := strconv.Atoi(originChannelId); err == nil {
			return channelId
		}
	}
	return defaultChannelId
}

// GetOriginTokenId 获取原始Token ID，如果请求头中存在则使用请求头中的值
func GetOriginTokenId(c *gin.Context, defaultTokenId int) int {
	if originTokenId := c.GetHeader("X-Origin-Token-ID"); originTokenId != "" {
		if tokenId, err := strconv.Atoi(originTokenId); err == nil {
			return tokenId
		}
	}
	return defaultTokenId
}
