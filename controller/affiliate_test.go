package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestGetAffiliateStatusDisabled(t *testing.T) {
	originalEnabled := common.AffiliateEnabled
	defer func() {
		common.AffiliateEnabled = originalEnabled
	}()
	common.AffiliateEnabled = false

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/status", nil)
	ctx.Set("id", 3)
	ctx.Set("role", common.RoleCommonUser)

	GetAffiliateStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var body affiliateStatusTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Success {
		t.Fatalf("expected success response: %+v", body)
	}
	if body.Data.Enabled {
		t.Fatalf("expected affiliate disabled response: %+v", body.Data)
	}
	if body.Data.Scope.Kind != service.AffiliateScopeNone {
		t.Fatalf("expected none scope, got %+v", body.Data.Scope)
	}
}

func TestGetAffiliateStatusAdminGlobal(t *testing.T) {
	originalEnabled := common.AffiliateEnabled
	defer func() {
		common.AffiliateEnabled = originalEnabled
	}()
	common.AffiliateEnabled = true

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/affiliate/status", nil)
	ctx.Set("id", 4)
	ctx.Set("role", common.RoleAdminUser)

	GetAffiliateStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var body affiliateStatusTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !body.Data.Enabled {
		t.Fatalf("expected affiliate enabled response: %+v", body.Data)
	}
	if body.Data.Scope.Kind != service.AffiliateScopeGlobal {
		t.Fatalf("expected global scope, got %+v", body.Data.Scope)
	}
}

func TestAdminSetAffiliateProfile(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/profiles", bytes.NewBufferString(`{
		"user_id":501,
		"level":1,
		"invite_code":"aff501",
		"reason":"admin create"
	}`))
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminSetAffiliateProfile(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var profile model.AffiliateProfile
	if err := db.Where("user_id = ?", 501).First(&profile).Error; err != nil {
		t.Fatalf("query profile: %v", err)
	}
	if profile.Level != 1 || profile.Status != model.AffiliateProfileStatusActive || profile.InviteCode != "aff501" {
		t.Fatalf("unexpected profile: %+v", profile)
	}
}

func TestAdminUpdateAffiliateProfileStatusDisabled(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:      601,
		Level:       1,
		InviteCode:  "aff601",
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/affiliate/admin/profiles/601/status", bytes.NewBufferString(`{
		"status":"disabled",
		"reason":"risk"
	}`))
	ctx.Params = gin.Params{{Key: "user_id", Value: "601"}}
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminUpdateAffiliateProfileStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var profile model.AffiliateProfile
	if err := db.Where("user_id = ?", 601).First(&profile).Error; err != nil {
		t.Fatalf("query profile: %v", err)
	}
	if profile.Status != model.AffiliateProfileStatusDisabled || profile.DisabledAt == 0 {
		t.Fatalf("expected disabled profile, got %+v", profile)
	}
}

func TestAdminUpdateAffiliateProfileStatusActive(t *testing.T) {
	db := newAffiliateControllerTestDB(t)
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:      602,
		Level:       1,
		InviteCode:  "aff602",
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}
	if err := service.DisableAffiliateProfile(db, service.AffiliateProfileStatusInput{
		UserId:      602,
		ActorUserId: 1,
		Reason:      "disable seed",
	}); err != nil {
		t.Fatalf("disable profile: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPatch, "/api/affiliate/admin/profiles/602/status", bytes.NewBufferString(`{
		"status":"active",
		"reason":"restore"
	}`))
	ctx.Params = gin.Params{{Key: "user_id", Value: "602"}}
	ctx.Set("id", 1)
	ctx.Set("role", common.RoleAdminUser)

	AdminUpdateAffiliateProfileStatus(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var profile model.AffiliateProfile
	if err := db.Where("user_id = ?", 602).First(&profile).Error; err != nil {
		t.Fatalf("query profile: %v", err)
	}
	if profile.Status != model.AffiliateProfileStatusActive || profile.DisabledAt != 0 {
		t.Fatalf("expected active profile, got %+v", profile)
	}
}

func TestAffiliateAdminRoutesRequireLogin(t *testing.T) {
	router := newAffiliateAdminRouteTestRouter(t, common.RoleAdminUser)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/profiles", bytes.NewBufferString(`{
		"user_id":701,
		"level":1
	}`))
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAffiliateAdminRoutesRejectCommonUser(t *testing.T) {
	router := newAffiliateAdminRouteTestRouter(t, common.RoleCommonUser)

	loginRecorder := httptest.NewRecorder()
	loginRequest := httptest.NewRequest(http.MethodGet, "/login", nil)
	router.ServeHTTP(loginRecorder, loginRequest)
	if loginRecorder.Code != http.StatusNoContent {
		t.Fatalf("expected login status 204, got %d body=%s", loginRecorder.Code, loginRecorder.Body.String())
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/affiliate/admin/profiles", bytes.NewBufferString(`{
		"user_id":702,
		"level":1
	}`))
	request.Header.Set("New-Api-User", "10")
	for _, loginCookie := range loginRecorder.Result().Cookies() {
		request.AddCookie(loginCookie)
	}
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body affiliateStatusTestResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body.Success {
		t.Fatalf("expected insufficient privilege response, got body=%s", recorder.Body.String())
	}
}

type affiliateStatusTestResponse struct {
	Success bool `json:"success"`
	Data    struct {
		Enabled bool                   `json:"enabled"`
		Scope   service.AffiliateScope `json:"scope"`
	} `json:"data"`
}

func newAffiliateControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(model.AffiliateSidecarModels()...); err != nil {
		t.Fatalf("migrate affiliate sidecar models: %v", err)
	}
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})
	return db
}

func newAffiliateAdminRouteTestRouter(t *testing.T, role int) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("affiliate-admin-test"))))
	router.GET("/login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("username", "tester")
		session.Set("role", role)
		session.Set("id", 10)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		if err := session.Save(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false})
			return
		}
		c.Status(http.StatusNoContent)
	})
	adminRoute := router.Group("/api/affiliate/admin")
	adminRoute.Use(middleware.AdminAuth())
	{
		adminRoute.POST("/profiles", AdminSetAffiliateProfile)
	}
	return router
}
