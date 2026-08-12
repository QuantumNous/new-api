package controller

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

func setupTokenGroupVisibilityTestDB(t *testing.T) {
	t.Helper()
	t.Setenv("TOKEN_GROUP_VISIBILITY_MODE", "enforce")
	db := openTokenControllerTestDB(t)
	if err := db.AutoMigrate(
		&model.Token{}, &model.User{}, &model.TokenGroupVisibility{}, &model.TokenGroupVisibilityTarget{},
		&model.TokenGroupVisibilityRevision{},
		&model.EntitlementPackage{}, &model.UserEntitlement{}, &model.TokenEntitlement{}, &model.EntitlementDailyUsage{},
	); err != nil {
		t.Fatalf("failed to migrate token visibility tables: %v", err)
	}
}

func createVisibilityTestUser(t *testing.T, id int, username, group string) *model.User {
	t.Helper()
	user := &model.User{Id: id, Username: username, Password: "password", Group: group, AffCode: username + "-aff", Status: common.UserStatusEnabled}
	if err := model.DB.Create(user).Error; err != nil {
		t.Fatal(err)
	}
	return user
}

func TestTokenGroupVisibilityAdminFlagOffDoesNotRequireSchema(t *testing.T) {
	t.Helper()
	db := openTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.Token{}, &model.User{}); err != nil {
		t.Fatalf("failed to migrate baseline tables: %v", err)
	}
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")

	getCtx, getRecorder := newAuthenticatedContext(t, http.MethodGet, "/api/group/token-visibility", nil, 99)
	GetTokenGroupVisibilityPolicies(getCtx)
	getResponse := decodeAPIResponse(t, getRecorder)
	if !getResponse.Success {
		t.Fatalf("flag-off visibility GET must succeed without P2 tables: %s", getRecorder.Body.String())
	}
	var getData struct {
		Enabled  bool                               `json:"enabled"`
		Policies []model.TokenGroupVisibilityPolicy `json:"policies"`
	}
	if err := common.Unmarshal(getResponse.Data, &getData); err != nil {
		t.Fatalf("failed to decode flag-off visibility response: %v", err)
	}
	if getData.Enabled || len(getData.Policies) != 0 {
		t.Fatalf("unexpected flag-off visibility response: %#v", getData)
	}

	for name, invoke := range map[string]func(*gin.Context){
		"save":    func(ctx *gin.Context) { SaveTokenGroupVisibilityPolicy(ctx) },
		"replace": func(ctx *gin.Context) { ReplaceTokenGroupVisibilityPolicies(ctx) },
		"delete":  func(ctx *gin.Context) { DeleteTokenGroupVisibilityPolicy(ctx) },
	} {
		var body any
		if name == "save" {
			body = model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityPublic}
		} else if name == "replace" {
			body = map[string]any{"policies": []model.TokenGroupVisibilityPolicy{}}
		}
		ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/group/token-visibility", body, 99)
		invoke(ctx)
		response := decodeAPIResponse(t, recorder)
		if response.Success {
			t.Fatalf("flag-off %s must not mutate optional schema", name)
		}
	}
}

func TestTokenGroupVisibilityAdminReadReturnsDegradedStateOnDatabaseError(t *testing.T) {
	if err := openTokenControllerTestDB(t).AutoMigrate(&model.Token{}, &model.User{}); err != nil {
		t.Fatalf("failed to migrate baseline tables: %v", err)
	}
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	t.Setenv("TOKEN_GROUP_VISIBILITY_MODE", "enforce")
	ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/group/token-visibility", nil, 99)
	GetTokenGroupVisibilityPolicies(ctx)
	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatal("database policy read failure must not be reported as success")
	}
	var state model.TokenGroupVisibilityState
	if err := common.Unmarshal(response.Data, &state); err != nil {
		t.Fatalf("degraded response must retain canonical state data: %v body=%s", err, recorder.Body.String())
	}
	if state.Enabled != true || state.ReadSource != "database_error" || !state.Degraded || state.Policies == nil {
		t.Fatalf("unexpected degraded state: %#v", state)
	}
}

func TestTokenGroupVisibilityAdminBatchUsesDigestCAS(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	createVisibilityTestUser(t, 1, "cas-admin-target", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityPublic}); err != nil {
		t.Fatal(err)
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/group/token-visibility/batch", map[string]any{
		"policies":        []model.TokenGroupVisibilityPolicy{},
		"expected_digest": "stale",
		"allow_empty":     true,
	}, 99)
	ReplaceTokenGroupVisibilityPolicies(ctx)
	if recorder.Code != http.StatusConflict {
		t.Fatalf("stale digest must return HTTP 409, got %d body=%s", recorder.Code, recorder.Body.String())
	}
	if err := model.DB.Where(map[string]interface{}{"group": "default"}).First(&model.TokenGroupVisibility{}).Error; err != nil {
		t.Fatalf("stale CAS must keep existing policy: %v", err)
	}
}

func TestAddTokenEnforcesTargetedVisibility(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	createVisibilityTestUser(t, 1, "alice", "default")
	createVisibilityTestUser(t, 2, "bob", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{1},
	}); err != nil {
		t.Fatal(err)
	}

	ctx, rejected := newAuthenticatedContext(t, http.MethodPost, "/api/token/", map[string]any{
		"name": "not-allowed", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, 2)
	AddToken(ctx)
	if decodeAPIResponse(t, rejected).Success {
		t.Fatal("expected targeted policy to reject forged token group")
	}

	ctx, allowed := newAuthenticatedContext(t, http.MethodPost, "/api/token/", map[string]any{
		"name": "allowed", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, 1)
	AddToken(ctx)
	if !decodeAPIResponse(t, allowed).Success {
		t.Fatalf("expected targeted user to create token: %s", allowed.Body.String())
	}
}

func TestLegacyUsernameTargetInputIsResolvedToStableUserId(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	user := createVisibilityTestUser(t, 1, "legacy-name", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, Usernames: []string{"legacy-name"},
	}); err != nil {
		t.Fatal(err)
	}
	var target model.TokenGroupVisibilityTarget
	if err := model.DB.Where("visibility_id = ?", 1).First(&target).Error; err != nil {
		t.Fatal(err)
	}
	if target.UserId != user.Id {
		t.Fatalf("legacy username input must persist stable user_id=%d, got %#v", user.Id, target)
	}
	if err := model.DB.Model(user).Update("username", "renamed-user").Error; err != nil {
		t.Fatal(err)
	}
	groups, err := service.GetUserSelectableTokenGroups(user.Id)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := groups["default"]; !ok {
		t.Fatal("renaming a targeted user must not revoke the user_id-bound policy")
	}
}

func TestDuplicateTargetsAreRejected(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	target := createVisibilityTestUser(t, 1, "duplicate-target", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target.Id, target.Id},
	}); err == nil {
		t.Fatal("duplicate user IDs must be rejected")
	}
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, Usernames: []string{"duplicate-target", "duplicate-target"},
	}); err == nil {
		t.Fatal("duplicate usernames must be rejected")
	}
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target.Id}, Usernames: []string{"duplicate-target"},
	}); err == nil {
		t.Fatal("the same user supplied through both ID and username must be rejected")
	}
}

func TestNonTargetedPoliciesRejectTargetFields(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	for _, visibility := range []string{model.TokenGroupVisibilityPublic, model.TokenGroupVisibilityHidden} {
		t.Run(visibility, func(t *testing.T) {
			err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
				Group: "default", Visibility: visibility, UserIds: []int{1},
			})
			if err == nil {
				t.Fatalf("%s policy with user_ids must be rejected", visibility)
			}
		})
	}
}

func TestVisibilityCASRejectsStaleDigestAndProtectsEmptyState(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	createVisibilityTestUser(t, 1, "cas-target", "default")
	requirePolicy := func(policy model.TokenGroupVisibilityPolicy) {
		t.Helper()
		if err := model.SaveTokenGroupVisibilityPolicy(policy); err != nil {
			t.Fatal(err)
		}
	}
	requirePolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityPublic})
	state, err := model.GetTokenGroupVisibilityState()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := model.ReplaceTokenGroupVisibilityPoliciesCAS(nil, "stale"); !errors.Is(err, model.ErrTokenGroupVisibilityConflict) {
		t.Fatalf("expected stale digest conflict, got %v", err)
	}
	updatedDigest, err := model.ReplaceTokenGroupVisibilityPoliciesCAS(nil, state.Digest)
	if err != nil {
		t.Fatalf("expected CAS clear to succeed with current digest: %v", err)
	}
	if updatedDigest == state.Digest {
		t.Fatal("empty replacement must produce a new digest")
	}
}

func TestAddTokenVisibilityFlagDisabledPreservesLegacyBehavior(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "false")
	createVisibilityTestUser(t, 1, "legacy", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityHidden,
	}); err != nil {
		t.Fatal(err)
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/token/", map[string]any{
		"name": "legacy", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, 1)
	AddToken(ctx)
	if !decodeAPIResponse(t, recorder).Success {
		t.Fatalf("expected legacy behavior while disabled: %s", recorder.Body.String())
	}
}

func TestGetUserGroupsAppliesTargetedVisibilityPerUser(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	target := createVisibilityTestUser(t, 1, "target", "default")
	nonTarget := createVisibilityTestUser(t, 2, "non-target", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{1},
	}); err != nil {
		t.Fatal(err)
	}

	getGroups := func(userID int) map[string]map[string]interface{} {
		t.Helper()
		ctx, recorder := newAuthenticatedContext(t, http.MethodGet, "/api/user/groups", nil, userID)
		GetUserGroups(ctx)
		var response struct {
			Success bool                              `json:"success"`
			Data    map[string]map[string]interface{} `json:"data"`
		}
		if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
			t.Fatalf("failed to decode user groups response: %v", err)
		}
		if !response.Success {
			t.Fatalf("user groups endpoint failed: %s", recorder.Body.String())
		}
		return response.Data
	}

	if _, ok := getGroups(target.Id)["default"]; !ok {
		t.Fatal("target user must see the targeted group in the user groups endpoint")
	}
	if _, ok := getGroups(nonTarget.Id)["default"]; ok {
		t.Fatal("non-target user must not see the targeted group in the user groups endpoint")
	}
}

func TestAdminEntitlementTokenEnforcesTargetUserVisibility(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	if err := model.DB.AutoMigrate(&model.Log{}); err != nil {
		t.Fatalf("failed to migrate audit log table: %v", err)
	}
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	target := createVisibilityTestUser(t, 1, "target", "default")
	nonTarget := createVisibilityTestUser(t, 2, "non-target", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{1},
	}); err != nil {
		t.Fatal(err)
	}

	createAdminToken := func(userID int, name string) tokenAPIResponse {
		t.Helper()
		ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/entitlement/admin-token", map[string]any{
			"user_id":         userID,
			"name":            name,
			"group":           "default",
			"expired_time":    -1,
			"unlimited_quota": true,
		}, 99)
		CreateAdminEntitlementToken(ctx)
		return decodeAPIResponse(t, recorder)
	}

	if response := createAdminToken(nonTarget.Id, "forged-admin-token"); response.Success {
		t.Fatal("admin must not create a targeted group token for a non-target user")
	}
	count, err := model.CountUserTokens(nonTarget.Id)
	if err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("rejected admin creation must not persist a token, got %d", count)
	}

	if response := createAdminToken(target.Id, "target-admin-token"); !response.Success {
		t.Fatalf("admin should create a token for a target user: %#v", response)
	}
	count, err = model.CountUserTokens(target.Id)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("expected one admin-created token for target user, got %d", count)
	}
}

func TestPlaygroundRejectsHiddenGroupSelection(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	user := createVisibilityTestUser(t, 1, "playground-user", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityHidden,
	}); err != nil {
		t.Fatal(err)
	}

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/pg/chat/completions", map[string]any{
		"model": "gpt-4", "group": "default",
	}, user.Id)
	common.SetContextKey(ctx, constant.ContextKeyUsingGroup, user.Group)
	if err := i18n.Init(); err != nil {
		t.Fatalf("failed to initialize backend translations: %v", err)
	}
	middleware.Distribute()(ctx)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected Playground hidden-group selection to return 403, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAutoCrossGroupSelectionFiltersTargetedGroupAtRuntime(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	if err := model.DB.AutoMigrate(&model.Channel{}, &model.Ability{}); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	oldAutoGroups := setting.AutoGroups2JsonString()
	t.Cleanup(func() { _ = setting.UpdateAutoGroupsByJsonString(oldAutoGroups) })
	if err := setting.UpdateAutoGroupsByJsonString(`["default","vip"]`); err != nil {
		t.Fatal(err)
	}
	target := createVisibilityTestUser(t, 1, "auto-target", "default")
	nonTarget := createVisibilityTestUser(t, 2, "auto-non-target", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target.Id},
	}); err != nil {
		t.Fatal(err)
	}
	for id, group := range map[int]string{101: "default", 102: "vip"} {
		if err := model.DB.Create(&model.Channel{Id: id, Type: 1, Key: "test-key", Status: common.ChannelStatusEnabled, Group: group}).Error; err != nil {
			t.Fatal(err)
		}
		if err := model.DB.Create(&model.Ability{Group: group, Model: "auto-cross-model", ChannelId: id, Enabled: true}).Error; err != nil {
			t.Fatal(err)
		}
	}
	oldMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() { common.MemoryCacheEnabled = oldMemoryCache })
	selectGroup := func(user *model.User) string {
		t.Helper()
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		common.SetContextKey(ctx, constant.ContextKeyUserId, user.Id)
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, user.Group)
		common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
		retry := 0
		channel, group, err := service.CacheGetRandomSatisfiedChannel(&service.RetryParam{
			Ctx: ctx, TokenGroup: "auto", ModelName: "auto-cross-model", Retry: &retry,
		})
		if err != nil || channel == nil {
			t.Fatalf("auto/cross-group selection failed for user %d: channel=%#v group=%s err=%v", user.Id, channel, group, err)
		}
		return group
	}
	if got := selectGroup(target); got != "default" {
		t.Fatalf("target user selected group %q, want default", got)
	}
	if got := selectGroup(nonTarget); got != "vip" {
		t.Fatalf("non-target user selected group %q, want vip", got)
	}
}

func TestEntitlementRemainsIndependentFromHiddenAndTargetedVisibility(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	oldEntitlementFeatureEnabled := common.EntitlementFeatureEnabled
	common.EntitlementFeatureEnabled = true
	t.Cleanup(func() { common.EntitlementFeatureEnabled = oldEntitlementFeatureEnabled })

	target := createVisibilityTestUser(t, 1, "entitled-target", "default")
	nonTarget := createVisibilityTestUser(t, 2, "entitled-non-target", "default")
	targetToken := seedToken(t, model.DB, target.Id, "entitled-target-token", "entitled-target-key")
	nonTargetToken := seedToken(t, model.DB, nonTarget.Id, "entitled-non-target-token", "entitled-non-target-key")
	pkg := &model.EntitlementPackage{
		Name: "visibility-independent-entitlement", Status: model.EntitlementStatusEnabled,
		Group: "default", Models: "visibility-independent-model", AllowPublicFallback: false,
	}
	if err := model.SaveEntitlementPackage(pkg); err != nil {
		t.Fatal(err)
	}
	if err := model.UpsertUserEntitlement(&model.UserEntitlement{
		PackageId: pkg.Id, UserId: target.Id, Status: model.EntitlementStatusEnabled,
	}); err != nil {
		t.Fatal(err)
	}
	if err := model.SetTokenEntitlementPackages(targetToken.Id, target.Id, []int{pkg.Id}, false); err != nil {
		t.Fatal(err)
	}

	setVisibility := func(visibility string) {
		t.Helper()
		policy := model.TokenGroupVisibilityPolicy{Group: "default", Visibility: visibility}
		if visibility == model.TokenGroupVisibilityTargeted {
			policy.UserIds = []int{target.Id}
		}
		if err := model.SaveTokenGroupVisibilityPolicy(policy); err != nil {
			t.Fatal(err)
		}
	}
	assertGroupVisible := func(userId int, want bool) {
		t.Helper()
		groups, err := service.GetUserSelectableTokenGroups(userId)
		if err != nil {
			t.Fatal(err)
		}
		_, got := groups["default"]
		if got != want {
			t.Fatalf("default selectable for user %d = %t, want %t", userId, got, want)
		}
	}

	setVisibility(model.TokenGroupVisibilityHidden)
	assertGroupVisible(target.Id, false)
	grant, protected, err := model.ResolveTokenEntitlement(targetToken.Id, target.Id, "visibility-independent-model", time.Now())
	if err != nil || grant == nil || !protected {
		t.Fatalf("hidden P2 visibility must not revoke the P1 entitlement grant: grant=%#v protected=%t err=%v", grant, protected, err)
	}

	setVisibility(model.TokenGroupVisibilityTargeted)
	assertGroupVisible(target.Id, true)
	assertGroupVisible(nonTarget.Id, false)
	grant, protected, err = model.ResolveTokenEntitlement(targetToken.Id, target.Id, "visibility-independent-model", time.Now())
	if err != nil || grant == nil || !protected {
		t.Fatalf("targeted P2 visibility must preserve the target user's P1 entitlement grant: grant=%#v protected=%t err=%v", grant, protected, err)
	}
	grant, protected, err = model.ResolveTokenEntitlement(nonTargetToken.Id, nonTarget.Id, "visibility-independent-model", time.Now())
	if grant != nil || !protected || err == nil {
		t.Fatalf("non-target must remain protected by P1 entitlement enforcement: grant=%#v protected=%t err=%v", grant, protected, err)
	}
}

func TestVisibilityWithoutPolicyPreservesSelectableGroups(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	user := createVisibilityTestUser(t, 1, "legacy", "default")

	groups, err := service.GetUserSelectableTokenGroups(user.Id)
	if err != nil {
		t.Fatal(err)
	}
	legacyGroups := service.GetUserUsableGroups(user.Group)
	if len(groups) != len(legacyGroups) {
		t.Fatalf("expected no-policy groups %#v, got %#v", legacyGroups, groups)
	}
	for group := range legacyGroups {
		if _, ok := groups[group]; !ok {
			t.Fatalf("legacy selectable group %q disappeared", group)
		}
	}
}

func TestUpdateTokenRejectsExistingHiddenGroupEditsButAllowsDisable(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	user := createVisibilityTestUser(t, 1, "bob", "default")
	token := seedToken(t, model.DB, user.Id, "existing", "existing-hidden-key")
	other := seedToken(t, model.DB, user.Id, "other", "other-group-key")
	if err := model.DB.Model(other).Update("group", "vip").Error; err != nil {
		t.Fatal(err)
	}
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityHidden}); err != nil {
		t.Fatal(err)
	}

	if _, err := service.GetUserSelectableTokenGroups(user.Id); err != nil {
		t.Fatal(err)
	}
	persisted, err := model.GetTokenByIds(token.Id, user.Id)
	if err != nil || persisted.Status != common.TokenStatusEnabled || persisted.Group != "default" {
		t.Fatalf("hidden policy must not alter an existing token: token=%#v err=%v", persisted, err)
	}
	runtimeCtx, _ := newAuthenticatedContext(t, http.MethodPost, "/v1/chat/completions", nil, user.Id)
	if err := middleware.SetupContextForToken(runtimeCtx, persisted); err != nil {
		t.Fatalf("existing hidden-group token must still enter the relay context: %v", err)
	}
	if got := common.GetContextKeyString(runtimeCtx, constant.ContextKeyTokenGroup); got != "default" {
		t.Fatalf("relay context lost the existing token group: got %q", got)
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/token/", map[string]any{
		"id": token.Id, "name": "edited", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, user.Id)
	UpdateToken(ctx)
	if decodeAPIResponse(t, recorder).Success {
		t.Fatal("editing an existing hidden-group token must be rejected for a non-target user")
	}

	ctx, recorder = newAuthenticatedContext(t, http.MethodPut, "/api/token/?status_only=1", map[string]any{
		"id": token.Id, "status": common.TokenStatusDisabled, "group": "default",
	}, user.Id)
	UpdateToken(ctx)
	if !decodeAPIResponse(t, recorder).Success {
		t.Fatalf("disabling an existing hidden-group token should remain allowed: %s", recorder.Body.String())
	}

	ctx, recorder = newAuthenticatedContext(t, http.MethodPut, "/api/token/?status_only=1", map[string]any{
		"id": token.Id, "status": common.TokenStatusEnabled, "group": "default",
	}, user.Id)
	UpdateToken(ctx)
	if decodeAPIResponse(t, recorder).Success {
		t.Fatal("re-enabling an existing hidden-group token must be rejected for a non-target user")
	}

	ctx, recorder = newAuthenticatedContext(t, http.MethodPut, "/api/token/", map[string]any{
		"id": other.Id, "name": "forged", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, user.Id)
	UpdateToken(ctx)
	if decodeAPIResponse(t, recorder).Success {
		t.Fatal("expected moving a token into a hidden group to be rejected")
	}
}

func TestVisibilityTimeBoundariesAndDatabaseReadThrough(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	user := createVisibilityTestUser(t, 1, "boundary", "default")
	now := time.Now().Unix()

	assertSelectable := func(want bool) {
		t.Helper()
		groups, err := service.GetUserSelectableTokenGroups(user.Id)
		if err != nil {
			t.Fatal(err)
		}
		_, got := groups["default"]
		if got != want {
			t.Fatalf("default selectable = %t, want %t", got, want)
		}
	}
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityHidden, StartTime: now + 60}); err != nil {
		t.Fatal(err)
	}
	assertSelectable(false)
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityHidden, EndTime: now - 1}); err != nil {
		t.Fatal(err)
	}
	// Expired hidden policies remain fail-closed until an administrator
	// explicitly changes the policy to public or removes it.
	assertSelectable(false)
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityHidden, EndTime: now}); err != nil {
		t.Fatal(err)
	}
	assertSelectable(false)
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityHidden, StartTime: now, EndTime: now + 60}); err != nil {
		t.Fatal(err)
	}
	assertSelectable(false)

	if err := model.DB.Model(&model.TokenGroupVisibility{}).Where(map[string]interface{}{"group": "default"}).Update("visibility", model.TokenGroupVisibilityPublic).Error; err != nil {
		t.Fatal(err)
	}
	assertSelectable(true)
}

func TestTargetedPolicyDirectlyGrantsNonGlobalGroup(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	original := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		if err := setting.UpdateUserUsableGroupsByJSONString(original); err != nil {
			t.Fatalf("failed to restore user usable groups: %v", err)
		}
	})
	if err := setting.UpdateUserUsableGroupsByJSONString(`{"default":"默认分组"}`); err != nil {
		t.Fatal(err)
	}
	target := createVisibilityTestUser(t, 1, "direct-target", "default")
	other := createVisibilityTestUser(t, 2, "direct-other", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "svip", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target.Id},
	}); err != nil {
		t.Fatal(err)
	}
	targetGroups, err := service.GetUserSelectableTokenGroups(target.Id)
	if err != nil {
		t.Fatal(err)
	}
	if desc, ok := targetGroups["svip"]; !ok || desc == "" {
		t.Fatalf("targeted user must receive non-global group directly, got %#v", targetGroups)
	}
	otherGroups, err := service.GetUserSelectableTokenGroups(other.Id)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := otherGroups["svip"]; ok {
		t.Fatalf("non-target user must not receive targeted non-global group: %#v", otherGroups)
	}
}

func TestShadowModePreservesLegacyDecision(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_MODE", "shadow")
	target := createVisibilityTestUser(t, 1, "shadow-target", "default")
	other := createVisibilityTestUser(t, 2, "shadow-other", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target.Id},
	}); err != nil {
		t.Fatal(err)
	}
	groups, err := service.GetUserSelectableTokenGroups(other.Id)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := groups["default"]; !ok {
		t.Fatal("shadow mode must preserve legacy access while reporting a diff")
	}
}

func TestInvalidVisibilityModeFailsClosed(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	t.Setenv("TOKEN_GROUP_VISIBILITY_MODE", "unexpected")
	user := createVisibilityTestUser(t, 1, "invalid-mode", "default")
	state, err := model.GetTokenGroupVisibilityState()
	if err != nil {
		t.Fatal(err)
	}
	if state.Mode != model.TokenGroupVisibilityModeInvalid || !state.Degraded {
		t.Fatalf("invalid mode must be visible as degraded state: %#v", state)
	}
	if _, err := service.GetUserSelectableTokenGroups(user.Id); err == nil {
		t.Fatal("invalid mode must fail closed instead of returning legacy groups")
	}
}

func TestInvalidVisibilityModeRejectsBatchWrites(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	t.Setenv("TOKEN_GROUP_VISIBILITY_MODE", "unexpected")
	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/group/token-visibility/batch", map[string]any{
		"policies":    []model.TokenGroupVisibilityPolicy{{Group: "default", Visibility: model.TokenGroupVisibilityPublic}},
		"allow_empty": true,
	}, 99)
	ReplaceTokenGroupVisibilityPolicies(ctx)
	response := decodeAPIResponse(t, recorder)
	if response.Success {
		t.Fatal("invalid visibility mode must reject administrative writes")
	}
	var state model.TokenGroupVisibilityState
	if err := common.Unmarshal(response.Data, &state); err != nil {
		t.Fatalf("invalid mode write response must retain state data: %v", err)
	}
	if !state.Degraded || state.Mode != model.TokenGroupVisibilityModeInvalid {
		t.Fatalf("unexpected invalid-mode write state: %#v", state)
	}
}

func TestTargetedVisibilityReadsUserIdTargetsThroughDatabase(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	target := createVisibilityTestUser(t, 1, "cache-target", "default")
	other := createVisibilityTestUser(t, 2, "cache-other", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{target.Id},
	}); err != nil {
		t.Fatal(err)
	}
	assertSelectable := func(userId int, want bool) {
		t.Helper()
		groups, err := service.GetUserSelectableTokenGroups(userId)
		if err != nil {
			t.Fatal(err)
		}
		_, got := groups["default"]
		if got != want {
			t.Fatalf("default selectable for user %d = %t, want %t", userId, got, want)
		}
	}
	assertSelectable(target.Id, true)
	assertSelectable(other.Id, false)

	var policy model.TokenGroupVisibility
	if err := model.DB.Where(map[string]interface{}{"group": "default"}).First(&policy).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Where("visibility_id = ?", policy.Id).Delete(&model.TokenGroupVisibilityTarget{}).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Create(&model.TokenGroupVisibilityTarget{VisibilityId: policy.Id, UserId: other.Id}).Error; err != nil {
		t.Fatal(err)
	}
	// The policy lookup must observe an external target update immediately;
	// no process-local authorization cache may retain the old target.
	assertSelectable(target.Id, false)
	assertSelectable(other.Id, true)
}

func TestTargetedVisibilityFailsClosedOutsideTimeWindow(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	targeted := createVisibilityTestUser(t, 1, "alice", "default")
	other := createVisibilityTestUser(t, 2, "bob", "default")
	now := time.Now().Unix()

	assertUnavailableToBoth := func() {
		t.Helper()
		for _, user := range []*model.User{targeted, other} {
			groups, err := service.GetUserSelectableTokenGroups(user.Id)
			if err != nil {
				t.Fatal(err)
			}
			if _, ok := groups["default"]; ok {
				t.Fatalf("targeted group must fail closed outside its time window for user %q", user.Username)
			}
		}
	}

	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted,
		UserIds: []int{1}, StartTime: now + 60,
	}); err != nil {
		t.Fatal(err)
	}
	assertUnavailableToBoth()

	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted,
		UserIds: []int{1}, EndTime: now - 1,
	}); err != nil {
		t.Fatal(err)
	}
	assertUnavailableToBoth()

	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted,
		UserIds: []int{1}, EndTime: now,
	}); err != nil {
		t.Fatal(err)
	}
	assertUnavailableToBoth()
}

func TestReplaceTokenGroupVisibilityPoliciesIsAtomic(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	createVisibilityTestUser(t, 1, "alice", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityPublic,
	}); err != nil {
		t.Fatal(err)
	}

	err := model.ReplaceTokenGroupVisibilityPolicies([]model.TokenGroupVisibilityPolicy{
		{Group: "default", Visibility: model.TokenGroupVisibilityHidden},
		{Group: "missing-group", Visibility: model.TokenGroupVisibilityPublic},
	})
	if err == nil {
		t.Fatal("expected invalid batch to fail")
	}
	policies, err := model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		t.Fatal(err)
	}
	if len(policies) != 1 || policies[0].Group != "default" || policies[0].Visibility != model.TokenGroupVisibilityPublic {
		t.Fatalf("failed batch must leave previous state unchanged: %#v", policies)
	}

	if err := model.ReplaceTokenGroupVisibilityPolicies([]model.TokenGroupVisibilityPolicy{
		{Group: "default", Visibility: model.TokenGroupVisibilityTargeted, UserIds: []int{1}},
	}); err != nil {
		t.Fatal(err)
	}
	policies, err = model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		t.Fatal(err)
	}
	if len(policies) != 1 || policies[0].Visibility != model.TokenGroupVisibilityTargeted || len(policies[0].UserIds) != 1 || policies[0].UserIds[0] != 1 {
		t.Fatalf("valid batch was not applied completely: %#v", policies)
	}

	if err := model.ReplaceTokenGroupVisibilityPolicies(nil); err != nil {
		t.Fatal(err)
	}
	policies, err = model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		t.Fatal(err)
	}
	if len(policies) != 0 {
		t.Fatalf("empty desired state must remove all policies: %#v", policies)
	}
}

func TestReplaceTokenGroupVisibilityPoliciesRejectsOrphans(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		if err := ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio); err != nil {
			t.Fatalf("failed to restore group ratios: %v", err)
		}
	})

	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityPublic,
	}); err != nil {
		t.Fatal(err)
	}
	if err := ratio_setting.UpdateGroupRatioByJSONString(`{"svip":1}`); err != nil {
		t.Fatal(err)
	}

	if err := model.ReplaceTokenGroupVisibilityPolicies([]model.TokenGroupVisibilityPolicy{
		{Group: "default", Visibility: model.TokenGroupVisibilityHidden},
	}); err == nil {
		t.Fatal("existing orphan must be rejected in full replacement")
	}
	policies, err := model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		t.Fatal(err)
	}
	if len(policies) != 1 || policies[0].Group != "default" || policies[0].Visibility != model.TokenGroupVisibilityPublic {
		t.Fatalf("rejected orphan replacement must leave DB unchanged: %#v", policies)
	}

	if err := model.ReplaceTokenGroupVisibilityPolicies([]model.TokenGroupVisibilityPolicy{
		{Group: "never-seen", Visibility: model.TokenGroupVisibilityPublic},
	}); err == nil {
		t.Fatal("a new group absent from GroupRatio must still be rejected")
	}
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "auto", Visibility: model.TokenGroupVisibilityPublic,
	}); err == nil {
		t.Fatal("auto must be rejected by single-policy save")
	}
	if err := model.ReplaceTokenGroupVisibilityPolicies([]model.TokenGroupVisibilityPolicy{
		{Group: "auto", Visibility: model.TokenGroupVisibilityPublic},
	}); err == nil {
		t.Fatal("auto must be rejected by full replacement")
	}
}

func TestPublicPolicyCannotExpandBaseGroupPermission(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	user := createVisibilityTestUser(t, 1, "intersection", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "svip", Visibility: model.TokenGroupVisibilityPublic}); err != nil {
		t.Fatal(err)
	}
	groups, err := service.GetUserSelectableTokenGroups(user.Id)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := groups["svip"]; ok {
		t.Fatal("public visibility policy must not grant a group absent from base permission")
	}
}

func TestUnknownVisibilityPolicyFailsClosed(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	user := createVisibilityTestUser(t, 1, "malformed-policy", "default")
	if err := model.DB.Create(&model.TokenGroupVisibility{Group: "default", Visibility: "invalid"}).Error; err != nil {
		t.Fatal(err)
	}

	groups, err := service.GetUserSelectableTokenGroups(user.Id)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := groups["default"]; ok {
		t.Fatal("unknown visibility policy must not expose the group")
	}
}

func TestVisibilityLookupDoesNotChangeExistingUserOrTokenState(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	user := createVisibilityTestUser(t, 1, "baseline", "default")
	user.Quota = 12345
	if err := model.DB.Model(user).Update("quota", user.Quota).Error; err != nil {
		t.Fatal(err)
	}
	token := seedToken(t, model.DB, user.Id, "baseline-token", "baseline-key")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityPublic}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.GetUserSelectableTokenGroups(user.Id); err != nil {
		t.Fatal(err)
	}

	storedUser, err := model.GetUserById(user.Id, false)
	if err != nil || storedUser.Quota != user.Quota || storedUser.Status != common.UserStatusEnabled {
		t.Fatalf("visibility lookup changed user state: user=%#v err=%v", storedUser, err)
	}
	storedToken, err := model.GetTokenByIds(token.Id, user.Id)
	if err != nil || storedToken.Status != common.TokenStatusEnabled || storedToken.RemainQuota != token.RemainQuota {
		t.Fatalf("visibility lookup changed token state: token=%#v err=%v", storedToken, err)
	}
}
