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
	Name   string   `json:"name"`
	Groups []string `json:"groups"`
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

func validateChannelChainRequest(c *gin.Context, req channelChainRequest, userGroup string) bool {
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		common.ApiErrorI18n(c, i18n.MsgNameCannotBeEmpty)
		return false
	}
	if len(req.Name) > 64 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return false
	}
	if err := service.ValidateUserChannelChainGroups(userGroup, req.Groups); err != nil {
		common.ApiError(c, err)
		return false
	}
	return true
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
			"groups":     chain.GetGroupList(),
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
		"chains":               chainItems,
		"max_chains":           model.MaxUserChannelChains,
		"max_groups_per_chain": model.MaxGroupsPerUserChannelChain,
		"token_usage":          tokenUsage,
	})
}

func CreateUserChannelChain(c *gin.Context) {
	var req channelChainRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	userId, userGroup, ok := getUserChannelChainContext(c)
	if !ok {
		return
	}
	if !validateChannelChainRequest(c, req, userGroup) {
		return
	}
	chain, err := model.CreateUserChannelChain(userId, strings.TrimSpace(req.Name), req.Groups)
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
	userGroup, err := model.GetUserGroup(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !validateChannelChainRequest(c, req, userGroup) {
		return
	}
	if err := model.UpdateUserChannelChain(userId, chainId, strings.TrimSpace(req.Name), req.Groups); err != nil {
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
