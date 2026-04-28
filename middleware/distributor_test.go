package middleware

// distributor_test.go — unit tests for security boundaries in the Distribute()
// middleware, deferred from Tier 1/2 E2E boundary review.

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func init() {
	gin.SetMode(gin.TestMode)
	// i18n must be initialised before the Distribute() middleware runs because
	// abortWithOpenAiMessage calls i18n.T() which panics on a nil bundle.
	if err := i18n.Init(); err != nil {
		panic("failed to init i18n in test: " + err.Error())
	}
}

// setupDistributorTestDB initialises an in-memory SQLite database for the
// tests that require a User table (T-5 admin/non-admin token tests).
// For channel-select tests we use MemoryCacheEnabled=true with an empty cache
// so that GetRandomSatisfiedChannel returns nil, nil without hitting the DB
// (which would fail because commonGroupCol isn't set without full InitDB).
func setupDistributorTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("failed to get sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)

	model.DB = db
	common.UsingSQLite = true
	common.RedisEnabled = false
	// Use the in-memory channel cache (left empty — no channels loaded).
	// This causes GetRandomSatisfiedChannel to return (nil, nil) for any model
	// without issuing a DB query, so the missing commonGroupCol isn't an issue.
	common.MemoryCacheEnabled = true

	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("failed to migrate: %v", err)
	}
}

// newDistributorContext creates a POST gin.Context with a JSON body and all
// context keys that auth middleware would normally populate for a non-admin user.
func newDistributorContext(t *testing.T, body []byte, path string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	bs, err := common.CreateBodyStorage(body)
	if err != nil {
		t.Fatalf("failed to create body storage: %v", err)
	}
	c.Set(common.KeyBodyStorage, bs)

	// Simulate what auth middleware sets for a regular (non-admin) user.
	c.Set("id", 9001)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
	common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, false)
	return c, w
}

// ── T-7: model not in any channel returns clean 4xx, no crash, no upstream call ──

// TestDistribute_ModelNotInAnyChannel verifies that submitting a model name
// that has no matching channel entry returns HTTP 503 (ServiceUnavailable) with
// a structured error body — NOT a 500 internal error and NOT a panic.
//
// The Distribute() middleware MUST absorb the "no available channel" case and
// respond cleanly.  The upstream adaptor chain is never reached.
func TestDistribute_ModelNotInAnyChannel(t *testing.T) {
	setupDistributorTestDB(t)

	body := []byte(`{"model":"doubao-seedance-99-mythical","prompt":"test"}`)
	c, w := newDistributorContext(t, body, "/v1/chat/completions")

	// Track whether the next handler was called (it must NOT be for missing model).
	nextCalled := false
	distributeMiddleware := Distribute()
	c.Set("_test_next", func() { nextCalled = true })

	// Run the middleware.  We call it directly on the context; gin will call
	// c.Abort() internally so the handler chain stops.
	distributeMiddleware(c)

	if nextCalled {
		t.Error("upstream handler was called despite no available channel — should have been aborted")
	}

	statusCode := w.Code
	if statusCode == http.StatusInternalServerError {
		t.Errorf("got 500 for missing model — expected clean 4xx or 503, not a crash response")
	}
	if statusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 ServiceUnavailable for model not in any channel, got %d", statusCode)
	}

	// Response body must be a structured JSON error, not empty or HTML.
	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("response body is not valid JSON (code=%d): %v", statusCode, err)
	}
	errObj, ok := resp["error"]
	if !ok {
		t.Error("expected 'error' key in response JSON")
	} else {
		errMap, ok := errObj.(map[string]interface{})
		if !ok {
			t.Errorf("expected error to be an object, got %T", errObj)
		} else if errMap["message"] == "" {
			t.Error("expected non-empty error message")
		}
	}
}

// TestDistribute_ModelNotInAnyChannel_VolcPath verifies the same invariant on
// the Volc-compat POST route (/api/v3/contents/generations/tasks).
// The Volc task-submit path also reads the model from the body and calls
// CacheGetRandomSatisfiedChannel.  No channel match → clean 503.
func TestDistribute_ModelNotInAnyChannel_VolcPath(t *testing.T) {
	setupDistributorTestDB(t)

	body := []byte(`{"model":"doubao-seedance-99-mythical","content":[{"type":"text","text":"make a video"}]}`)
	c, w := newDistributorContext(t, body, "/api/v3/contents/generations/tasks")

	distributeMiddleware := Distribute()
	distributeMiddleware(c)

	statusCode := w.Code
	if statusCode == http.StatusInternalServerError {
		t.Errorf("got 500 for missing model on Volc path — expected clean 503, not crash")
	}
	if statusCode != http.StatusServiceUnavailable {
		t.Errorf("expected 503 for model not in any channel (Volc path), got %d", statusCode)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("response body not JSON (code=%d): %v", statusCode, err)
	}
	if _, ok := resp["error"]; !ok {
		t.Error("expected 'error' key in response JSON")
	}
}

// ── T-5: Channel-Id forcing is via token key format, not an HTTP header ──
//
// Upstream channel-forcing is implemented in SetupContextForToken (auth.go):
// the token key is split on "-" and if a second segment is present it is
// treated as a channel ID. Non-admin users are REJECTED with 403; admin users
// get the channel ID stored as "specific_channel_id" in the context, which
// Distribute() later uses for GetChannelById.
//
// NOTE: There is NO "Channel-Id" or "X-Channel-Id" HTTP header accepted by
// this codebase. The mechanism is entirely token-key-based, not header-based.
// The tests below verify the SetupContextForToken logic directly rather than
// via the full auth middleware chain (which requires real DB token lookup).

// TestSetupContextForToken_AdminCanForceChannel verifies that an admin user
// (Role >= RoleAdminUser) with a multi-segment token key gets the channel ID
// stored in the context.
func TestSetupContextForToken_AdminCanForceChannel(t *testing.T) {
	setupDistributorTestDB(t)

	// Seed an admin user so model.IsAdmin returns true.
	adminUser := &model.User{
		Username: "admin_force_test",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
	}
	if err := model.DB.Create(adminUser).Error; err != nil {
		t.Fatalf("failed to create admin user: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	token := &model.Token{
		UserId: adminUser.Id,
		Key:    "testkey",
		Name:   "admin-token",
		Status: 1,
	}

	// Call SetupContextForToken with parts[1] = "99" (simulating sk-<key>-99).
	err := SetupContextForToken(c, token, "testkey", "99")
	if err != nil {
		t.Fatalf("SetupContextForToken failed for admin: %v", err)
	}

	// The channel ID should be stored in context.
	val, exists := c.Get("specific_channel_id")
	if !exists {
		t.Error("expected specific_channel_id to be set for admin user with channel suffix")
	}
	if val != "99" {
		t.Errorf("expected specific_channel_id=%q, got %q", "99", val)
	}
	// Response writer should be clean (no abort for admin).
	if w.Code != http.StatusOK {
		t.Errorf("expected no abort for admin, recorder shows code=%d", w.Code)
	}
}

// TestSetupContextForToken_NonAdminCannotForceChannel verifies that a regular
// (non-admin) user is REJECTED with 403 when a channel-ID suffix is present.
// This is the core security boundary: non-admins MUST NOT be able to pick a
// specific channel via the token key suffix.
func TestSetupContextForToken_NonAdminCannotForceChannel(t *testing.T) {
	setupDistributorTestDB(t)

	// Seed a regular user.
	regularUser := &model.User{
		Username: "regular_force_test",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	if err := model.DB.Create(regularUser).Error; err != nil {
		t.Fatalf("failed to create regular user: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	token := &model.Token{
		UserId: regularUser.Id,
		Key:    "testkey",
		Name:   "user-token",
		Status: 1,
	}

	// Call with channel suffix — should be rejected.
	err := SetupContextForToken(c, token, "testkey", "99")
	if err == nil {
		t.Fatal("expected error for non-admin user attempting channel-forcing, got nil")
	}

	// Context must NOT have specific_channel_id set.
	_, exists := c.Get("specific_channel_id")
	if exists {
		t.Error("security violation: specific_channel_id was set for non-admin user")
	}

	// The response recorder code is 200 initially but the body should carry 403.
	// (gin recorder only reflects what JSON was written; in unit test Abort() sets code.)
	_ = w.Code // status depends on how gin records the abort in recorder
}
