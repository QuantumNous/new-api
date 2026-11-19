package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupAdminUserTest promotes the enrolled operator to root and creates a
// managed common user for the administrative endpoints to act on.
func setupAdminUserTest(t *testing.T) (*model.User, service.AuthIdentity, *model.User) {
	t.Helper()
	operator, identity := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.Model(operator).Update("role", common.RoleRootUser).Error)
	require.NoError(t, model.PublishUserAuthCache(operator.Id))
	password, err := common.Password2Hash("managed-password")
	require.NoError(t, err)
	target := &model.User{Username: "managed-user", Password: password, Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "managed-aff", GitHubId: "managed-github"}
	require.NoError(t, model.DB.Create(target).Error)
	return operator, identity, target
}

// adminUserRequest drives an admin user-management handler with the operator
// context that AdminAuth would have populated for a dashboard session.
func adminUserRequest(method, path, body, proof string, identity service.AuthIdentity, role int, params gin.Params, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = httptest.NewRequest(method, path, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	if proof != "" {
		c.Request.Header.Set("X-Security-Proof", proof)
	}
	c.Params = params
	c.Set("id", identity.UserID)
	c.Set("username", "enrollment-user")
	c.Set("role", role)
	c.Set("session_id", identity.SessionID)
	c.Set("auth_version", identity.UserAuthVersion)
	c.Set("session_version", identity.SessionVersion)
	handler(c)
	return response
}

func TestAdminUserRiskOperationsRequireProofBeforeMutation(t *testing.T) {
	for _, test := range []struct {
		name, method, path string
		body               func(target *model.User) string
		params             func(target *model.User) gin.Params
		handler            gin.HandlerFunc
		unchanged          func(t *testing.T, target *model.User)
	}{
		{
			name: "hard delete", method: http.MethodDelete, path: "/api/user/:id", handler: DeleteUser,
			params: func(target *model.User) gin.Params { return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}} },
			unchanged: func(t *testing.T, target *model.User) {
				_, err := model.GetUserById(target.Id, false)
				assert.NoError(t, err)
			},
		},
		{
			name: "manage disable", method: http.MethodPost, path: "/api/user/manage", handler: ManageUser,
			body: func(target *model.User) string { return fmt.Sprintf(`{"id":%d,"action":"disable"}`, target.Id) },
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, common.UserStatusEnabled, stored.Status)
			},
		},
		{
			name: "manage promote", method: http.MethodPost, path: "/api/user/manage", handler: ManageUser,
			body: func(target *model.User) string { return fmt.Sprintf(`{"id":%d,"action":"promote"}`, target.Id) },
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, common.RoleCommonUser, stored.Role)
			},
		},
		{
			name: "manage set channel supplier", method: http.MethodPost, path: "/api/user/manage", handler: ManageUser,
			body: func(target *model.User) string {
				return fmt.Sprintf(`{"id":%d,"action":"set_channel_supplier","payable_discount":0.85}`, target.Id)
			},
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, common.RoleCommonUser, stored.Role)
			},
		},
		{
			name: "manage delete", method: http.MethodPost, path: "/api/user/manage", handler: ManageUser,
			body: func(target *model.User) string { return fmt.Sprintf(`{"id":%d,"action":"delete"}`, target.Id) },
			unchanged: func(t *testing.T, target *model.User) {
				_, err := model.GetUserById(target.Id, false)
				assert.NoError(t, err)
			},
		},
		{
			name: "password reset", method: http.MethodPut, path: "/api/user/", handler: UpdateUser,
			body: func(target *model.User) string {
				return fmt.Sprintf(`{"id":%d,"username":"managed-user","display_name":"Managed","password":"replacement-pass"}`, target.Id)
			},
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, true)
				require.NoError(t, err)
				assert.True(t, common.ValidatePasswordAndHash("managed-password", stored.Password))
			},
		},
		{
			name: "admin permission matrix", method: http.MethodPut, path: "/api/user/", handler: UpdateUser,
			body: func(target *model.User) string {
				return fmt.Sprintf(`{"id":%d,"username":"managed-user","display_name":"Managed","admin_permissions":{}}`, target.Id)
			},
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, "", stored.DisplayName)
			},
		},
		{
			name: "create administrator", method: http.MethodPost, path: "/api/user/", handler: CreateUser,
			body: func(*model.User) string { return `{"username":"new-admin","password":"admin-password-1","role":10}` },
			unchanged: func(t *testing.T, _ *model.User) {
				var count int64
				require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", "new-admin").Count(&count).Error)
				assert.Zero(t, count)
			},
		},
		{
			name: "passkey reset", method: http.MethodDelete, path: "/api/user/:id/reset_passkey", handler: AdminResetPasskey,
			params: func(target *model.User) gin.Params { return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}} },
			unchanged: func(t *testing.T, target *model.User) {
				_, err := model.GetPasskeyByUserID(target.Id)
				assert.NoError(t, err)
			},
		},
		{
			name: "two-factor disable", method: http.MethodDelete, path: "/api/user/:id/2fa", handler: AdminDisable2FA,
			params: func(target *model.User) gin.Params { return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}} },
			unchanged: func(t *testing.T, target *model.User) {
				twoFA, err := model.GetTwoFAByUserId(target.Id)
				require.NoError(t, err)
				assert.True(t, twoFA.IsEnabled)
			},
		},
		{
			name: "built-in binding clear", method: http.MethodDelete, path: "/api/user/:id/bindings/:binding_type", handler: AdminClearUserBinding,
			params: func(target *model.User) gin.Params {
				return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "binding_type", Value: "github"}}
			},
			unchanged: func(t *testing.T, target *model.User) {
				stored, err := model.GetUserById(target.Id, false)
				require.NoError(t, err)
				assert.Equal(t, "managed-github", stored.GitHubId)
			},
		},
		{
			name: "custom oauth unbind", method: http.MethodDelete, path: "/api/user/:id/oauth/bindings/:provider_id", handler: UnbindCustomOAuthByAdmin,
			params: func(target *model.User) gin.Params {
				return gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "provider_id", Value: "7"}}
			},
			unchanged: func(t *testing.T, target *model.User) {
				bindings, err := model.GetUserOAuthBindingsByUserId(target.Id)
				require.NoError(t, err)
				assert.Len(t, bindings, 1)
			},
		},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, identity, target := setupAdminUserTest(t)
			require.NoError(t, model.DB.Create(&model.PasskeyCredential{UserID: target.Id, CredentialID: "managed-passkey", PublicKey: "public-key"}).Error)
			require.NoError(t, model.DB.Create(&model.TwoFA{UserId: target.Id, Secret: "JBSWY3DPEHPK3PXP", IsEnabled: true}).Error)
			require.NoError(t, model.DB.Create(&model.UserOAuthBinding{UserId: target.Id, ProviderId: 7, ProviderUserId: "provider-user"}).Error)
			var body string
			if test.body != nil {
				body = test.body(target)
			}
			var params gin.Params
			if test.params != nil {
				params = test.params(target)
			}
			response := adminUserRequest(test.method, test.path, body, "", identity, common.RoleRootUser, params, test.handler)
			var result securityEnrollmentResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, http.StatusForbidden, response.Code)
			assert.Equal(t, "SECURITY_PROOF_REQUIRED", result.Code)
			test.unchanged(t, target)
			var flows int64
			require.NoError(t, model.DB.Model(&model.AuthFlow{}).Count(&flows).Error)
			assert.Zero(t, flows)
		})
	}
}

// An administrator (not root) exercises the routine paths without touching the
// Casbin policy store, which the security fixture does not provision.
func TestAdminUserRoutineEditsDoNotRequireProof(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	response := adminUserRequest(http.MethodPut, "/api/user/", fmt.Sprintf(`{"id":%d,"username":"managed-user","display_name":"Renamed","group":"default"}`, target.Id), "", identity, common.RoleAdminUser, nil, UpdateUser)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	stored, err := model.GetUserById(target.Id, true)
	require.NoError(t, err)
	assert.Equal(t, "Renamed", stored.DisplayName)
	assert.True(t, common.ValidatePasswordAndHash("managed-password", stored.Password))

	response = adminUserRequest(http.MethodPost, "/api/user/", `{"username":"new-member","password":"member-password-1","role":1}`, "", identity, common.RoleAdminUser, nil, CreateUser)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	var count int64
	require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", "new-member").Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestCreateUserRejectsNonStandardRole(t *testing.T) {
	_, identity, _ := setupAdminUserTest(t)
	for i, test := range []struct {
		name         string
		role         int
		operatorRole int
	}{
		{"between common and admin", 7, common.RoleAdminUser},
		{"negative", -1, common.RoleAdminUser},
		{"between admin and root", 99, common.RoleRootUser},
	} {
		t.Run(test.name, func(t *testing.T) {
			username := fmt.Sprintf("odd-role-%d", i)
			body := fmt.Sprintf(`{"username":%q,"password":"member-password-1","role":%d}`, username, test.role)
			response := adminUserRequest(http.MethodPost, "/api/user/", body, "", identity, test.operatorRole, nil, CreateUser)
			var result securityEnrollmentResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, http.StatusOK, response.Code)
			assert.False(t, result.Success)
			assert.Empty(t, result.Code)
			var count int64
			require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", username).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestAdminUserProofIsBoundToTargetAndActionAndConsumedOnce(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	other := &model.User{Username: "other-user", Password: target.Password, Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "other-aff"}
	require.NoError(t, model.DB.Create(other).Error)
	disableTarget := service.VerificationOperation{Scope: service.VerificationScopeAdminUserManage, Context: []byte(fmt.Sprintf(`{"user_id":%d,"action":"disable"}`, target.Id))}
	proof := issueSecurityEnrollmentProof(t, identity, disableTarget, service.VerificationMethodPassword)

	for _, test := range []struct {
		name, body, code string
		params           gin.Params
		handler          gin.HandlerFunc
	}{
		{"different action", fmt.Sprintf(`{"id":%d,"action":"enable"}`, target.Id), "SECURITY_PROOF_CONTEXT_MISMATCH", nil, ManageUser},
		{"different user", fmt.Sprintf(`{"id":%d,"action":"disable"}`, other.Id), "SECURITY_PROOF_CONTEXT_MISMATCH", nil, ManageUser},
		{"different scope", "", "SECURITY_PROOF_SCOPE_MISMATCH", gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}}, DeleteUser},
	} {
		t.Run(test.name, func(t *testing.T) {
			response := adminUserRequest(http.MethodPost, "/api/user/manage", test.body, proof, identity, common.RoleRootUser, test.params, test.handler)
			var result securityEnrollmentResponse
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, http.StatusForbidden, response.Code)
			assert.Equal(t, test.code, result.Code)
		})
	}
	for _, id := range []int{target.Id, other.Id} {
		stored, err := model.GetUserById(id, false)
		require.NoError(t, err)
		assert.Equal(t, common.UserStatusEnabled, stored.Status)
	}

	response := adminUserRequest(http.MethodPost, "/api/user/manage", fmt.Sprintf(`{"id":%d,"action":"disable"}`, target.Id), proof, identity, common.RoleRootUser, nil, ManageUser)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	stored, err := model.GetUserById(target.Id, false)
	require.NoError(t, err)
	assert.Equal(t, common.UserStatusDisabled, stored.Status)
	var audit model.AuditLog
	require.NoError(t, model.LOG_DB.Where("action = ?", "user.manage").Last(&audit).Error)
	require.NotNil(t, audit.Other.Op)
	verificationMethod, err := common.Marshal(audit.Other.Op.Params["verification_method"])
	require.NoError(t, err)
	assert.JSONEq(t, `"password"`, string(verificationMethod))
	targetUserID, err := common.Marshal(audit.Other.Op.Params["target_user_id"])
	require.NoError(t, err)
	assert.JSONEq(t, fmt.Sprint(target.Id), string(targetUserID))
	auditJSON, err := common.Marshal(audit)
	require.NoError(t, err)
	assert.NotContains(t, string(auditJSON), proof)

	response = adminUserRequest(http.MethodPost, "/api/user/manage", fmt.Sprintf(`{"id":%d,"action":"disable"}`, target.Id), proof, identity, common.RoleRootUser, nil, ManageUser)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	assert.Equal(t, http.StatusForbidden, response.Code)
	assert.Equal(t, "SECURITY_PROOF_CONSUMED", result.Code)
}

// TestChannelSupplierRoleManagement pins who may change whether a user is a
// channel supplier: only the super administrator, with a step-up proof, and the
// change ends every session of the target. A regular administrator cannot
// change it in any way, not even holding a valid proof.
func TestChannelSupplierRoleManagement(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	// Role changes clear the user's own permission rules, reload the policy and
	// add an authz sync task for the other nodes.
	require.NoError(t, model.DB.AutoMigrate(&model.CasbinRule{}, &model.SystemTask{}))
	previousMaster := common.IsMasterNode
	common.IsMasterNode = false
	t.Cleanup(func() { common.IsMasterNode = previousMaster })
	require.NoError(t, authz.Init(model.DB))
	resetTarget := func(t *testing.T, role int) {
		t.Helper()
		require.NoError(t, model.DB.Model(target).Updates(map[string]any{"role": role, "auth_version": 1}).Error)
	}
	manage := func(t *testing.T, action, proof string, operatorRole int) securityEnrollmentResponse {
		t.Helper()
		body := fmt.Sprintf(`{"id":%d,"action":%q}`, target.Id, action)
		// Becoming a supplier carries the payable discount; see
		// TestChannelSupplierPayableDiscount.
		if action == "set_channel_supplier" {
			body = fmt.Sprintf(`{"id":%d,"action":%q,"payable_discount":0.85}`, target.Id, action)
		}
		return decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPost, "/api/user/manage", body, proof, identity, operatorRole, nil, ManageUser))
	}
	manageProof := func(t *testing.T, action string) string {
		t.Helper()
		context := fmt.Sprintf(`{"user_id":%d,"action":%q}`, target.Id, action)
		return issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{Scope: service.VerificationScopeAdminUserManage, Context: []byte(context)}, service.VerificationMethodPassword)
	}

	for _, test := range []struct {
		name                     string
		operatorRole, targetRole int
		action, message          string
	}{
		{"administrator sets a supplier", common.RoleAdminUser, common.RoleCommonUser, "set_channel_supplier", "Only the super administrator can change channel suppliers"},
		{"administrator unsets a supplier", common.RoleAdminUser, common.RoleChannelSupplierUser, "unset_channel_supplier", "Only the super administrator can change channel suppliers"},
		{"administrator demotes a supplier", common.RoleAdminUser, common.RoleChannelSupplierUser, "demote", "This user is not an administrator"},
		{"super administrator demotes a supplier", common.RoleRootUser, common.RoleChannelSupplierUser, "demote", "This user is not an administrator"},
		{"super administrator sets an administrator", common.RoleRootUser, common.RoleAdminUser, "set_channel_supplier", "Only common users can become channel suppliers"},
		{"super administrator unsets a common user", common.RoleRootUser, common.RoleCommonUser, "unset_channel_supplier", "This user is not a channel supplier"},
		{"super administrator unsets an administrator", common.RoleRootUser, common.RoleAdminUser, "unset_channel_supplier", "This user is not a channel supplier"},
	} {
		t.Run(test.name, func(t *testing.T) {
			resetTarget(t, test.targetRole)
			// The checks run before the proof is consumed: even a valid proof
			// for this target and action changes nothing.
			result := manage(t, test.action, manageProof(t, test.action), test.operatorRole)
			assert.False(t, result.Success)
			assert.Equal(t, test.message, result.MessageKey)
			stored, err := model.GetUserById(target.Id, false)
			require.NoError(t, err)
			assert.Equal(t, test.targetRole, stored.Role)
			assert.EqualValues(t, 1, stored.AuthVersion)
		})
	}

	t.Run("super administrator sets and unsets a supplier", func(t *testing.T) {
		resetTarget(t, common.RoleCommonUser)
		// The target is in the Redis user cache, which a change must publish.
		server := miniredis.RunT(t)
		previousRDB, previousRedis := common.RDB, common.RedisEnabled
		common.RDB = redis.NewClient(&redis.Options{Addr: server.Addr(), MaxRetries: -1})
		common.RedisEnabled = true
		t.Cleanup(func() {
			_ = common.RDB.Close()
			common.RDB, common.RedisEnabled = previousRDB, previousRedis
		})
		_, err := model.GetUserCache(target.Id)
		require.NoError(t, err)
		var cacheKey string
		for _, key := range server.Keys() {
			if server.HGet(key, "Id") == strconv.Itoa(target.Id) {
				cacheKey = key
				break
			}
		}
		require.NotEmpty(t, cacheKey)
		newTargetSession := func(t *testing.T) service.AuthIdentity {
			t.Helper()
			bundle, err := service.CreateLoginSession(target.Id, "password", "127.0.0.1", "managed-session")
			require.NoError(t, err)
			session, err := service.ParseAccessToken(bundle.AccessToken)
			require.NoError(t, err)
			return session
		}
		// A change takes effect at once: the auth version advances, the user
		// cache holds the new role and version before anything reads the user
		// again, the target's sessions are revoked, the other nodes are told to
		// reload the policy, and the audit names the action and the
		// verification method.
		assertRoleChanged := func(t *testing.T, session service.AuthIdentity, action string, role int, authVersion int64, reason string, authzSyncTasks int64) {
			t.Helper()
			assert.Equal(t, strconv.Itoa(role), server.HGet(cacheKey, "Role"))
			assert.Equal(t, strconv.FormatInt(authVersion, 10), server.HGet(cacheKey, "AuthVersion"))
			stored, err := model.GetUserById(target.Id, false)
			require.NoError(t, err)
			assert.Equal(t, role, stored.Role)
			assert.EqualValues(t, authVersion, stored.AuthVersion)
			_, _, err = service.ValidateLoginSession(session)
			assert.ErrorIs(t, err, service.ErrLoginSessionRevoked)
			var revoked model.UserSession
			require.NoError(t, model.DB.First(&revoked, "sid = ?", session.SessionID).Error)
			assert.Equal(t, reason, revoked.RevokedReason)
			var tasks int64
			require.NoError(t, model.DB.Model(&model.SystemTask{}).Where("type = ?", model.SyncTaskType(model.SyncTopicAuthz)).Count(&tasks).Error)
			assert.Equal(t, authzSyncTasks, tasks)
			var audit model.AuditLog
			require.NoError(t, model.LOG_DB.Where("action = ?", "user.manage").Last(&audit).Error)
			require.NotNil(t, audit.Other.Op)
			params, err := common.Marshal(audit.Other.Op.Params)
			require.NoError(t, err)
			discount := ""
			if action == "set_channel_supplier" {
				discount = `"payable_discount":0.85,`
			}
			assert.JSONEq(t, fmt.Sprintf(`{"action":%q,"id":%d,"username":"managed-user",%s"target_user_id":%d,"verification_method":"password"}`, action, target.Id, discount, target.Id), string(params))
		}

		session := newTargetSession(t)
		// A permission rule left on the account must not outlive the change:
		// a supplier's permissions come from its role alone.
		require.NoError(t, model.DB.Create(&model.CasbinRule{Ptype: "p", V0: authz.UserSubject(target.Id), V1: authz.ChannelSecretView.Resource, V2: authz.ChannelSecretView.Action, V3: authz.EffectAllow}).Error)
		require.NoError(t, authz.ReloadPolicy())
		require.True(t, authz.Can(target.Id, common.RoleChannelSupplierUser, authz.ChannelSecretView))
		result := manage(t, "set_channel_supplier", manageProof(t, "set_channel_supplier"), common.RoleRootUser)
		require.True(t, result.Success, result.Message)
		assertRoleChanged(t, session, "set_channel_supplier", common.RoleChannelSupplierUser, 2, "admin_set_channel_supplier", 1)
		assert.False(t, authz.Can(target.Id, common.RoleChannelSupplierUser, authz.ChannelSecretView))

		result = manage(t, "unset_channel_supplier", "", common.RoleRootUser)
		assert.Equal(t, "SECURITY_PROOF_REQUIRED", result.Code)
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		assert.Equal(t, common.RoleChannelSupplierUser, stored.Role)

		session = newTargetSession(t)
		result = manage(t, "unset_channel_supplier", manageProof(t, "unset_channel_supplier"), common.RoleRootUser)
		require.True(t, result.Success, result.Message)
		assertRoleChanged(t, session, "unset_channel_supplier", common.RoleCommonUser, 3, "admin_unset_channel_supplier", 2)
	})

	// An administrator is refused before the proof is consumed: the same
	// verified identity can still use it as the super administrator.
	t.Run("a refused administrator leaves the proof unused", func(t *testing.T) {
		resetTarget(t, common.RoleCommonUser)
		proof := manageProof(t, "set_channel_supplier")
		result := manage(t, "set_channel_supplier", proof, common.RoleAdminUser)
		assert.False(t, result.Success)
		assert.Equal(t, "Only the super administrator can change channel suppliers", result.MessageKey)

		result = manage(t, "set_channel_supplier", proof, common.RoleRootUser)
		require.True(t, result.Success, result.Message)
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		assert.Equal(t, common.RoleChannelSupplierUser, stored.Role)
	})

	t.Run("super administrator promotes a supplier", func(t *testing.T) {
		resetTarget(t, common.RoleChannelSupplierUser)
		result := manage(t, "promote", manageProof(t, "promote"), common.RoleRootUser)
		require.True(t, result.Success, result.Message)
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		assert.Equal(t, common.RoleAdminUser, stored.Role)
	})

	t.Run("administrator cannot edit the role", func(t *testing.T) {
		resetTarget(t, common.RoleCommonUser)
		body := fmt.Sprintf(`{"id":%d,"username":"managed-user","role":%d}`, target.Id, common.RoleChannelSupplierUser)
		result := decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPut, "/api/user/", body, "", identity, common.RoleAdminUser, nil, UpdateUser))
		assert.False(t, result.Success)
		assert.Equal(t, "Invalid parameters", result.MessageKey)
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		assert.Equal(t, common.RoleCommonUser, stored.Role)
	})

	t.Run("only the super administrator creates a supplier", func(t *testing.T) {
		body := `{"username":"new-supplier","password":"supplier-password-1","role":5,"payable_discount":0.85}`
		create := service.VerificationOperation{Scope: service.VerificationScopeAdminUserCreate, Context: []byte(`{"role":5}`)}
		proof := issueSecurityEnrollmentProof(t, identity, create, service.VerificationMethodPassword)
		result := decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPost, "/api/user/", body, proof, identity, common.RoleAdminUser, nil, CreateUser))
		assert.False(t, result.Success)
		assert.Equal(t, "Only the super administrator can create channel suppliers", result.MessageKey)
		result = decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPost, "/api/user/", body, "", identity, common.RoleRootUser, nil, CreateUser))
		assert.Equal(t, "SECURITY_PROOF_REQUIRED", result.Code)
		var count int64
		require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", "new-supplier").Count(&count).Error)
		assert.Zero(t, count)

		proof = issueSecurityEnrollmentProof(t, identity, create, service.VerificationMethodPassword)
		result = decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPost, "/api/user/", body, proof, identity, common.RoleRootUser, nil, CreateUser))
		require.True(t, result.Success, result.Message)
		var created model.User
		require.NoError(t, model.DB.Where("username = ?", "new-supplier").First(&created).Error)
		assert.Equal(t, common.RoleChannelSupplierUser, created.Role)
		var audit model.AuditLog
		require.NoError(t, model.LOG_DB.Where("action = ?", "user.create").Last(&audit).Error)
		require.NotNil(t, audit.Other.Op)
		params, err := common.Marshal(audit.Other.Op.Params)
		require.NoError(t, err)
		assert.JSONEq(t, fmt.Sprintf(`{"role":5,"payable_discount":0.85,"username":"new-supplier","target_user_id":%d,"verification_method":"password"}`, created.Id), string(params))
	})
}

// TestChannelSupplierPayableDiscount pins the payable discount that comes with
// the channel supplier role. Creating a supplier or setting a user as one needs
// a discount greater than 0 and at most 1, with at most 4 decimal places,
// checked before the step-up proof is used. Only the super administrator
// changes it afterwards, and it stays when the user stops being a supplier.
func TestChannelSupplierPayableDiscount(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	// Role changes and the super administrator's edits clear the user's own
	// permission rules and reload the policy.
	require.NoError(t, model.DB.AutoMigrate(&model.CasbinRule{}, &model.SystemTask{}))
	previousMaster := common.IsMasterNode
	common.IsMasterNode = false
	t.Cleanup(func() { common.IsMasterNode = previousMaster })
	require.NoError(t, authz.Init(model.DB))

	const discountMessage = "Payable discount must be greater than 0 and at most 1, with at most 4 decimal places"
	invalidDiscounts := []struct{ name, field string }{
		{"missing", ""},
		{"null", `,"payable_discount":null`},
		{"zero", `,"payable_discount":0`},
		{"negative", `,"payable_discount":-0.5`},
		{"above one", `,"payable_discount":1.0001`},
		{"five decimal places", `,"payable_discount":0.12345`},
	}
	setTarget := func(t *testing.T, role int, discount *float64) {
		t.Helper()
		var value any
		if discount != nil {
			value = *discount
		}
		require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", target.Id).Updates(map[string]any{"role": role, "payable_discount": value}).Error)
	}
	storedUser := func(t *testing.T) *model.User {
		t.Helper()
		stored, err := model.GetUserById(target.Id, false)
		require.NoError(t, err)
		return stored
	}
	manage := func(t *testing.T, action, field, proof string) securityEnrollmentResponse {
		t.Helper()
		body := fmt.Sprintf(`{"id":%d,"action":%q%s}`, target.Id, action, field)
		return decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPost, "/api/user/manage", body, proof, identity, common.RoleRootUser, nil, ManageUser))
	}
	manageProof := func(t *testing.T, action string) string {
		t.Helper()
		context := fmt.Sprintf(`{"user_id":%d,"action":%q}`, target.Id, action)
		return issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{Scope: service.VerificationScopeAdminUserManage, Context: []byte(context)}, service.VerificationMethodPassword)
	}

	t.Run("creating a supplier needs a valid discount, checked before the proof is used", func(t *testing.T) {
		create := service.VerificationOperation{Scope: service.VerificationScopeAdminUserCreate, Context: []byte(`{"role":5}`)}
		proof := issueSecurityEnrollmentProof(t, identity, create, service.VerificationMethodPassword)
		for _, test := range invalidDiscounts {
			body := `{"username":"discount-supplier","password":"supplier-password-1","role":5` + test.field + `}`
			result := decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPost, "/api/user/", body, proof, identity, common.RoleRootUser, nil, CreateUser))
			assert.False(t, result.Success, test.name)
			assert.Equal(t, discountMessage, result.MessageKey, test.name)
		}
		var count int64
		require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", "discount-supplier").Count(&count).Error)
		assert.Zero(t, count)

		// The same proof still works, and the stored value drops the
		// floating-point noise of the decimal input.
		body := `{"username":"discount-supplier","password":"supplier-password-1","role":5,"payable_discount":0.30000000000000004}`
		result := decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPost, "/api/user/", body, proof, identity, common.RoleRootUser, nil, CreateUser))
		require.True(t, result.Success, result.Message)
		var created model.User
		require.NoError(t, model.DB.Where("username = ?", "discount-supplier").First(&created).Error)
		require.NotNil(t, created.PayableDiscount)
		assert.Equal(t, 0.3, *created.PayableDiscount)
	})

	t.Run("a user created with another role gets no discount", func(t *testing.T) {
		body := `{"username":"plain-member","password":"member-password-1","role":1,"payable_discount":0.5}`
		result := decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPost, "/api/user/", body, "", identity, common.RoleAdminUser, nil, CreateUser))
		require.True(t, result.Success, result.Message)
		var created model.User
		require.NoError(t, model.DB.Where("username = ?", "plain-member").First(&created).Error)
		assert.Nil(t, created.PayableDiscount)
	})

	t.Run("setting a supplier needs a valid discount, checked before the proof is used", func(t *testing.T) {
		setTarget(t, common.RoleCommonUser, nil)
		proof := manageProof(t, "set_channel_supplier")
		for _, test := range invalidDiscounts {
			result := manage(t, "set_channel_supplier", test.field, proof)
			assert.False(t, result.Success, test.name)
			assert.Equal(t, discountMessage, result.MessageKey, test.name)
			stored := storedUser(t)
			assert.Equal(t, common.RoleCommonUser, stored.Role, test.name)
			assert.Nil(t, stored.PayableDiscount, test.name)
		}
		result := manage(t, "set_channel_supplier", `,"payable_discount":0.85`, proof)
		require.True(t, result.Success, result.Message)
		stored := storedUser(t)
		assert.Equal(t, common.RoleChannelSupplierUser, stored.Role)
		require.NotNil(t, stored.PayableDiscount)
		assert.Equal(t, 0.85, *stored.PayableDiscount)
	})

	t.Run("the discount stays when the user stops being a supplier", func(t *testing.T) {
		discount := 0.85
		for _, test := range []struct {
			action string
			role   int
		}{
			{"unset_channel_supplier", common.RoleCommonUser},
			{"promote", common.RoleAdminUser},
		} {
			setTarget(t, common.RoleChannelSupplierUser, &discount)
			result := manage(t, test.action, "", manageProof(t, test.action))
			require.True(t, result.Success, result.Message)
			stored := storedUser(t)
			assert.Equal(t, test.role, stored.Role, test.action)
			require.NotNil(t, stored.PayableDiscount, test.action)
			assert.Equal(t, 0.85, *stored.PayableDiscount, test.action)
		}
	})

	t.Run("only the super administrator changes the discount of a supplier", func(t *testing.T) {
		discount := 0.85
		update := func(t *testing.T, field string, operatorRole int) securityEnrollmentResponse {
			t.Helper()
			body := fmt.Sprintf(`{"id":%d,"username":"managed-user","display_name":"Managed","group":"default"%s}`, target.Id, field)
			return decodeSecurityEnrollmentResponse(t, adminUserRequest(http.MethodPut, "/api/user/", body, "", identity, operatorRole, nil, UpdateUser))
		}
		for _, test := range []struct {
			name, field, message     string
			operatorRole, targetRole int
		}{
			{"administrator", `,"payable_discount":0.7`, "Only the super administrator can change channel suppliers", common.RoleAdminUser, common.RoleChannelSupplierUser},
			{"common user target", `,"payable_discount":0.7`, "This user is not a channel supplier", common.RoleRootUser, common.RoleCommonUser},
			{"invalid value", `,"payable_discount":1.5`, discountMessage, common.RoleRootUser, common.RoleChannelSupplierUser},
		} {
			setTarget(t, test.targetRole, &discount)
			result := update(t, test.field, test.operatorRole)
			assert.False(t, result.Success, test.name)
			assert.Equal(t, test.message, result.MessageKey, test.name)
			stored := storedUser(t)
			require.NotNil(t, stored.PayableDiscount, test.name)
			assert.Equal(t, 0.85, *stored.PayableDiscount, test.name)
		}

		// An edit that leaves the discount out keeps it: an administrator edits
		// a supplier the way it edits any common user.
		setTarget(t, common.RoleChannelSupplierUser, &discount)
		result := update(t, "", common.RoleAdminUser)
		require.True(t, result.Success, result.Message)
		stored := storedUser(t)
		require.NotNil(t, stored.PayableDiscount)
		assert.Equal(t, 0.85, *stored.PayableDiscount)

		// The super administrator changes it without a step-up proof, and the
		// audit records the new value only when it changes.
		latestUpdateAudit := func(t *testing.T) string {
			t.Helper()
			var audit model.AuditLog
			require.NoError(t, model.LOG_DB.Where("action = ?", "user.update").Last(&audit).Error)
			require.NotNil(t, audit.Other.Op)
			params, err := common.Marshal(audit.Other.Op.Params)
			require.NoError(t, err)
			return string(params)
		}
		result = update(t, `,"payable_discount":0.7`, common.RoleRootUser)
		require.True(t, result.Success, result.Message)
		stored = storedUser(t)
		require.NotNil(t, stored.PayableDiscount)
		assert.Equal(t, 0.7, *stored.PayableDiscount)
		assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"username":"managed-user","payable_discount":0.7,"target_user_id":%d}`, target.Id, target.Id), latestUpdateAudit(t))

		result = update(t, `,"payable_discount":0.7`, common.RoleRootUser)
		require.True(t, result.Success, result.Message)
		assert.JSONEq(t, fmt.Sprintf(`{"id":%d,"username":"managed-user","target_user_id":%d}`, target.Id, target.Id), latestUpdateAudit(t))
	})
}

func TestAdminUserBindingProofDistinguishesBuiltInAndCustomBindings(t *testing.T) {
	_, identity, target := setupAdminUserTest(t)
	require.NoError(t, model.DB.Create(&model.UserOAuthBinding{UserId: target.Id, ProviderId: 7, ProviderUserId: "provider-user"}).Error)
	custom := service.VerificationOperation{Scope: service.VerificationScopeAdminUserBindingClear, Context: []byte(fmt.Sprintf(`{"user_id":%d,"provider_id":7}`, target.Id))}
	proof := issueSecurityEnrollmentProof(t, identity, custom, service.VerificationMethodPassword)
	params := gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "binding_type", Value: "github"}}
	response := adminUserRequest(http.MethodDelete, "/api/user/:id/bindings/:binding_type", "", proof, identity, common.RoleRootUser, params, AdminClearUserBinding)
	var result securityEnrollmentResponse
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	assert.Equal(t, "SECURITY_PROOF_CONTEXT_MISMATCH", result.Code)
	stored, err := model.GetUserById(target.Id, false)
	require.NoError(t, err)
	assert.Equal(t, "managed-github", stored.GitHubId)

	params = gin.Params{{Key: "id", Value: fmt.Sprint(target.Id)}, {Key: "provider_id", Value: "7"}}
	response = adminUserRequest(http.MethodDelete, "/api/user/:id/oauth/bindings/:provider_id", "", proof, identity, common.RoleRootUser, params, UnbindCustomOAuthByAdmin)
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	require.True(t, result.Success, response.Body.String())
	bindings, err := model.GetUserOAuthBindingsByUserId(target.Id)
	require.NoError(t, err)
	assert.Empty(t, bindings)
	var audit model.AuditLog
	require.NoError(t, model.LOG_DB.Where("action = ?", "user.binding_clear").Last(&audit).Error)
	require.NotNil(t, audit.Other.Op)
	providerID, err := common.Marshal(audit.Other.Op.Params["provider_id"])
	require.NoError(t, err)
	assert.JSONEq(t, "7", string(providerID))
}

func TestAdminUserVerificationPolicy(t *testing.T) {
	t.Run("requires an administrator", func(t *testing.T) {
		_, identity := setupSecurityEnrollmentTest(t)
		_, err := service.GetVerificationRequirements(identity, service.VerificationScopeAdminUserDelete)
		assert.ErrorIs(t, err, service.ErrVerificationForbidden)
	})
	t.Run("falls back to the password without a second factor", func(t *testing.T) {
		_, identity, _ := setupAdminUserTest(t)
		requirements, err := service.GetVerificationRequirements(identity, service.VerificationScopeAdminUserDelete)
		require.NoError(t, err)
		assert.Equal(t, []service.VerificationMethodOption{{Method: service.VerificationMethodPassword, Available: true}}, requirements.Methods)
	})
	t.Run("prefers an enrolled second factor", func(t *testing.T) {
		operator, identity, _ := setupAdminUserTest(t)
		require.NoError(t, model.DB.Create(&model.TwoFA{UserId: operator.Id, Secret: "JBSWY3DPEHPK3PXP", IsEnabled: true}).Error)
		requirements, err := service.GetVerificationRequirements(identity, service.VerificationScopeAdminUserManage)
		require.NoError(t, err)
		assert.Equal(t, []service.VerificationMethodOption{{Method: service.VerificationMethodTwoFA, Available: true}}, requirements.Methods)
	})
	t.Run("a legacy token cannot present a proof", func(t *testing.T) {
		operator, identity, target := setupAdminUserTest(t)
		require.NoError(t, model.DB.Model(operator).Update("access_token", "legacy-admin-token").Error)
		proof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{Scope: service.VerificationScopeAdminUserDelete, Context: []byte(fmt.Sprintf(`{"user_id":%d}`, target.Id))}, service.VerificationMethodPassword)
		response := accessTokenRequest(newAccessTokenTestRouter(), http.MethodDelete, fmt.Sprintf("/api/user/%d", target.Id), "legacy-admin-token", proof, "")
		assert.Equal(t, http.StatusForbidden, response.Code)
		assert.Equal(t, "SECURITY_PROOF_INVALID", decodeSecurityEnrollmentResponse(t, response).Code)
		_, err := model.GetUserById(target.Id, false)
		assert.NoError(t, err)
	})
	t.Run("a user:write token completes the deletion on its own proof", func(t *testing.T) {
		operator, _, target := setupAdminUserTest(t)
		// A hard deletion also writes these tables: the user's identity claims
		// and tokens, and the creator of the user's channels.
		require.NoError(t, model.DB.AutoMigrate(&model.ExternalIdentityClaim{}, &model.Token{}, &model.Channel{}))
		raw, _ := createScopedAccessToken(t, operator.Id, 0, "user:write")
		router := newAccessTokenTestRouter()
		response := accessTokenRequest(router, http.MethodPost, "/api/verify", raw, "", fmt.Sprintf(`{"scope":"admin.user.delete","method":"password","password":"enrollment-password","context":{"user_id":%d}}`, target.Id))
		body := decodeSecurityEnrollmentResponse(t, response)
		require.True(t, body.Success, body.Message)
		var proof service.SecurityProof
		require.NoError(t, common.Unmarshal(body.Data, &proof))

		response = accessTokenRequest(router, http.MethodDelete, fmt.Sprintf("/api/user/%d", target.Id), raw, proof.ProofToken, "")
		body = decodeSecurityEnrollmentResponse(t, response)
		require.True(t, body.Success, body.Message)
		_, err := model.GetUserById(target.Id, true)
		assert.Error(t, err)
		var audit model.AuditLog
		require.NoError(t, model.LOG_DB.Where("action = ?", "user.delete").Last(&audit).Error)
		assert.Equal(t, "access_token", audit.AuthMethod)
		auditJSON, err := common.Marshal(audit)
		require.NoError(t, err)
		for _, secret := range []string{raw, proof.ProofToken, "enrollment-password"} {
			assert.NotContains(t, string(auditJSON), secret)
		}
	})
	t.Run("a user:read token cannot obtain a proof", func(t *testing.T) {
		operator, _, target := setupAdminUserTest(t)
		raw, _ := createScopedAccessToken(t, operator.Id, 0, "user:read")
		response := accessTokenRequest(newAccessTokenTestRouter(), http.MethodPost, "/api/verify", raw, "", fmt.Sprintf(`{"scope":"admin.user.delete","method":"password","password":"enrollment-password","context":{"user_id":%d}}`, target.Id))
		assert.Equal(t, http.StatusForbidden, response.Code)
		assert.Equal(t, "SECURITY_ACTION_FORBIDDEN", decodeSecurityEnrollmentResponse(t, response).Code)
		var flows int64
		require.NoError(t, model.DB.Model(&model.AuthFlow{}).Count(&flows).Error)
		assert.Zero(t, flows)
	})
}
