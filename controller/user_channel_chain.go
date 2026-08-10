package controller

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type channelChainRequest struct {
	Name     string `json:"name"`
	Channels []int  `json:"channels"`
}

type userChannelSummary struct {
	Id       int     `json:"id"`
	Name     string  `json:"name"`
	Type     int     `json:"type"`
	Status   int     `json:"status"`
	Models   string  `json:"models"`
	Group    string  `json:"group"`
	Priority *int64  `json:"priority"`
	Weight   int     `json:"weight"`
	Tag      *string `json:"tag"`
}

func getUserChannelChainContext(c *gin.Context) (int, string, bool) {
	userId := c.GetInt("id")
	userGroup, err := model.GetUserGroup(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return 0, "", false
	}
	return userId, userGroup, true
}

func validateChannelChainRequest(c *gin.Context, req channelChainRequest) bool {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		common.ApiErrorI18n(c, i18n.MsgNameCannotBeEmpty)
		return false
	}
	if len(req.Name) > 64 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return false
	}
	if err := service.ValidateUserChannelChainChannels(req.Channels); err != nil {
		common.ApiError(c, err)
		return false
	}
	return true
}

func GetUserChannels(c *gin.Context) {
	_, _, ok := getUserChannelChainContext(c)
	if !ok {
		return
	}
	channels, err := service.GetEnabledChannelsForChain()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]userChannelSummary, 0, len(channels))
	for _, channel := range channels {
		items = append(items, userChannelSummary{
			Id:       channel.Id,
			Name:     channel.Name,
			Type:     channel.Type,
			Status:   channel.Status,
			Models:   channel.Models,
			Group:    channel.Group,
			Priority: channel.Priority,
			Weight:   channel.GetWeight(),
			Tag:      channel.Tag,
		})
	}
	common.ApiSuccess(c, gin.H{"channels": items})
}

func GetUserChannelChains(c *gin.Context) {
	userId := c.GetInt("id")
	chains, err := model.GetUserChannelChains(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	chainItems := make([]gin.H, 0, len(chains))
	for _, chain := range chains {
		chainItems = append(chainItems, gin.H{
			"id":         chain.ChainId,
			"name":       chain.Name,
			"channels":   chain.GetChannelList(),
			"created_at": chain.CreatedAt,
			"updated_at": chain.UpdatedAt,
		})
	}
	tokenUsage := make(map[string]int64, len(chains))
	for _, chain := range chains {
		count, err := model.CountUserTokensByChannelChain(userId, chain.ChainId)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		tokenUsage["chain:"+chain.ChainId] = count
	}
	common.ApiSuccess(c, gin.H{
		"chains":                 chainItems,
		"max_chains":             model.MaxUserChannelChains,
		"max_channels_per_chain": model.MaxChannelsPerUserChannelChain,
		"token_usage":            tokenUsage,
	})
}

func CreateUserChannelChain(c *gin.Context) {
	var req channelChainRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !validateChannelChainRequest(c, req) {
		return
	}
	userId := c.GetInt("id")
	chain, err := model.CreateUserChannelChain(userId, strings.TrimSpace(req.Name), req.Channels)
	if err != nil {
		if errors.Is(err, model.ErrChannelChainLimit) {
			common.ApiErrorI18n(c, i18n.MsgBatchTooMany, map[string]any{"Max": model.MaxUserChannelChains})
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, chain)
}

func UpdateUserChannelChain(c *gin.Context) {
	chainId := c.Param("chain_id")
	if chainId == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	userId := c.GetInt("id")
	if _, err := model.GetUserChannelChain(userId, chainId); err != nil {
		common.ApiErrorI18n(c, i18n.MsgNotFound)
		return
	}
	var req channelChainRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	if !validateChannelChainRequest(c, req) {
		return
	}
	if err := model.UpdateUserChannelChain(userId, chainId, strings.TrimSpace(req.Name), req.Channels); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"chain_id": chainId})
}

func DeleteUserChannelChain(c *gin.Context) {
	chainId := c.Param("chain_id")
	if chainId == "" {
		common.ApiErrorI18n(c, i18n.MsgInvalidId)
		return
	}
	userId := c.GetInt("id")
	if _, err := model.GetUserChannelChain(userId, chainId); err != nil {
		common.ApiErrorI18n(c, i18n.MsgNotFound)
		return
	}
	resetTokens, err := model.DeleteUserChannelChain(userId, chainId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"reset_tokens": resetTokens})
}
