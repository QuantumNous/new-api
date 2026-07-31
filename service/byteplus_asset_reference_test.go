package service

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestResolveBytePlusAssetReferencesStoresRewriteAndPinnedChannel(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	active := insertBytePlusReferenceAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", " upstream-image ", model.BytePlusAssetStatusActive)
	insertBytePlusReferenceAsset(t, 7, 131, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-audio", model.BytePlusAssetStatusActive)

	c := newAssetReferenceContext()
	req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + active.PublicId}},
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + active.PublicId}},
		{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://example.com/video.mp4"}},
	}}

	resolution, apiErr := ResolveBytePlusAssetReferences(c, 7, req)
	if apiErr != nil {
		t.Fatalf("ResolveBytePlusAssetReferences error: %v", apiErr)
	}
	if resolution.PinnedChannelID != 131 {
		t.Fatalf("PinnedChannelID = %d, want 131", resolution.PinnedChannelID)
	}
	if got := resolution.RewriteMap["asset://"+active.PublicId]; got != "asset://upstream-image" {
		t.Fatalf("rewrite = %q, want asset://upstream-image", got)
	}
	if len(resolution.RewriteMap) != 1 {
		t.Fatalf("rewrite map len = %d, want deduped 1", len(resolution.RewriteMap))
	}
	storedMap, ok := common.GetContextKeyType[map[string]string](c, constant.ContextKeyBytePlusAssetRewriteMap)
	if !ok || storedMap["asset://"+active.PublicId] != "asset://upstream-image" {
		t.Fatalf("stored rewrite map = %#v, ok=%v", storedMap, ok)
	}
	if got := common.GetContextKeyInt(c, constant.ContextKeyBytePlusAssetPinnedChannelID); got != 131 {
		t.Fatalf("stored pinned channel id = %d, want 131", got)
	}
}

func TestResolveBytePlusAssetReferencesRequiresMatchingMediaType(t *testing.T) {
	tests := []struct {
		name          string
		assetType     string
		contentType   string
		wantErrorCode types.ErrorCode
	}{
		{name: "image in image_url", assetType: "Image", contentType: dto.SeedanceContentImage},
		{name: "video in video_url", assetType: "Video", contentType: dto.SeedanceContentVideo},
		{name: "audio in audio_url", assetType: "Audio", contentType: dto.SeedanceContentAudio},
		{name: "image in video_url", assetType: "Image", contentType: dto.SeedanceContentVideo, wantErrorCode: types.ErrorCodeInvalidAssetRequest},
		{name: "video in audio_url", assetType: "Video", contentType: dto.SeedanceContentAudio, wantErrorCode: types.ErrorCodeInvalidAssetRequest},
		{name: "audio in image_url", assetType: "Audio", contentType: dto.SeedanceContentImage, wantErrorCode: types.ErrorCodeInvalidAssetRequest},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			asset := insertBytePlusReferenceAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-asset", model.BytePlusAssetStatusActive)
			if err := model.DB.Model(&asset).Update("asset_type", tt.assetType).Error; err != nil {
				t.Fatalf("update asset type: %v", err)
			}

			item := dto.SeedanceContentItem{Type: tt.contentType}
			switch tt.contentType {
			case dto.SeedanceContentImage:
				item.ImageURL = &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}
			case dto.SeedanceContentVideo:
				item.VideoURL = &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}
			case dto.SeedanceContentAudio:
				item.AudioURL = &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}
			}

			resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{
				Content: []dto.SeedanceContentItem{item},
			})
			if tt.wantErrorCode == "" {
				if apiErr != nil {
					t.Fatalf("ResolveBytePlusAssetReferences error: %v", apiErr)
				}
				if !resolution.HasReferences() {
					t.Fatal("expected asset reference resolution")
				}
				return
			}
			if apiErr == nil {
				t.Fatal("expected asset type mismatch error")
			}
			if apiErr.GetErrorCode() != tt.wantErrorCode || apiErr.StatusCode != http.StatusBadRequest {
				t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, tt.wantErrorCode, http.StatusBadRequest)
			}
			if resolution.HasReferences() {
				t.Fatalf("unexpected references: %#v", resolution)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesScansPopulatedMediaFieldsIndependentOfType(t *testing.T) {
	tests := []struct {
		name      string
		item      func(image, video model.BytePlusAsset) dto.SeedanceContentItem
		wantRefs  int
		wantImage bool
		wantVideo bool
	}{
		{
			name: "missing type image field",
			item: func(image, video model.BytePlusAsset) dto.SeedanceContentItem {
				return dto.SeedanceContentItem{ImageURL: &dto.SeedanceURLObject{URL: "asset://" + image.PublicId}}
			},
			wantRefs:  1,
			wantImage: true,
		},
		{
			name: "wrong type video field",
			item: func(image, video model.BytePlusAsset) dto.SeedanceContentItem {
				return dto.SeedanceContentItem{Type: dto.SeedanceContentText, VideoURL: &dto.SeedanceURLObject{URL: "asset://" + video.PublicId}}
			},
			wantRefs:  1,
			wantVideo: true,
		},
		{
			name: "multiple populated media fields",
			item: func(image, video model.BytePlusAsset) dto.SeedanceContentItem {
				return dto.SeedanceContentItem{
					Type:     dto.SeedanceContentImage,
					ImageURL: &dto.SeedanceURLObject{URL: "asset://" + image.PublicId},
					VideoURL: &dto.SeedanceURLObject{URL: "asset://" + video.PublicId},
				}
			},
			wantRefs:  2,
			wantImage: true,
			wantVideo: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			image := insertBytePlusReferenceAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
			video := insertBytePlusReferenceAsset(t, 7, 131, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-video", model.BytePlusAssetStatusActive)
			if err := model.DB.Model(&video).Update("asset_type", "Video").Error; err != nil {
				t.Fatalf("update video asset type: %v", err)
			}

			resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{
				Content: []dto.SeedanceContentItem{tt.item(image, video)},
			})
			if apiErr != nil {
				t.Fatalf("ResolveBytePlusAssetReferences error: %v", apiErr)
			}
			if len(resolution.RewriteMap) != tt.wantRefs {
				t.Fatalf("rewrite map len = %d, want %d: %#v", len(resolution.RewriteMap), tt.wantRefs, resolution.RewriteMap)
			}
			if tt.wantImage && resolution.RewriteMap["asset://"+image.PublicId] != "asset://upstream-image" {
				t.Fatalf("image rewrite missing: %#v", resolution.RewriteMap)
			}
			if tt.wantVideo && resolution.RewriteMap["asset://"+video.PublicId] != "asset://upstream-video" {
				t.Fatalf("video rewrite missing: %#v", resolution.RewriteMap)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesValidatesAssetTypeByPopulatedField(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	asset := insertBytePlusReferenceAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
	req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentText, VideoURL: &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}},
	}}

	resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, req)
	if apiErr == nil {
		t.Fatal("expected asset type mismatch error")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeInvalidAssetRequest || apiErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	if resolution.HasReferences() {
		t.Fatalf("unexpected references: %#v", resolution)
	}
}

func TestResolveBytePlusAssetReferencesMapsStatusFailures(t *testing.T) {
	tests := []struct {
		name       string
		userID     int
		assetUser  int
		status     string
		wantCode   types.ErrorCode
		wantStatus int
	}{
		{name: "missing asset hides ownership", userID: 7, assetUser: 8, status: model.BytePlusAssetStatusActive, wantCode: types.ErrorCodeAssetNotFound, wantStatus: http.StatusNotFound},
		{name: "creating asset is not ready", userID: 7, assetUser: 7, status: model.BytePlusAssetStatusCreating, wantCode: types.ErrorCodeAssetNotReady, wantStatus: http.StatusConflict},
		{name: "processing asset is not ready", userID: 7, assetUser: 7, status: model.BytePlusAssetStatusProcessing, wantCode: types.ErrorCodeAssetNotReady, wantStatus: http.StatusConflict},
		{name: "failed asset is rejected", userID: 7, assetUser: 7, status: model.BytePlusAssetStatusFailed, wantCode: types.ErrorCodeAssetFailed, wantStatus: http.StatusUnprocessableEntity},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			asset := insertBytePlusReferenceAsset(t, tt.assetUser, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-asset", tt.status)
			req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
				{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}},
			}}

			_, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), tt.userID, req)
			if apiErr == nil {
				t.Fatal("expected api error")
			}
			if apiErr.GetErrorCode() != tt.wantCode || apiErr.StatusCode != tt.wantStatus {
				t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, tt.wantCode, tt.wantStatus)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesRejectsCrossChannelAssets(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	a := insertBytePlusReferenceAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
	b := insertBytePlusReferenceAsset(t, 7, 132, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-audio", model.BytePlusAssetStatusActive)
	if err := model.DB.Model(&b).Update("asset_type", "Audio").Error; err != nil {
		t.Fatalf("update audio asset type: %v", err)
	}
	req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + a.PublicId}},
		{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "asset://" + b.PublicId}},
	}}

	_, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, req)
	if apiErr == nil {
		t.Fatal("expected channel conflict")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeAssetChannelConflict || apiErr.StatusCode != http.StatusConflict {
		t.Fatalf("error code/status = %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode)
	}
}

func TestResolveBytePlusAssetReferencesAllowsMultipleAssetsFromSameRealPerson(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	profile := insertBytePlusReferenceProfile(t, 7, 131, "rph_same", model.BytePlusRealPersonProfileStatusActive)
	image := insertBytePlusReferenceRealPersonAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive, "Image", profile.Id)
	audio := insertBytePlusReferenceRealPersonAsset(t, 7, 131, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-audio", model.BytePlusAssetStatusActive, "Audio", profile.Id)

	resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(
		dto.SeedanceContentImage, image.PublicId,
		dto.SeedanceContentAudio, audio.PublicId,
	))
	if apiErr != nil {
		t.Fatalf("ResolveBytePlusAssetReferences error: %v", apiErr)
	}
	if resolution.PinnedChannelID != 131 {
		t.Fatalf("PinnedChannelID = %d, want 131", resolution.PinnedChannelID)
	}
	if len(resolution.RewriteMap) != 2 {
		t.Fatalf("rewrite map len = %d, want 2: %#v", len(resolution.RewriteMap), resolution.RewriteMap)
	}
	if resolution.RewriteMap["asset://"+image.PublicId] != "asset://upstream-image" {
		t.Fatalf("image rewrite missing: %#v", resolution.RewriteMap)
	}
	if resolution.RewriteMap["asset://"+audio.PublicId] != "asset://upstream-audio" {
		t.Fatalf("audio rewrite missing: %#v", resolution.RewriteMap)
	}
}

func TestResolveBytePlusAssetReferencesRejectsTwoRealPersonProfiles(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	first := insertBytePlusReferenceProfile(t, 7, 131, "rph_first", model.BytePlusRealPersonProfileStatusActive)
	second := insertBytePlusReferenceProfile(t, 7, 131, "rph_second", model.BytePlusRealPersonProfileStatusActive)
	image := insertBytePlusReferenceRealPersonAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive, "Image", first.Id)
	audio := insertBytePlusReferenceRealPersonAsset(t, 7, 131, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-audio", model.BytePlusAssetStatusActive, "Audio", second.Id)

	_, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(
		dto.SeedanceContentImage, image.PublicId,
		dto.SeedanceContentAudio, audio.PublicId,
	))
	if apiErr == nil {
		t.Fatal("expected profile conflict")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeAssetProfileConflict || apiErr.StatusCode != http.StatusConflict {
		t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeAssetProfileConflict, http.StatusConflict)
	}
}

func TestResolveBytePlusAssetReferencesAllowsSameChannelVirtualAndOneRealPerson(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	profile := insertBytePlusReferenceProfile(t, 7, 131, "rph_mixed", model.BytePlusRealPersonProfileStatusActive)
	realPerson := insertBytePlusReferenceRealPersonAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-person", model.BytePlusAssetStatusActive, "Image", profile.Id)
	virtual := insertBytePlusReferenceAsset(t, 7, 131, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-virtual", model.BytePlusAssetStatusActive)

	resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(
		dto.SeedanceContentImage, realPerson.PublicId,
		dto.SeedanceContentImage, virtual.PublicId,
	))
	if apiErr != nil {
		t.Fatalf("ResolveBytePlusAssetReferences error: %v", apiErr)
	}
	if resolution.PinnedChannelID != 131 {
		t.Fatalf("PinnedChannelID = %d, want 131", resolution.PinnedChannelID)
	}
	if len(resolution.RewriteMap) != 2 {
		t.Fatalf("rewrite map len = %d, want 2: %#v", len(resolution.RewriteMap), resolution.RewriteMap)
	}
}

func TestResolveBytePlusAssetReferencesReturnsProfileConflictBeforeChannelConflictForTwoPeople(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	first := insertBytePlusReferenceProfile(t, 7, 131, "rph_first_channel", model.BytePlusRealPersonProfileStatusActive)
	second := insertBytePlusReferenceProfile(t, 7, 132, "rph_second_channel", model.BytePlusRealPersonProfileStatusActive)
	image := insertBytePlusReferenceRealPersonAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive, "Image", first.Id)
	audio := insertBytePlusReferenceRealPersonAsset(t, 7, 132, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-audio", model.BytePlusAssetStatusActive, "Audio", second.Id)

	resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(
		dto.SeedanceContentImage, image.PublicId,
		dto.SeedanceContentAudio, audio.PublicId,
	))
	if apiErr == nil {
		t.Fatal("expected profile conflict")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeAssetProfileConflict || apiErr.StatusCode != http.StatusConflict {
		t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeAssetProfileConflict, http.StatusConflict)
	}
	if resolution.PinnedChannelID != 0 {
		t.Fatalf("pinned channel id = %d, want 0 before channel conflict loop", resolution.PinnedChannelID)
	}
}

func TestResolveBytePlusAssetReferencesRejectsDeletingAndDeleted(t *testing.T) {
	tests := []struct {
		name       string
		status     string
		wantCode   types.ErrorCode
		wantStatus int
	}{
		{name: "deleting", status: model.BytePlusAssetStatusDeleting, wantCode: types.ErrorCodeAssetNotReady, wantStatus: http.StatusConflict},
		{name: "deleted", status: model.BytePlusAssetStatusDeleted, wantCode: types.ErrorCodeAssetNotFound, wantStatus: http.StatusNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			asset := insertBytePlusReferenceAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", tt.status)

			_, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(dto.SeedanceContentImage, asset.PublicId))
			if apiErr == nil {
				t.Fatal("expected api error")
			}
			if apiErr.GetErrorCode() != tt.wantCode || apiErr.StatusCode != tt.wantStatus {
				t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, tt.wantCode, tt.wantStatus)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesDeletedRealPersonAssetsHideProfileConflict(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	first := insertBytePlusReferenceProfile(t, 7, 131, "rph_deleted_first", model.BytePlusRealPersonProfileStatusActive)
	second := insertBytePlusReferenceProfile(t, 7, 132, "rph_deleted_second", model.BytePlusRealPersonProfileStatusActive)
	image := insertBytePlusReferenceRealPersonAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusDeleted, "Image", first.Id)
	audio := insertBytePlusReferenceRealPersonAsset(t, 7, 132, "ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "upstream-audio", model.BytePlusAssetStatusDeleted, "Audio", second.Id)

	_, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(
		dto.SeedanceContentImage, image.PublicId,
		dto.SeedanceContentAudio, audio.PublicId,
	))
	if apiErr == nil {
		t.Fatal("expected deleted asset error")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeAssetNotFound || apiErr.StatusCode != http.StatusNotFound {
		t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeAssetNotFound, http.StatusNotFound)
	}
}

func TestResolveBytePlusAssetReferencesDeletedRealPersonAssetDoesNotObserveProfile(t *testing.T) {
	tests := []struct {
		name           string
		profileStatus  string
		profileChannel int
		assetChannel   int
	}{
		{name: "inactive profile", profileStatus: model.BytePlusRealPersonProfileStatusVerifying, profileChannel: 131, assetChannel: 131},
		{name: "profile channel mismatch", profileStatus: model.BytePlusRealPersonProfileStatusActive, profileChannel: 132, assetChannel: 131},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			profile := insertBytePlusReferenceProfile(t, 7, tt.profileChannel, "rph_deleted_"+strings.ReplaceAll(tt.name, " ", "_"), tt.profileStatus)
			asset := insertBytePlusReferenceRealPersonAsset(t, 7, tt.assetChannel, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusDeleted, "Image", profile.Id)

			_, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(dto.SeedanceContentImage, asset.PublicId))
			if apiErr == nil {
				t.Fatal("expected deleted asset error")
			}
			if apiErr.GetErrorCode() != types.ErrorCodeAssetNotFound || apiErr.StatusCode != http.StatusNotFound {
				t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeAssetNotFound, http.StatusNotFound)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesRejectsProfileOwnerOrChannelMismatch(t *testing.T) {
	tests := []struct {
		name           string
		profileUserID  int
		profileStatus  string
		profileChannel int
		assetChannel   int
		wantCode       types.ErrorCode
		wantStatus     int
	}{
		{name: "profile belongs to another user", profileUserID: 8, profileStatus: model.BytePlusRealPersonProfileStatusActive, profileChannel: 131, assetChannel: 131, wantCode: types.ErrorCodeAssetNotFound, wantStatus: http.StatusNotFound},
		{name: "profile channel differs from asset", profileUserID: 7, profileStatus: model.BytePlusRealPersonProfileStatusActive, profileChannel: 132, assetChannel: 131, wantCode: types.ErrorCodeAssetChannelConflict, wantStatus: http.StatusConflict},
		{name: "profile is not active", profileUserID: 7, profileStatus: model.BytePlusRealPersonProfileStatusVerifying, profileChannel: 131, assetChannel: 131, wantCode: types.ErrorCodeRealPersonNotActive, wantStatus: http.StatusConflict},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			profile := insertBytePlusReferenceProfile(t, tt.profileUserID, tt.profileChannel, "rph_"+strings.ReplaceAll(tt.name, " ", "_"), tt.profileStatus)
			asset := insertBytePlusReferenceRealPersonAsset(t, 7, tt.assetChannel, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive, "Image", profile.Id)

			_, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(dto.SeedanceContentImage, asset.PublicId))
			if apiErr == nil {
				t.Fatal("expected api error")
			}
			if apiErr.GetErrorCode() != tt.wantCode || apiErr.StatusCode != tt.wantStatus {
				t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, tt.wantCode, tt.wantStatus)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesStillRejectsRealPersonMediaTypeMismatch(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	profile := insertBytePlusReferenceProfile(t, 7, 131, "rph_type", model.BytePlusRealPersonProfileStatusActive)
	asset := insertBytePlusReferenceRealPersonAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", "upstream-video", model.BytePlusAssetStatusActive, "Video", profile.Id)

	resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, newBytePlusReferenceRequest(dto.SeedanceContentImage, asset.PublicId))
	if apiErr == nil {
		t.Fatal("expected invalid asset request")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeInvalidAssetRequest || apiErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
	}
	if resolution.HasReferences() {
		t.Fatalf("unexpected references: %#v", resolution)
	}
}

func TestResolveBytePlusAssetReferencesDetectsCrossChannelBeforeOwnedAssetValidationErrors(t *testing.T) {
	tests := []struct {
		name  string
		specs []struct {
			channelID   int
			status      string
			assetType   string
			contentType string
		}
	}{
		{
			name: "processing asset first",
			specs: []struct {
				channelID   int
				status      string
				assetType   string
				contentType string
			}{
				{channelID: 131, status: model.BytePlusAssetStatusProcessing, assetType: "Image", contentType: dto.SeedanceContentImage},
				{channelID: 132, status: model.BytePlusAssetStatusActive, assetType: "Image", contentType: dto.SeedanceContentImage},
			},
		},
		{
			name: "type mismatch first",
			specs: []struct {
				channelID   int
				status      string
				assetType   string
				contentType string
			}{
				{channelID: 131, status: model.BytePlusAssetStatusActive, assetType: "Image", contentType: dto.SeedanceContentVideo},
				{channelID: 132, status: model.BytePlusAssetStatusActive, assetType: "Image", contentType: dto.SeedanceContentImage},
			},
		},
		{
			name: "invalid channel first",
			specs: []struct {
				channelID   int
				status      string
				assetType   string
				contentType string
			}{
				{channelID: 0, status: model.BytePlusAssetStatusActive, assetType: "Image", contentType: dto.SeedanceContentImage},
				{channelID: 131, status: model.BytePlusAssetStatusActive, assetType: "Image", contentType: dto.SeedanceContentImage},
				{channelID: 132, status: model.BytePlusAssetStatusActive, assetType: "Image", contentType: dto.SeedanceContentImage},
			},
		},
	}
	publicIDs := []string{
		"ast_1234567890abcdefABCDEF1234567890",
		"ast_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"ast_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			content := make([]dto.SeedanceContentItem, 0, len(tt.specs))
			for i, spec := range tt.specs {
				asset := insertBytePlusReferenceAsset(t, 7, spec.channelID, publicIDs[i], "upstream-"+string(rune('a'+i)), spec.status)
				if spec.assetType != "Image" {
					if err := model.DB.Model(&asset).Update("asset_type", spec.assetType).Error; err != nil {
						t.Fatalf("update asset type: %v", err)
					}
				}
				item := dto.SeedanceContentItem{Type: spec.contentType}
				switch spec.contentType {
				case dto.SeedanceContentVideo:
					item.VideoURL = &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}
				default:
					item.ImageURL = &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}
				}
				content = append(content, item)
			}

			resolution, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, &dto.SeedanceVideoRequest{Content: content})
			if apiErr == nil {
				t.Fatal("expected channel conflict")
			}
			if apiErr.GetErrorCode() != types.ErrorCodeAssetChannelConflict || apiErr.StatusCode != http.StatusConflict {
				t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeAssetChannelConflict, http.StatusConflict)
			}
			if resolution.PinnedChannelID != 131 {
				t.Fatalf("pinned channel id = %d, want 131", resolution.PinnedChannelID)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesRejectsActiveAssetsWithInvalidChannelID(t *testing.T) {
	tests := []struct {
		name      string
		channelID int
	}{
		{name: "zero", channelID: 0},
		{name: "negative", channelID: -1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			asset := insertBytePlusReferenceAsset(t, 7, tt.channelID, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusActive)
			c := newAssetReferenceContext()
			req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
				{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}},
			}}

			resolution, apiErr := ResolveBytePlusAssetReferences(c, 7, req)
			if apiErr == nil {
				t.Fatal("expected channel unavailable error")
			}
			if apiErr.GetErrorCode() != types.ErrorCodeAssetChannelUnavailable || apiErr.StatusCode != http.StatusServiceUnavailable {
				t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeAssetChannelUnavailable, http.StatusServiceUnavailable)
			}
			if resolution.HasReferences() {
				t.Fatalf("unexpected references: %#v", resolution)
			}
			if _, ok := common.GetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap); ok {
				t.Fatal("rewrite map should not be stored for invalid asset channel")
			}
			if got := common.GetContextKeyInt(c, constant.ContextKeyBytePlusAssetPinnedChannelID); got != 0 {
				t.Fatalf("pinned channel id = %d, want 0", got)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesMapsFailedStatusBeforeInvalidChannelID(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	asset := insertBytePlusReferenceAsset(t, 7, 0, "ast_1234567890abcdefABCDEF1234567890", "upstream-image", model.BytePlusAssetStatusFailed)
	c := newAssetReferenceContext()
	req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}},
	}}

	resolution, apiErr := ResolveBytePlusAssetReferences(c, 7, req)
	if apiErr == nil {
		t.Fatal("expected failed asset error")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeAssetFailed || apiErr.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeAssetFailed, http.StatusUnprocessableEntity)
	}
	if resolution.HasReferences() {
		t.Fatalf("unexpected references: %#v", resolution)
	}
	if _, ok := common.GetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap); ok {
		t.Fatal("rewrite map should not be stored for failed asset")
	}
	if got := common.GetContextKeyInt(c, constant.ContextKeyBytePlusAssetPinnedChannelID); got != 0 {
		t.Fatalf("pinned channel id = %d, want 0", got)
	}
}

func TestResolveBytePlusAssetReferencesRejectsActiveAssetWithoutUpstreamID(t *testing.T) {
	tests := []struct {
		name       string
		upstreamID string
	}{
		{name: "empty", upstreamID: ""},
		{name: "blank", upstreamID: " \t\n "},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			newBytePlusAssetReferenceDB(t)
			asset := insertBytePlusReferenceAsset(t, 7, 131, "ast_1234567890abcdefABCDEF1234567890", tt.upstreamID, model.BytePlusAssetStatusActive)
			c := newAssetReferenceContext()
			req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
				{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://" + asset.PublicId}},
			}}

			_, apiErr := ResolveBytePlusAssetReferences(c, 7, req)
			if apiErr == nil {
				t.Fatal("expected not-ready error")
			}
			if apiErr.GetErrorCode() != types.ErrorCodeAssetNotReady || apiErr.StatusCode != http.StatusConflict {
				t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeAssetNotReady, http.StatusConflict)
			}
			if _, ok := common.GetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap); ok {
				t.Fatal("rewrite map should not be stored for active asset without upstream id")
			}
			if got := common.GetContextKeyInt(c, constant.ContextKeyBytePlusAssetPinnedChannelID); got != 0 {
				t.Fatalf("pinned channel id = %d, want 0", got)
			}
		})
	}
}

func TestResolveBytePlusAssetReferencesRejectsMalformedAssetMediaURLs(t *testing.T) {
	malformedValues := []string{
		"asset://ast_short",
		"asset://ast_1234567890abcdefABCDEF123456789012",
		"asset://ast_1234567890abcdefABCDEF12345678--",
		"asset://",
		"asset://ast_1234567890abcdefABCDEF1234567890?x=1",
		"asset://ast_1234567890abcdefABCDEF1234567890#ref",
		"asset://ast_1234567890abcdefABCDEF1234567890/extra",
		"asset:ast_1234567890abcdefABCDEF1234567890",
		"asset:/ast_1234567890abcdefABCDEF1234567890",
		" asset://ast_1234567890abcdefABCDEF1234567890",
		"asset://ast_1234567890abcdefABCDEF1234567890 ",
		"ASSET://ast_1234567890abcdefABCDEF1234567890",
	}
	mediaItems := []struct {
		name string
		item func(string) dto.SeedanceContentItem
	}{
		{
			name: "image_url",
			item: func(url string) dto.SeedanceContentItem {
				return dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: url}}
			},
		},
		{
			name: "video_url",
			item: func(url string) dto.SeedanceContentItem {
				return dto.SeedanceContentItem{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: url}}
			},
		},
		{
			name: "audio_url",
			item: func(url string) dto.SeedanceContentItem {
				return dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: url}}
			},
		},
	}
	for _, media := range mediaItems {
		for _, malformed := range malformedValues {
			t.Run(media.name+"/"+malformed, func(t *testing.T) {
				db := newBytePlusAssetReferenceDB(t)
				sqlDB, err := db.DB()
				if err != nil {
					t.Fatalf("get sqlite handle: %v", err)
				}
				if err := sqlDB.Close(); err != nil {
					t.Fatalf("close sqlite: %v", err)
				}
				c := newAssetReferenceContext()
				req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{media.item(malformed)}}

				resolution, apiErr := ResolveBytePlusAssetReferences(c, 7, req)
				if apiErr == nil {
					t.Fatal("expected invalid asset request")
				}
				if apiErr.GetErrorCode() != types.ErrorCodeInvalidAssetRequest || apiErr.StatusCode != http.StatusBadRequest {
					t.Fatalf("error code/status = %s/%d, want %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode, types.ErrorCodeInvalidAssetRequest, http.StatusBadRequest)
				}
				text := apiErr.ToOpenAIError().Message + " " + apiErr.Error()
				if strings.Contains(text, malformed) {
					t.Fatalf("public error leaked malformed URI %q in %q", malformed, text)
				}
				if resolution.HasReferences() {
					t.Fatalf("unexpected references: %#v", resolution)
				}
				if _, ok := common.GetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap); ok {
					t.Fatal("rewrite map should not be stored for malformed asset URI")
				}
				if got := common.GetContextKeyInt(c, constant.ContextKeyBytePlusAssetPinnedChannelID); got != 0 {
					t.Fatalf("pinned channel id = %d, want 0", got)
				}
			})
		}
	}
}

func TestResolveBytePlusAssetReferencesAllowsNonAssetURLsAndTextMentions(t *testing.T) {
	db := newBytePlusAssetReferenceDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sqlite handle: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close sqlite: %v", err)
	}
	c := newAssetReferenceContext()
	req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentText, Text: "use asset://ast_short as plain text"},
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/image.png"}},
		{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "http://example.com/video.mp4"}},
	}}

	resolution, apiErr := ResolveBytePlusAssetReferences(c, 7, req)
	if apiErr != nil {
		t.Fatalf("ResolveBytePlusAssetReferences error: %v", apiErr)
	}
	if resolution.HasReferences() {
		t.Fatalf("unexpected references: %#v", resolution)
	}
	if _, ok := common.GetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap); ok {
		t.Fatal("rewrite map should not be stored when no asset URI media reference exists")
	}
}

func TestResolveBytePlusAssetReferencesStorageErrorIsStableAndSanitized(t *testing.T) {
	db := newBytePlusAssetReferenceDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sqlite handle: %v", err)
	}
	if err := sqlDB.Close(); err != nil {
		t.Fatalf("close sqlite: %v", err)
	}
	req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://ast_1234567890abcdefABCDEF1234567890"}},
	}}

	_, apiErr := ResolveBytePlusAssetReferences(newAssetReferenceContext(), 7, req)
	if apiErr == nil {
		t.Fatal("expected storage error")
	}
	if apiErr.GetErrorCode() != types.ErrorCodeAssetStorageError || apiErr.StatusCode != http.StatusInternalServerError {
		t.Fatalf("error code/status = %s/%d", apiErr.GetErrorCode(), apiErr.StatusCode)
	}
	text := apiErr.ToOpenAIError().Message + " " + apiErr.Error()
	for _, forbidden := range []string{"sql", "database", "closed", "SELECT", "byte_plus_assets"} {
		if strings.Contains(strings.ToLower(text), strings.ToLower(forbidden)) {
			t.Fatalf("public error leaked %q in %q", forbidden, text)
		}
	}
}

func newBytePlusAssetReferenceDB(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	model.DB = db
	t.Cleanup(func() {
		model.DB = oldDB
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
			return
		}
		if !errors.Is(err, gorm.ErrInvalidDB) {
			t.Fatalf("get sqlite handle during cleanup: %v", err)
		}
	})
	if err := db.AutoMigrate(&model.BytePlusRealPersonProfile{}, &model.BytePlusAsset{}); err != nil {
		t.Fatalf("migrate assets: %v", err)
	}
	return db
}

func insertBytePlusReferenceProfile(t *testing.T, userID, channelID int, publicID, status string) model.BytePlusRealPersonProfile {
	t.Helper()
	profile := model.BytePlusRealPersonProfile{
		PublicId:  publicID,
		UserId:    userID,
		ChannelId: channelID,
		Name:      publicID,
		Status:    status,
	}
	if err := model.DB.Create(&profile).Error; err != nil {
		t.Fatalf("insert real person profile: %v", err)
	}
	return profile
}

func insertBytePlusReferenceAsset(t *testing.T, userID, channelID int, publicID, upstreamID, status string) model.BytePlusAsset {
	t.Helper()
	asset := model.BytePlusAsset{
		PublicId:        publicID,
		UserId:          userID,
		ChannelId:       channelID,
		UpstreamAssetId: upstreamID,
		AssetType:       "Image",
		Status:          status,
	}
	if err := model.DB.Create(&asset).Error; err != nil {
		t.Fatalf("insert asset: %v", err)
	}
	return asset
}

func insertBytePlusReferenceRealPersonAsset(t *testing.T, userID, channelID int, publicID, upstreamID, status, assetType string, profileID int64) model.BytePlusAsset {
	t.Helper()
	asset := insertBytePlusReferenceAsset(t, userID, channelID, publicID, upstreamID, status)
	if err := model.DB.Model(&asset).Updates(map[string]any{
		"asset_type":             assetType,
		"real_person_profile_id": profileID,
	}).Error; err != nil {
		t.Fatalf("update real person asset: %v", err)
	}
	asset.AssetType = assetType
	asset.RealPersonProfileId = &profileID
	return asset
}

func newBytePlusReferenceRequest(pairs ...string) *dto.SeedanceVideoRequest {
	content := make([]dto.SeedanceContentItem, 0, len(pairs)/2)
	for i := 0; i+1 < len(pairs); i += 2 {
		contentType, publicID := pairs[i], pairs[i+1]
		item := dto.SeedanceContentItem{Type: contentType}
		switch contentType {
		case dto.SeedanceContentImage:
			item.ImageURL = &dto.SeedanceURLObject{URL: "asset://" + publicID}
		case dto.SeedanceContentVideo:
			item.VideoURL = &dto.SeedanceURLObject{URL: "asset://" + publicID}
		case dto.SeedanceContentAudio:
			item.AudioURL = &dto.SeedanceURLObject{URL: "asset://" + publicID}
		}
		content = append(content, item)
	}
	return &dto.SeedanceVideoRequest{Content: content}
}

func newAssetReferenceContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	return c
}
