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

func TestResolveBytePlusAssetReferencesIgnoresNonStrictAssetURLs(t *testing.T) {
	newBytePlusAssetReferenceDB(t)
	c := newAssetReferenceContext()
	req := &dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "asset://ast_short"}},
		{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://example.com/video.mp4"}},
	}}

	resolution, apiErr := ResolveBytePlusAssetReferences(c, 7, req)
	if apiErr != nil {
		t.Fatalf("ResolveBytePlusAssetReferences error: %v", apiErr)
	}
	if resolution.HasReferences() {
		t.Fatalf("unexpected references: %#v", resolution)
	}
	if _, ok := common.GetContextKey(c, constant.ContextKeyBytePlusAssetRewriteMap); ok {
		t.Fatal("rewrite map should not be stored when no strict asset URI exists")
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
	if err := db.AutoMigrate(&model.BytePlusAsset{}); err != nil {
		t.Fatalf("migrate assets: %v", err)
	}
	return db
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

func newAssetReferenceContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	return c
}
