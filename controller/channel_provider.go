package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetChannelProviders(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := strings.TrimSpace(c.Query("keyword"))
	var providers []*model.ChannelProvider
	var total int64
	var err error
	if keyword == "" {
		providers, total, err = model.ListChannelProviders(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	} else {
		providers, total, err = model.SearchChannelProviders(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     providers,
		"total":     total,
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
	})
}

func GetChannelProvider(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	provider, err := model.GetChannelProviderByID(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, provider)
}

func CreateChannelProvider(c *gin.Context) {
	var provider model.ChannelProvider
	if err := c.ShouldBindJSON(&provider); err != nil {
		common.ApiError(c, err)
		return
	}
	provider.BaseURL = model.NormalizeChannelProviderBaseURL(provider.BaseURL)
	if provider.BaseURL == "" {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "供应商 API 地址不能为空"})
		return
	}
	created, err := model.GetOrCreateChannelProviderByBaseURL(nil, provider.BaseURL)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	updates := map[string]interface{}{}
	if strings.TrimSpace(provider.Name) != "" && provider.Name != created.Name {
		updates["name"] = provider.Name
	}
	if provider.Status != 0 && provider.Status != created.Status {
		updates["status"] = provider.Status
	}
	if strings.TrimSpace(provider.Remark) != "" {
		updates["remark"] = provider.Remark
	}
	if len(updates) > 0 {
		updates["updated_time"] = common.GetTimestamp()
		if err := model.DB.Model(&model.ChannelProvider{}).Where("id = ?", created.Id).Updates(updates).Error; err != nil {
			common.ApiError(c, err)
			return
		}
		created, _ = model.GetChannelProviderByID(created.Id)
	}
	common.ApiSuccess(c, created)
}

func UpdateChannelProvider(c *gin.Context) {
	var provider model.ChannelProvider
	if err := c.ShouldBindJSON(&provider); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.UpdateChannelProvider(&provider); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	model.InitChannelCache()
	common.ApiSuccess(c, &provider)
}

func DeleteChannelProvider(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteChannelProvider(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	common.ApiSuccess(c, nil)
}
