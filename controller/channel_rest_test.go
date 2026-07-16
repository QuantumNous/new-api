package controller

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// openChannelControllerTestDB sets up an in-memory SQLite DB with the Channel
// table migrated. Sets the standard *Using* flags / RedisEnabled.
func openChannelControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.Channel{}); err != nil {
		t.Fatalf("migrate channel: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func TestGetChannel_NotFound_404(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/channel/9999", nil,
		gin.Params{{Key: "id", Value: "9999"}}, common.RoleAdminUser)
	GetChannel(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "channel_not_found" {
		t.Errorf("code: got %q want channel_not_found", c)
	}
}

func TestGetChannel_BadId_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/channel/abc", nil,
		gin.Params{{Key: "id", Value: "abc"}}, common.RoleAdminUser)
	GetChannel(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestDeleteChannel_BadId_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodDelete, "/api/channel/xx", nil,
		gin.Params{{Key: "id", Value: "xx"}}, common.RoleAdminUser)
	DeleteChannel(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestGetChannelKey_BadId_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/x/key", nil,
		gin.Params{{Key: "id", Value: "x"}}, common.RoleAdminUser)
	GetChannelKey(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestGetChannelKey_NotFound_404(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/9999/key", nil,
		gin.Params{{Key: "id", Value: "9999"}}, common.RoleAdminUser)
	GetChannelKey(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "channel_not_found" {
		t.Errorf("code: got %q want channel_not_found", c)
	}
}

func TestFetchUpstreamModels_BadId_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/channel/fetch_models/x", nil,
		gin.Params{{Key: "id", Value: "x"}}, common.RoleAdminUser)
	FetchUpstreamModels(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestFetchUpstreamModels_NotFound_404(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/channel/fetch_models/9999", nil,
		gin.Params{{Key: "id", Value: "9999"}}, common.RoleAdminUser)
	FetchUpstreamModels(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "channel_not_found" {
		t.Errorf("code: got %q want channel_not_found", c)
	}
}

func TestFetchModels_BadBody_400(t *testing.T) {
	openChannelControllerTestDB(t)
	// invalid body: missing required (bind error). Pass empty body — gin will
	// accept (no required tags), but downstream still proceeds. So test with
	// truly malformed: send a non-object to trigger bind error via raw bytes.
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/fetch_models",
		"not-an-object", nil, common.RoleAdminUser)
	FetchModels(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestAddChannel_BadJson_400(t *testing.T) {
	openChannelControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodPost, "/api/channel/", "not-an-object",
		nil, common.RoleAdminUser)
	AddChannel(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}
