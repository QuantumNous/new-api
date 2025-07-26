package service

import (
	"fmt"
	"one-api/common"
	"one-api/constant"
	"one-api/model"
	"strings"
	"time"

	"github.com/bytedance/gopkg/util/gopool"
)

// StartClaudeTokenRefreshScheduler starts the scheduled token refresh for Claude Code channels
func StartClaudeTokenRefreshScheduler() {
	ticker := time.NewTicker(5 * time.Minute)
	gopool.Go(func() {
		defer ticker.Stop()
		for range ticker.C {
			RefreshClaudeCodeTokens()
		}
	})
	common.SysLog("Claude Code token refresh scheduler started (5 minute interval)")
}

// RefreshClaudeCodeTokens refreshes tokens for all active Claude Code channels
func RefreshClaudeCodeTokens() {
	var channels []model.Channel

	// Get all active Claude Code channels
	err := model.DB.Where("type = ? AND status = ?", constant.ChannelTypeClaudeCode, common.ChannelStatusEnabled).Find(&channels).Error
	if err != nil {
		common.SysError("Failed to get Claude Code channels: " + err.Error())
		return
	}

	refreshCount := 0
	for _, channel := range channels {
		if refreshTokenForChannel(&channel) {
			refreshCount++
		}
	}

	if refreshCount > 0 {
		common.SysLog(fmt.Sprintf("Successfully refreshed %d Claude Code channel tokens", refreshCount))
	}
}

// refreshTokenForChannel attempts to refresh token for a single channel
func refreshTokenForChannel(channel *model.Channel) bool {
	// Parse key in format: accesstoken|refreshtoken
	if channel.Key == "" || !strings.Contains(channel.Key, "|") {
		common.SysError(fmt.Sprintf("Channel %d has invalid key format, expected accesstoken|refreshtoken", channel.Id))
		return false
	}

	parts := strings.Split(channel.Key, "|")
	if len(parts) < 2 {
		common.SysError(fmt.Sprintf("Channel %d has invalid key format, expected accesstoken|refreshtoken", channel.Id))
		return false
	}

	accessToken := parts[0]
	refreshToken := parts[1]

	if refreshToken == "" {
		common.SysError(fmt.Sprintf("Channel %d has empty refresh token", channel.Id))
		return false
	}

	// Check if token needs refresh (refresh 30 minutes before expiry)
	if !shouldRefreshToken(accessToken) {
		return false
	}

	// Use shared refresh function
	newToken, err := RefreshClaudeToken(accessToken, refreshToken)
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to refresh token for channel %d: %s", channel.Id, err.Error()))
		return false
	}

	// Update channel with new tokens
	newKey := fmt.Sprintf("%s|%s", newToken.AccessToken, newToken.RefreshToken)

	err = model.DB.Model(channel).Update("key", newKey).Error
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to update channel %d with new token: %s", channel.Id, err.Error()))
		return false
	}

	common.SysLog(fmt.Sprintf("Successfully refreshed token for Claude Code channel %d (%s)", channel.Id, channel.Name))
	return true
}

func shouldRefreshToken(_ string) bool {
	// TODO: Implement token refresh logic
	return true
}
