package middleware

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateTokenGroupAccessUsesConcreteCandidates(t *testing.T) {
	token := &model.Token{Group: "auto"}
	require.NoError(t, token.SetGroupCandidates([]string{"default", "vip"}))

	// The virtual auto group is not usable by default, but explicit concrete
	// candidates are authorized independently.
	require.NoError(t, validateTokenGroupAccess("default", token))

	legacyAutoToken := &model.Token{Group: "auto"}
	require.Error(t, validateTokenGroupAccess("default", legacyAutoToken))

	token.Group = "default"
	require.Error(t, validateTokenGroupAccess("default", token))

	require.NoError(t, token.SetGroupCandidates([]string{"default"}))
	require.Error(t, validateTokenGroupAccess("default", token))
}

func TestValidateTokenGroupAccessRejectsInvalidCandidateStorage(t *testing.T) {
	tests := []struct {
		name  string
		token *model.Token
	}{
		{name: "malformed json", token: &model.Token{Group: "auto", GroupCandidates: "not-json"}},
		{name: "unauthorized group", token: &model.Token{Group: "auto", GroupCandidates: `["hidden","default"]`}},
		{name: "duplicate group", token: &model.Token{Group: "auto", GroupCandidates: `["default","default"]`}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Error(t, validateTokenGroupAccess("default", tt.token))
		})
	}
}

func TestSetupContextForTokenAddsOrderedGroupCandidates(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	token := &model.Token{Id: 9, UserId: 3, Group: "auto", CrossGroupRetry: true}
	require.NoError(t, token.SetGroupCandidates([]string{"default", "vip"}))

	require.NoError(t, SetupContextForToken(ctx, token))
	assert.Equal(t, []string{"default", "vip"}, common.GetContextKeyStringSlice(ctx, constant.ContextKeyTokenGroupCandidates))
	assert.Equal(t, "auto", common.GetContextKeyString(ctx, constant.ContextKeyTokenGroup))
	assert.True(t, common.GetContextKeyBool(ctx, constant.ContextKeyTokenCrossGroupRetry))
}
