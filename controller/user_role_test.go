package controller

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	newapii18n "github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateUserRejectsNonStandardRole(t *testing.T) {
	if err := newapii18n.Init(); err != nil {
		t.Fatalf("failed to initialize i18n: %v", err)
	}
	db := setupUserSelfControllerTestDB(t)

	for i, test := range []struct {
		name         string
		role         int
		operatorRole int
	}{
		{"between common and admin", 5, common.RoleAdminUser},
		{"negative", -1, common.RoleAdminUser},
		{"between admin and root", 99, common.RoleRootUser},
	} {
		t.Run(test.name, func(t *testing.T) {
			username := fmt.Sprintf("odd-role-%d", i)
			ctx, recorder := newSelfJSONContext(
				t,
				http.MethodPost,
				"/api/user/",
				map[string]any{
					"username": username,
					"password": "member-password-1",
					"role":     test.role,
				},
				999,
				test.operatorRole,
			)
			CreateUser(ctx)

			var result struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
			assert.False(t, result.Success)
			var count int64
			require.NoError(t, db.Model(&model.User{}).Where("username = ?", username).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}
