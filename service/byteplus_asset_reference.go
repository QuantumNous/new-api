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

type bytePlusResolvableAsset struct {
	PublicID   string
	AssetType  string
	Status     string
	Candidates []bytePlusAssetBindingCandidate
}

type bytePlusAssetBindingCandidate struct {
	ChannelID       int
	UpstreamAssetID string
	Status          string
}

func (r BytePlusAssetReferenceResolution) HasReferences() bool {
	return len(r.RewriteMap) > 0
}

func (r BytePlusAssetReferenceResolution) HasPinnedReference() bool {
	return r.PinnedChannelID > 0
}

func ResolveBytePlusAssetReferences(c *gin.Context, userID int, req *dto.SeedanceVideoRequest) (BytePlusAssetReferenceResolution, *types.NewAPIError) {
	legacyResolution, legacyErr := ResolveLegacyBytePlusAssetBindingReferences(userID, req)
	if legacyErr != nil {
		return legacyResolution, legacyErr
	}
	set, apiErr := ResolveAssetReferences(c, userID, req)
	if apiErr != nil {
		return BytePlusAssetReferenceResolution{}, apiErr
	}
	if !set.HasReferences() {
		return BytePlusAssetReferenceResolution{}, nil
	}
	pinnedChannelID, rewriteMap, ok := assetReferenceBestBoundChannel(set)
	if !ok {
		if legacyResolution.PinnedChannelID > 0 && assetReferenceSetIsLegacyBytePlusOnly(set) {
			return BytePlusAssetReferenceResolution{PinnedChannelID: legacyResolution.PinnedChannelID}, assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
		}
		return BytePlusAssetReferenceResolution{PinnedChannelID: pinnedChannelID}, assetError(errors.New("asset channel unavailable"), types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
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

func assetReferenceSetIsLegacyBytePlusOnly(set AssetReferenceSet) bool {
	if !set.HasReferences() {
		return false
	}
	for _, reference := range set.references {
		asset, ok := set.assets[reference.PublicID]
		if !ok || !asset.LegacyBytePlus {
			return false
		}
	}
	return true
}

func rawPositiveBytePlusAssetChannels(candidates []bytePlusAssetBindingCandidate) map[int]struct{} {
	channels := make(map[int]struct{}, len(candidates))
	for _, candidate := range candidates {
		if candidate.ChannelID > 0 {
			channels[candidate.ChannelID] = struct{}{}
		}
	}
	return channels
}

func validateBytePlusAssetLifecycle(status string) *types.NewAPIError {
	switch status {
	case model.BytePlusAssetStatusActive:
		return nil
	case model.BytePlusAssetStatusFailed:
		return assetError(errors.New("asset failed"), types.ErrorCodeAssetFailed, http.StatusUnprocessableEntity)
	case model.BytePlusAssetStatusCreating, model.BytePlusAssetStatusProcessing:
		return assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
	default:
		return assetError(errors.New("asset is not active"), types.ErrorCodeAssetNotReady, http.StatusConflict)
	}
}

func lowestChannelID(channels map[int]struct{}) int {
	lowest := 0
	for channelID := range channels {
		if lowest == 0 || channelID < lowest {
			lowest = channelID
		}
	}
	return lowest
}

func bytePlusAssetCandidateForPinnedChannel(candidates []bytePlusAssetBindingCandidate, pinnedChannelID int) bytePlusAssetBindingCandidate {
	if pinnedChannelID > 0 {
		for _, candidate := range candidates {
			if candidate.ChannelID == pinnedChannelID {
				return candidate
			}
		}
		return bytePlusAssetBindingCandidate{}
	}
	if len(candidates) == 0 {
		return bytePlusAssetBindingCandidate{}
	}
	return candidates[0]
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
