package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetAllCreativeCenterAssets(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	queryParams := buildCreativeCenterAssetQueryParams(c)

	assets, err := model.GetAllCreativeCenterAssets(queryParams)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(len(assets))
	pageInfo.SetItems(sliceCreativeCenterAssets(assets, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), true))
	common.ApiSuccess(c, pageInfo)
}

func GetUserCreativeCenterAssets(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userID := c.GetInt("id")
	queryParams := buildCreativeCenterAssetQueryParams(c)

	assets, err := model.GetUserCreativeCenterAssets(userID, queryParams)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(len(assets))
	pageInfo.SetItems(sliceCreativeCenterAssets(assets, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), false))
	common.ApiSuccess(c, pageInfo)
}

func DownloadAllCreativeCenterAssets(c *gin.Context) {
	queryParams := buildCreativeCenterAssetQueryParams(c)
	assets, err := model.GetAllCreativeCenterAssets(queryParams)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	downloadCreativeCenterAssets(c, assets)
}

func DownloadUserCreativeCenterAssets(c *gin.Context) {
	userID := c.GetInt("id")
	queryParams := buildCreativeCenterAssetQueryParams(c)
	assets, err := model.GetUserCreativeCenterAssets(userID, queryParams)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	downloadCreativeCenterAssets(c, assets)
}

func buildCreativeCenterAssetQueryParams(c *gin.Context) model.CreativeCenterAssetQueryParams {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	return model.CreativeCenterAssetQueryParams{
		Type:           c.Query("type"),
		Keyword:        c.Query("keyword"),
		ModelName:      c.Query("model_name"),
		Status:         c.Query("status"),
		Username:       c.Query("username"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
	}
}

func downloadCreativeCenterAssets(c *gin.Context, availableAssets []*dto.CreativeCenterAsset) {
	request := &dto.CreativeCenterAssetDownloadRequest{}
	if err := common.DecodeJson(c.Request.Body, request); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(request.AssetIDs) == 0 {
		common.ApiErrorMsg(c, "asset_ids is required")
		return
	}

	selectedAssets := filterCreativeCenterAssetsByIDs(availableAssets, request.AssetIDs)
	if len(selectedAssets) == 0 {
		common.ApiErrorMsg(c, "no matching assets found")
		return
	}

	archive, err := service.CreateCreativeCenterAssetArchive(selectedAssets, buildRequestBaseURL(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer service.CleanupCreativeCenterArchiveFile(archive.FilePath)

	payload, err := service.ReadCreativeCenterArchiveFile(archive.FilePath)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", archive.DownloadName))
	c.Header("Content-Length", strconv.Itoa(len(payload)))
	c.Data(http.StatusOK, "application/zip", payload)
}

func filterCreativeCenterAssetsByIDs(assets []*dto.CreativeCenterAsset, assetIDs []string) []*dto.CreativeCenterAsset {
	if len(assetIDs) == 0 || len(assets) == 0 {
		return nil
	}

	selected := make(map[string]struct{}, len(assetIDs))
	for _, assetID := range assetIDs {
		trimmed := strings.TrimSpace(assetID)
		if trimmed == "" {
			continue
		}
		selected[trimmed] = struct{}{}
	}

	result := make([]*dto.CreativeCenterAsset, 0, len(selected))
	for _, asset := range assets {
		if asset == nil {
			continue
		}
		if _, ok := selected[asset.AssetID]; ok {
			result = append(result, asset)
		}
	}

	return result
}

func sliceCreativeCenterAssets(assets []*dto.CreativeCenterAsset, startIdx int, pageSize int, includeUsername bool) []*dto.CreativeCenterAsset {
	if startIdx < 0 {
		startIdx = 0
	}
	if startIdx >= len(assets) {
		return []*dto.CreativeCenterAsset{}
	}

	endIdx := startIdx + pageSize
	if endIdx > len(assets) {
		endIdx = len(assets)
	}

	items := make([]*dto.CreativeCenterAsset, 0, endIdx-startIdx)
	for _, asset := range assets[startIdx:endIdx] {
		if asset == nil {
			continue
		}
		copyAsset := *asset
		if !includeUsername {
			copyAsset.Username = ""
		}
		items = append(items, &copyAsset)
	}

	return items
}

func buildRequestBaseURL(c *gin.Context) string {
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	} else if forwardedProto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwardedProto != "" {
		scheme = forwardedProto
	}
	return fmt.Sprintf("%s://%s", scheme, c.Request.Host)
}
