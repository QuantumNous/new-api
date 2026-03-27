package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	gsessions "github.com/gorilla/sessions"
)

type failingSessionStore struct {
	store *gsessions.CookieStore
}

func newFailingSessionStore() *failingSessionStore {
	return &failingSessionStore{
		store: gsessions.NewCookieStore([]byte("custom-oauth-external-test-secret")),
	}
}

func (s *failingSessionStore) Get(r *http.Request, name string) (*gsessions.Session, error) {
	return gsessions.GetRegistry(r).Get(s, name)
}

func (s *failingSessionStore) New(r *http.Request, name string) (*gsessions.Session, error) {
	return s.store.New(r, name)
}

func (s *failingSessionStore) Save(r *http.Request, w http.ResponseWriter, session *gsessions.Session) error {
	return errors.New("forced session save failure")
}

func (s *failingSessionStore) Options(options sessions.Options) {
	s.store.Options = options.ToGorillaOptions()
}

func TestFinalizeCustomOAuthIdentityLoginReturnsSessionSaveError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.Use(sessions.Sessions("session", newFailingSessionStore()))

	audit := &customOAuthJWTAuditInfo{}
	router.GET("/test/finalize-login", func(c *gin.Context) {
		finalizeCustomOAuthIdentityLogin(c, nil, &customOAuthJWTLoginResult{
			Action: "login",
			User: &model.User{
				Id:          1,
				Username:    "alice",
				DisplayName: "Alice",
				Role:        common.RoleCommonUser,
				Status:      common.UserStatusEnabled,
				Group:       "default",
			},
		}, audit)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/test/finalize-login", nil)
	router.ServeHTTP(recorder, request)

	var response oauthJWTAPIResponse
	if err := common.DecodeJson(recorder.Body, &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Success {
		t.Fatalf("expected session save failure response, got success")
	}
	if response.Message == "" {
		t.Fatal("expected session save failure message to be returned")
	}
	if audit.FailureReason != "session_save_failed" {
		t.Fatalf("expected audit failure reason session_save_failed, got %q", audit.FailureReason)
	}
}
