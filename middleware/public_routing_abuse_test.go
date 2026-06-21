package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

func setupPublicRoutingAbuseTest(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&model.Token{}); err != nil {
		t.Fatalf("migrate token: %v", err)
	}
	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func seedPublicRoutingToken(t *testing.T, db *gorm.DB, status int) model.Token {
	t.Helper()
	token := model.Token{
		UserId:         123,
		Key:            "public-routing-test-key",
		Status:         status,
		Name:           "public-routing",
		CreatedTime:    1,
		AccessedTime:   1,
		ExpiredTime:    -1,
		RemainQuota:    100,
		UnlimitedQuota: true,
	}
	if err := db.Create(&token).Error; err != nil {
		t.Fatalf("seed token: %v", err)
	}
	return token
}

func runPublicRoutingAbuseMiddleware(t *testing.T, token model.Token, ip string, ua string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/routing/chat/completions", nil)
	c.Request.RemoteAddr = ip + ":12345"
	c.Request.Header.Set("User-Agent", ua)
	common.SetContextKey(c, constant.ContextKeyTokenId, token.Id)
	common.SetContextKey(c, constant.ContextKeyTokenKey, token.Key)

	PublicRoutingAbuseControl()(c)
	return recorder
}

func TestPublicRoutingAbuseControlRevokedTokenFailsClosed(t *testing.T) {
	db := setupPublicRoutingAbuseTest(t)
	token := seedPublicRoutingToken(t, db, common.TokenStatusDisabled)

	recorder := runPublicRoutingAbuseMiddleware(t, token, "203.0.113.10", "runner-a")
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("revoked token must fail closed with 401, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestPublicRoutingAbuseControlRateLimitsCredential(t *testing.T) {
	db := setupPublicRoutingAbuseTest(t)
	token := seedPublicRoutingToken(t, db, common.TokenStatusEnabled)
	t.Setenv("PUBLIC_ROUTING_API_RPM_LIMIT", "1")

	first := runPublicRoutingAbuseMiddleware(t, token, "203.0.113.10", "runner-a")
	if first.Code != http.StatusOK {
		t.Fatalf("first request should pass through, got %d body=%s", first.Code, first.Body.String())
	}
	second := runPublicRoutingAbuseMiddleware(t, token, "203.0.113.10", "runner-a")
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("second request should be rate limited, got %d body=%s", second.Code, second.Body.String())
	}
	if second.Header().Get("Retry-After") == "" {
		t.Fatal("rate-limited response must include Retry-After")
	}
}

func TestPublicRoutingAbuseControlFlagsSharedCredential(t *testing.T) {
	db := setupPublicRoutingAbuseTest(t)
	token := seedPublicRoutingToken(t, db, common.TokenStatusEnabled)
	t.Setenv("PUBLIC_ROUTING_API_RPM_LIMIT", "0")
	t.Setenv("PUBLIC_ROUTING_API_SHARED_IP_LIMIT", "2")
	t.Setenv("PUBLIC_ROUTING_API_SHARED_CLIENT_LIMIT", "3")

	_ = runPublicRoutingAbuseMiddleware(t, token, "203.0.113.1", "runner-a")
	_ = runPublicRoutingAbuseMiddleware(t, token, "203.0.113.2", "runner-b")
	_ = runPublicRoutingAbuseMiddleware(t, token, "203.0.113.3", "runner-c")
	recorder := runPublicRoutingAbuseMiddleware(t, token, "203.0.113.3", "runner-d")

	if recorder.Code != http.StatusOK {
		t.Fatalf("anomaly should be flagged, not blocked, got %d", recorder.Code)
	}
	if got := recorder.Header().Get("X-DeepRouter-Abuse-Flags"); got != "shared_ip_fanout,shared_client_fanout" {
		t.Fatalf("unexpected abuse flags: %q", got)
	}
}

func TestPublicRoutingAbuseControlRedisFailureFailsClosed(t *testing.T) {
	db := setupPublicRoutingAbuseTest(t)
	token := seedPublicRoutingToken(t, db, common.TokenStatusEnabled)
	t.Setenv("PUBLIC_ROUTING_API_RPM_LIMIT", "1")

	common.RedisEnabled = true
	common.RDB = redis.NewClient(&redis.Options{
		Addr:        "127.0.0.1:1",
		DialTimeout: 20 * time.Millisecond,
		ReadTimeout: 20 * time.Millisecond,
		MaxRetries:  0,
	})
	t.Cleanup(func() {
		_ = common.RDB.Close()
		common.RedisEnabled = false
		common.RDB = nil
	})

	recorder := runPublicRoutingAbuseMiddleware(t, token, "203.0.113.20", "runner-redis-down")
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("Redis failure must fail closed with 500, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}
