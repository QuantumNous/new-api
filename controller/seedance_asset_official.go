package controller

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func SeedanceOfficialCreateAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.CreateSeedanceAssetGroupFor(
		userId,
		model.SeedanceProviderOfficial,
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

func SeedanceOfficialQueryAssetGroups(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.QuerySeedanceAssetGroupsFor(
		userId,
		model.SeedanceProviderOfficial,
		pickBodyInt(body, "page_no", "pageNo"),
		pickBodyInt(body, "page_size", "pageSize"),
		pickBodyString(body, "group_type", "groupType"),
		pickBodyStringSlice(body, "group_ids", "groupIds"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceOfficialGetAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.GetSeedanceAssetGroupFor(userId, model.SeedanceProviderOfficial, c.Param("group_id"))
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceOfficialPatchAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.PatchSeedanceAssetGroupFor(
		userId,
		model.SeedanceProviderOfficial,
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

func SeedanceOfficialDeleteAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.DeleteSeedanceAssetGroupFor(userId, model.SeedanceProviderOfficial, c.Param("group_id"))
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceOfficialCreateRemoteAsset(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.CreateSeedanceRemoteAssetFor(
		userId,
		model.SeedanceProviderOfficial,
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

func SeedanceOfficialQueryAssets(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.QuerySeedanceAssetsFor(userId, model.SeedanceProviderOfficial, model.SeedanceAssetQuery{
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

func SeedanceOfficialGetAsset(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.GetSeedanceAssetFor(userId, model.SeedanceProviderOfficial, c.Param("id"))
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceOfficialPatchAsset(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.PatchSeedanceAssetFor(
		userId,
		model.SeedanceProviderOfficial,
		c.Param("id"),
		pickBodyString(body, "filename", "name"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceOfficialDeleteAsset(c *gin.Context) {
	userId := c.GetInt("id")
	data, err := service.DeleteSeedanceAssetFor(userId, model.SeedanceProviderOfficial, c.Param("id"))
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceOfficialCreateRealPersonSession(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.CreateSeedanceRealPersonSessionFor(
		userId,
		model.SeedanceProviderOfficial,
		pickBodyString(body, "callback_url", "callbackUrl"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}

func SeedanceOfficialExchangeRealPersonAssetGroup(c *gin.Context) {
	userId := c.GetInt("id")
	body := seedanceBodyMap(c)
	data, err := service.ExchangeSeedanceRealPersonAssetGroupFor(
		userId,
		model.SeedanceProviderOfficial,
		pickBodyString(body, "byted_token", "bytedToken"),
	)
	if err != nil {
		seedanceFail(c, err)
		return
	}
	seedanceOK(c, data)
}
