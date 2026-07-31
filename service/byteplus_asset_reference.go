package service

import (
	"errors"
	"net/http"
	"regexp"
	"strings"

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

type bytePlusAssetReference struct {
	PublicID          string
	ExpectedAssetType string
}

func (r BytePlusAssetReferenceResolution) HasReferences() bool {
	return len(r.RewriteMap) > 0
}

func ResolveBytePlusAssetReferences(c *gin.Context, userID int, req *dto.SeedanceVideoRequest) (BytePlusAssetReferenceResolution, *types.NewAPIError) {
	references, apiErr := extractBytePlusAssetPublicIDs(req)
	if apiErr != nil {
		return BytePlusAssetReferenceResolution{}, apiErr
	}
	if len(references) == 0 {
		return BytePlusAssetReferenceResolution{}, nil
	}
	publicIDs := make([]string, 0, len(references))
	for _, reference := range references {
		publicIDs = append(publicIDs, reference.PublicID)
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
	for _, reference := range references {
		if _, ok := byID[reference.PublicID]; !ok {
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
		}
	}
	for _, reference := range references {
		asset := byID[reference.PublicID]
		if asset.Status == model.BytePlusAssetStatusDeleted {
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
		}
	}
	profileIDs := make(map[int64]struct{})
	for _, reference := range references {
		asset := byID[reference.PublicID]
		if asset.RealPersonProfileId != nil {
			profileIDs[*asset.RealPersonProfileId] = struct{}{}
		}
	}
	if len(profileIDs) > 1 {
		return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset real person profiles do not match"), types.ErrorCodeAssetProfileConflict, http.StatusConflict)
	}
	for profileID := range profileIDs {
		profile, err := model.GetBytePlusRealPersonProfileByIDForUser(userID, profileID)
		if err != nil {
			if model.IsBytePlusRealPersonNotFound(err) {
				return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
			}
			return BytePlusAssetReferenceResolution{}, assetError(err, types.ErrorCodeAssetStorageError, http.StatusInternalServerError)
		}
		if profile.Status != model.BytePlusRealPersonProfileStatusActive {
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("real person profile is not active"), types.ErrorCodeRealPersonNotActive, http.StatusConflict)
		}
		for _, reference := range references {
			asset := byID[reference.PublicID]
			if asset.RealPersonProfileId != nil && *asset.RealPersonProfileId == profileID && asset.ChannelId != profile.ChannelId {
				return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset channel does not match real person profile"), types.ErrorCodeAssetChannelConflict, http.StatusConflict)
			}
		}
	}
	for _, reference := range references {
		asset := byID[reference.PublicID]
		if asset.ChannelId > 0 {
			if pinnedChannelID == 0 {
				pinnedChannelID = asset.ChannelId
			} else if pinnedChannelID != asset.ChannelId {
				return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset channels do not match"), types.ErrorCodeAssetChannelConflict, http.StatusConflict)
			}
		}
	}
	for _, reference := range references {
		asset := byID[reference.PublicID]
		if asset.AssetType != reference.ExpectedAssetType {
			return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset type does not match media type"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
		}
		switch asset.Status {
		case model.BytePlusAssetStatusActive:
		case model.BytePlusAssetStatusCreating, model.BytePlusAssetStatusProcessing, model.BytePlusAssetStatusDeleting:
			return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
		case model.BytePlusAssetStatusFailed:
			return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset failed"), types.ErrorCodeAssetFailed, http.StatusUnprocessableEntity)
		case model.BytePlusAssetStatusDeleted:
			return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset not found"), types.ErrorCodeAssetNotFound, http.StatusNotFound)
		default:
			return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
		}
		if asset.ChannelId <= 0 {
			return BytePlusAssetReferenceResolution{}, assetError(errors.New("asset channel unavailable"), types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
		}
		upstreamAssetID := strings.TrimSpace(asset.UpstreamAssetId)
		if upstreamAssetID == "" {
			return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
		}
		rewriteMap["asset://"+reference.PublicID] = "asset://" + upstreamAssetID
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

func extractBytePlusAssetPublicIDs(req *dto.SeedanceVideoRequest) ([]bytePlusAssetReference, *types.NewAPIError) {
	if req == nil {
		return nil, nil
	}
	seen := make(map[string]struct{})
	references := make([]bytePlusAssetReference, 0)
	add := func(raw, expectedAssetType string) *types.NewAPIError {
		matches := bytePlusAssetURIPattern.FindStringSubmatch(raw)
		if len(matches) != 2 {
			if isMalformedBytePlusAssetURI(raw) {
				return assetError(errors.New("invalid asset URI"), types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
			}
			return nil
		}
		seenKey := matches[1] + "\x00" + expectedAssetType
		if _, ok := seen[seenKey]; ok {
			return nil
		}
		seen[seenKey] = struct{}{}
		references = append(references, bytePlusAssetReference{PublicID: matches[1], ExpectedAssetType: expectedAssetType})
		return nil
	}
	for _, item := range req.Content {
		if item.ImageURL != nil {
			if apiErr := add(item.ImageURL.URL, "Image"); apiErr != nil {
				return nil, apiErr
			}
		}
		if item.VideoURL != nil {
			if apiErr := add(item.VideoURL.URL, "Video"); apiErr != nil {
				return nil, apiErr
			}
		}
		if item.AudioURL != nil {
			if apiErr := add(item.AudioURL.URL, "Audio"); apiErr != nil {
				return nil, apiErr
			}
		}
	}
	return references, nil
}

func isMalformedBytePlusAssetURI(raw string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(raw)), "asset:")
}
