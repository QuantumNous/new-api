package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	hwSetupTestPassword = "Hw-Setup-Passw0rd-2026"
	hwSetupTestBody     = `{"username":"hwsysroot","password":"` + hwSetupTestPassword + `","confirmPassword":"` + hwSetupTestPassword + `"}`
	hwSetupTestToken    = "hw-test-setup-token"
)

// hwSetupFixture gives a test an empty database in the not-yet-initialized
// state, shaped like a fresh deployment.
func hwSetupFixture(t *testing.T) {
	t.Helper()
	user, _ := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.Setup{}))
	// A fresh deployment has no accounts; the shared fixture creates one, and
	// its empty affiliate code would collide with the code PostSetup writes.
	require.NoError(t, model.DB.Unscoped().Delete(&model.User{}, user.Id).Error)
	// The handler stores the operation modes through UpdateOption, which writes
	// into the option map the server builds at startup.
	model.InitOptionMap(false)
	previousSetup := constant.Setup
	constant.Setup = false
	t.Cleanup(func() { constant.Setup = previousSetup })
}

// hwSetupPost calls the setup handler the way the router would, with the setup
// token in its header when one is given.
func hwSetupPost(token string) *httptest.ResponseRecorder {
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/setup", strings.NewReader(hwSetupTestBody))
	c.Request.Header.Set("Content-Type", "application/json")
	if token != "" {
		c.Request.Header.Set(HwSetupTokenHeader, token)
	}
	PostSetup(c)
	return response
}

// TestHwProductionSetupRefusesWithoutCorrectToken pins the closed door of the
// first-run setup: in production only the bearer of HW_SETUP_TOKEN may create
// the administrator, and a deployment that configured no token is refused as
// well, because an open setup endpoint hands the server to whoever arrives
// first. Outside production the plain setup page keeps working.
func TestHwProductionSetupRefusesWithoutCorrectToken(t *testing.T) {
	for _, test := range []struct {
		name       string
		appEnv     string
		configured string
		sent       string
		wantStatus int
		wantRoot   bool
	}{
		{
			name:       "production without a configured token refuses everything",
			appEnv:     common.HwAppEnvProduction,
			configured: "",
			sent:       hwSetupTestToken,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "production without a token header",
			appEnv:     common.HwAppEnvProduction,
			configured: hwSetupTestToken,
			sent:       "",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "production with a wrong token",
			appEnv:     common.HwAppEnvProduction,
			configured: hwSetupTestToken,
			sent:       hwSetupTestToken + "-wrong",
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "development needs no token",
			appEnv:     common.HwAppEnvDevelopment,
			configured: "",
			sent:       "",
			wantStatus: http.StatusOK,
			wantRoot:   true,
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			hwSetupFixture(t)
			t.Setenv("APP_ENV", test.appEnv)
			t.Setenv(HwSetupTokenEnv, test.configured)

			response := hwSetupPost(test.sent)

			assert.Equal(t, test.wantStatus, response.Code)
			if test.wantStatus == http.StatusForbidden {
				assert.Contains(t, response.Body.String(), `"success":false`)
				assert.False(t, model.RootUserExists(), "a refused setup creates no administrator")
				return
			}
			assert.Contains(t, response.Body.String(), `"success":true`)
			assert.Equal(t, test.wantRoot, model.RootUserExists())
		})
	}
}

// TestHwProductionSetupRunsOnceWithToken proves that the secret opens the setup
// exactly once: the first call with the right token creates the administrator
// and the second call is refused instead of creating another one. The mutex
// around the handler makes the same hold for two requests that arrive together.
func TestHwProductionSetupRunsOnceWithToken(t *testing.T) {
	hwSetupFixture(t)
	t.Setenv("APP_ENV", common.HwAppEnvProduction)
	t.Setenv(HwSetupTokenEnv, hwSetupTestToken)

	first := hwSetupPost(hwSetupTestToken)
	require.Equal(t, http.StatusOK, first.Code)
	require.Contains(t, first.Body.String(), `"success":true`)
	require.True(t, model.RootUserExists())

	second := hwSetupPost(hwSetupTestToken)
	assert.Contains(t, second.Body.String(), `"success":false`)
	assert.Contains(t, second.Body.String(), "already initialized")

	var roots int64
	require.NoError(t, model.DB.Model(&model.User{}).Where("role = ?", common.RoleRootUser).Count(&roots).Error)
	assert.Equal(t, int64(1), roots, "the second setup must not create a second administrator")
}

// TestHwSetupStaysOpenUntilTheSetupRowIsWritten fails the write of the setup row
// and proves the system does not report itself initialized: the failed call
// leaves the setup open, and once the write succeeds the next call finishes the
// setup instead of answering "already initialized" with no row behind it.
func TestHwSetupStaysOpenUntilTheSetupRowIsWritten(t *testing.T) {
	hwSetupFixture(t)
	t.Setenv("APP_ENV", common.HwAppEnvDevelopment)
	t.Setenv(HwSetupTokenEnv, "")

	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register("hw_setup_fail_row", func(tx *gorm.DB) {
		if tx.Statement.Table == "setups" {
			_ = tx.AddError(errors.New("disk full"))
		}
	}))
	failed := hwSetupPost("")
	assert.Contains(t, failed.Body.String(), `"success":false`)
	assert.False(t, constant.Setup, "a failed setup row leaves the setup open")
	assert.False(t, model.GetSetup() != nil, "no setup row was written")
	require.NoError(t, model.DB.Callback().Create().Remove("hw_setup_fail_row"))

	retried := hwSetupPost("")
	require.Contains(t, retried.Body.String(), `"success":true`, retried.Body.String())
	assert.True(t, constant.Setup)
	var setups int64
	require.NoError(t, model.DB.Model(&model.Setup{}).Count(&setups).Error)
	assert.Equal(t, int64(1), setups, "the retry writes the setup row")
}
