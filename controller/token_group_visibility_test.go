package controller

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

func setupTokenGroupVisibilityTestDB(t *testing.T) {
	t.Helper()
	db := openTokenControllerTestDB(t)
	if err := db.AutoMigrate(&model.Token{}, &model.User{}, &model.TokenGroupVisibility{}, &model.TokenGroupVisibilityTarget{}); err != nil {
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

func TestAddTokenEnforcesTargetedVisibility(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
	t.Setenv("TOKEN_GROUP_VISIBILITY_ENABLED", "true")
	createVisibilityTestUser(t, 1, "alice", "default")
	createVisibilityTestUser(t, 2, "bob", "default")
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted, Usernames: []string{"alice"},
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

func TestUpdateTokenAllowsEditingExistingHiddenGroupButRejectsMovingIntoIt(t *testing.T) {
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
	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, "/api/token/", map[string]any{
		"id": token.Id, "name": "edited", "group": "default", "expired_time": -1, "unlimited_quota": true,
	}, user.Id)
	UpdateToken(ctx)
	if !decodeAPIResponse(t, recorder).Success {
		t.Fatalf("expected editing an existing token without changing its hidden group to succeed: %s", recorder.Body.String())
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
	assertSelectable(true)
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityHidden, EndTime: now - 1}); err != nil {
		t.Fatal(err)
	}
	assertSelectable(true)
	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{Group: "default", Visibility: model.TokenGroupVisibilityHidden, StartTime: now, EndTime: now + 60}); err != nil {
		t.Fatal(err)
	}
	assertSelectable(false)

	if err := model.DB.Model(&model.TokenGroupVisibility{}).Where(map[string]interface{}{"group": "default"}).Update("visibility", model.TokenGroupVisibilityPublic).Error; err != nil {
		t.Fatal(err)
	}
	assertSelectable(true)
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
		Usernames: []string{"alice"}, StartTime: now + 60,
	}); err != nil {
		t.Fatal(err)
	}
	assertUnavailableToBoth()

	if err := model.SaveTokenGroupVisibilityPolicy(model.TokenGroupVisibilityPolicy{
		Group: "default", Visibility: model.TokenGroupVisibilityTargeted,
		Usernames: []string{"alice"}, EndTime: now - 1,
	}); err != nil {
		t.Fatal(err)
	}
	assertUnavailableToBoth()
}

func TestReplaceTokenGroupVisibilityPoliciesIsAtomic(t *testing.T) {
	setupTokenGroupVisibilityTestDB(t)
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
		{Group: "default", Visibility: model.TokenGroupVisibilityTargeted, Usernames: []string{"alice"}},
	}); err != nil {
		t.Fatal(err)
	}
	policies, err = model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		t.Fatal(err)
	}
	if len(policies) != 1 || policies[0].Visibility != model.TokenGroupVisibilityTargeted || len(policies[0].Usernames) != 1 || policies[0].Usernames[0] != "alice" {
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
