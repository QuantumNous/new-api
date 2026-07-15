package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func seedanceOK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    data,
	})
}

func seedanceFail(c *gin.Context, err error) {
	if se, ok := err.(*service.SeedanceAssetError); ok {
		status := se.Status
		if status == 0 {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{
			"success": false,
			"message": se.Message,
			"code":    se.Code,
			"data":    nil,
		})
		return
	}
	c.JSON(http.StatusInternalServerError, gin.H{
		"success": false,
		"message": err.Error(),
		"code":    "internal_error",
		"data":    nil,
	})
}

func seedanceBodyMap(c *gin.Context) map[string]any {
	var body map[string]any
	_ = c.ShouldBindJSON(&body)
	if body == nil {
		body = map[string]any{}
	}
	return body
}

func pickBodyString(body map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := body[k]; ok && v != nil {
			switch t := v.(type) {
			case string:
				if s := strings.TrimSpace(t); s != "" {
					return s
				}
			}
		}
	}
	return ""
}

func pickBodyInt(body map[string]any, keys ...string) int {
	for _, k := range keys {
		if v, ok := body[k]; ok && v != nil {
			switch t := v.(type) {
			case float64:
				return int(t)
			case int:
				return t
			case int64:
				return int(t)
			case string:
				n, err := strconv.Atoi(strings.TrimSpace(t))
				if err == nil {
					return n
				}
			}
		}
	}
	return 0
}

func pickBodyStringSlice(body map[string]any, keys ...string) []string {
	for _, k := range keys {
		v, ok := body[k]
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case []any:
			out := make([]string, 0, len(t))
			for _, item := range t {
				if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
					out = append(out, strings.TrimSpace(s))
				}
			}
			return out
		case []string:
			return t
		}
	}
	return nil
}

func SeedanceCreateAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.CreateSeedanceAssetGroup(
		userId,
		pickBodyString(body, "group_name", "groupName", "name"),
		pickBodyString(body, "description"),
		pickBodyString(body, "group_type", "groupType"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceQueryAssetGroups(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	pageNo := pickBodyInt(body, "page_no", "pageNo")
	pageSize := pickBodyInt(body, "page_size", "pageSize")
	data, err := service.QuerySeedanceAssetGroups(
		userId,
		pageNo,
		pageSize,
		pickBodyString(body, "group_type", "groupType"),
		pickBodyStringSlice(body, "group_ids", "groupIds"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceGetAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.GetSeedanceAssetGroup(userId, c.Param("group_id"))
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedancePatchAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.PatchSeedanceAssetGroup(
		userId,
		c.Param("group_id"),
		pickBodyString(body, "group_name", "groupName", "name"),
		pickBodyString(body, "description"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceDeleteAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.DeleteSeedanceAssetGroup(userId, c.Param("group_id"))
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceCreateRemoteAsset(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.CreateSeedanceRemoteAsset(
		userId,
		pickBodyString(body, "url", "assetUrl", "asset_url"),
		pickBodyString(body, "type", "assetType"),
		pickBodyString(body, "name", "assetName", "asset_name"),
		pickBodyString(body, "group_id", "groupId"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceQueryAssets(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.QuerySeedanceAssets(userId, model.SeedanceAssetQuery{
		GroupId:  pickBodyString(body, "group_id", "groupId"),
		GroupIds: pickBodyStringSlice(body, "group_ids", "groupIds"),
		Type:     pickBodyString(body, "type"),
		Status:   pickBodyString(body, "status"),
		Statuses: pickBodyStringSlice(body, "statuses"),
		PageNo:   pickBodyInt(body, "page_no", "pageNo"),
		PageSize: pickBodyInt(body, "page_size", "pageSize"),
	})
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceGetAsset(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.GetSeedanceAsset(userId, c.Param("id"))
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedancePatchAsset(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	filename := pickBodyString(body, "filename", "name")
	data, err := service.PatchSeedanceAsset(userId, c.Param("id"), filename)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceDeleteAsset(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.DeleteSeedanceAsset(userId, c.Param("id"))
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceCreateRealPersonSession(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.CreateSeedanceRealPersonSession(userId)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceExchangeRealPersonAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.ExchangeSeedanceRealPersonAssetGroup(
		userId,
		pickBodyString(body, "byted_token", "bytedToken"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}
