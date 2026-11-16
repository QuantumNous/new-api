package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCustomOAuthAutoLinkWithRegistrationDisabled(t *testing.T) {
	for _, test := range []struct {
		name     string
		policy   string
		verified bool
		wantLink bool
	}{
		{"disabled policy", "none", true, false},
		{"default policy", "", true, false},
		{"verified email", "email_verified", true, true},
		{"unverified email", "email_verified", false, false},
		{"matching username", "username", false, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
			require.NoError(t, err)
			connection, err := db.DB()
			require.NoError(t, err)
			connection.SetMaxOpenConns(1)
			t.Cleanup(func() { assert.NoError(t, connection.Close()) })
			require.NoError(t, db.AutoMigrate(&model.User{}, &model.UserOAuthBinding{}))
			originalDB, originalRegistration := model.DB, common.RegisterEnabled
			model.DB = db
			common.RegisterEnabled = false
			t.Cleanup(func() { model.DB, common.RegisterEnabled = originalDB, originalRegistration })
			user := &model.User{
				Username: "existing-user", Email: "existing@example.com", Status: common.UserStatusEnabled,
			}
			require.NoError(t, db.Create(user).Error)
			provider := oauth.NewGenericOAuthProvider(&model.CustomOAuthProvider{
				Id: 9, Slug: "trusted-provider", AutoLinkPolicy: test.policy,
			})
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("GET", "/api/oauth/trusted-provider", nil)

			linkedUser, migration, err := findOrCreateOAuthUser(c, provider, &oauth.OAuthUser{
				ProviderUserID: "external-user", Username: user.Username, Email: user.Email,
				Extra: map[string]any{"email_verified": test.verified},
			}, nil, "")
			assert.Nil(t, migration)
			if test.wantLink {
				require.NoError(t, err)
				require.NotNil(t, linkedUser)
				assert.Equal(t, user.Id, linkedUser.Id)
				binding, err := model.GetUserOAuthBinding(user.Id, 9)
				require.NoError(t, err)
				assert.Equal(t, "external-user", binding.ProviderUserId)
				return
			}
			var registrationDisabled *OAuthRegistrationDisabledError
			require.ErrorAs(t, err, &registrationDisabled)
			assert.Nil(t, linkedUser)
			assert.False(t, model.IsProviderUserIdTaken(9, "external-user"))
		})
	}
}
