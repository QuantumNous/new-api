package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestAffiliateAuthAllowsActiveAffiliate(t *testing.T) {
	db := newAffiliateMiddlewareTestDB(t)
	common.AffiliateEnabled = true
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:      901,
		Level:       1,
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	recorder := performAffiliateAuthRequest(t, common.RoleCommonUser, 901)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["success"] != true {
		t.Fatalf("expected success response, got %s", recorder.Body.String())
	}
}

func TestAffiliateAuthRejectsCommonUserWithoutProfile(t *testing.T) {
	_ = newAffiliateMiddlewareTestDB(t)
	common.AffiliateEnabled = true

	recorder := performAffiliateAuthRequest(t, common.RoleCommonUser, 902)

	assertAffiliateAuthRejected(t, recorder)
}

func TestAffiliateAuthRejectsWhenModuleDisabled(t *testing.T) {
	db := newAffiliateMiddlewareTestDB(t)
	common.AffiliateEnabled = false
	if _, err := service.CreateAffiliateProfile(db, service.AffiliateProfileCreateInput{
		UserId:      903,
		Level:       1,
		ActorUserId: 1,
		Reason:      "seed",
	}); err != nil {
		t.Fatalf("seed profile: %v", err)
	}

	recorder := performAffiliateAuthRequest(t, common.RoleCommonUser, 903)

	assertAffiliateAuthRejected(t, recorder)
}

func TestAffiliateAuthAllowsAdmin(t *testing.T) {
	_ = newAffiliateMiddlewareTestDB(t)
	common.AffiliateEnabled = false

	recorder := performAffiliateAuthRequest(t, common.RoleAdminUser, 904)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["success"] != true {
		t.Fatalf("expected success response, got %s", recorder.Body.String())
	}
}

func performAffiliateAuthRequest(t *testing.T, role int, userId int) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("id", userId)
		c.Set("role", role)
		c.Next()
	})
	router.GET("/api/affiliate/me", AffiliateAuth(), func(c *gin.Context) {
		common.ApiSuccess(c, gin.H{"scope": c.MustGet("affiliate_scope")})
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/affiliate/me", nil)
	router.ServeHTTP(recorder, request)
	return recorder
}

func assertAffiliateAuthRejected(t *testing.T, recorder *httptest.ResponseRecorder) {
	t.Helper()
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	var body map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["success"] != false {
		t.Fatalf("expected rejected response, got %s", recorder.Body.String())
	}
}

func newAffiliateMiddlewareTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalEnabled := common.AffiliateEnabled
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
		common.AffiliateEnabled = originalEnabled
		model.DB = originalDB
	})
	return db
}
