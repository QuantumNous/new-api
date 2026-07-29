package service

import (
	"errors"
	"net/http"
	"regexp"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

var bytePlusAssetURIPattern = regexp.MustCompile(`^asset://(ast_[A-Za-z0-9]{32})$`)

type BytePlusAssetReferenceResolution struct {
	PinnedChannelID int
	RewriteMap      map[string]string
}

func (r BytePlusAssetReferenceResolution) HasReferences() bool {
	return len(r.RewriteMap) > 0
}

func ResolveBytePlusAssetReferences(c *gin.Context, userID int, req *dto.SeedanceVideoRequest) (BytePlusAssetReferenceResolution, *types.NewAPIError) {
	publicIDs := extractBytePlusAssetPublicIDs(req)
	if len(publicIDs) == 0 {
		return BytePlusAssetReferenceResolution{}, nil
	}

	assets, err := model.GetBytePlusAssetsByPublicIDsForUser(userID, publicIDs)
	if err != nil {
		return BytePlusAssetReferenceResolution{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
	}
	byID := make(map[string]model.BytePlusAsset, len(assets))
	for _, asset := range assets {
		byID[asset.PublicId] = asset
	}

	rewriteMap := make(map[string]string, len(publicIDs))
	pinnedChannelID := 0
	for _, publicID := range publicIDs {
		asset, ok := byID[publicID]
		if !ok {
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
		}
		switch asset.Status {
		case model.BytePlusAssetStatusActive:
		case model.BytePlusAssetStatusCreating, model.BytePlusAssetStatusProcessing:
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
		case model.BytePlusAssetStatusFailed:
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset failed"), types.ErrorCodeAssetFailed, http.StatusUnprocessableEntity)
		default:
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
		}
		if pinnedChannelID == 0 {
			pinnedChannelID = asset.ChannelId
		} else if pinnedChannelID != asset.ChannelId {
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset channels do not match"), types.ErrorCodeAssetChannelConflict, http.StatusConflict)
		}
		rewriteMap["asset://"+publicID] = "asset://" + asset.UpstreamAssetId
	}

	resolution := BytePlusAssetReferenceResolution{
		PinnedChannelID: pinnedChannelID,
		RewriteMap:      rewriteMap,
	}
	if c != nil && resolution.HasReferences() {
		common.SetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap, rewriteMap)
		common.SetContextKey(c, constant.ContextKeyBytePlusAssetPinnedChannelID, pinnedChannelID)
	}
	return resolution, nil
}

func IsStrictBytePlusAssetURI(raw string) bool {
	return bytePlusAssetURIPattern.MatchString(raw)
}

func extractBytePlusAssetPublicIDs(req *dto.SeedanceVideoRequest) []string {
	if req == nil {
		return nil
	}
	seen := make(map[string]struct{})
	ids := make([]string, 0)
	add := func(raw string) {
		matches := bytePlusAssetURIPattern.FindStringSubmatch(raw)
		if len(matches) != 2 {
			return
		}
		if _, ok := seen[matches[1]]; ok {
			return
		}
		seen[matches[1]] = struct{}{}
		ids = append(ids, matches[1])
	}
	for _, item := range req.Content {
		switch item.Type {
		case dto.SeedanceContentImage:
			if item.ImageURL != nil {
				add(item.ImageURL.URL)
			}
		case dto.SeedanceContentVideo:
			if item.VideoURL != nil {
				add(item.VideoURL.URL)
			}
		case dto.SeedanceContentAudio:
			if item.AudioURL != nil {
				add(item.AudioURL.URL)
			}
		}
	}
	return ids
}
