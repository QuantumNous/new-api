package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestUserCanUseGroupsReadsAuthoritativeGroup(t *testing.T) {
	db := setupInitialTokenControllerTestDB(t)
	user := seedTokenUser(t, db, 21)
	user.Group = "Enterprise"
	user.IsEnterprise = false
	if err := db.Save(user).Error; err != nil {
		t.Fatalf("failed to update user: %v", err)
	}

	canUseGroups, err := userCanUseGroups(21)
	if err != nil {
		t.Fatalf("expected group lookup to succeed: %v", err)
	}
	if !canUseGroups {
		t.Fatalf("expected non-plg DB group to enable group selection")
	}

	if err := db.Model(&model.User{}).Where("id = ?", 21).Update("group", plgGroup).Error; err != nil {
		t.Fatalf("failed to update user group: %v", err)
	}
	canUseGroups, err = userCanUseGroups(21)
	if err != nil {
		t.Fatalf("expected group lookup to succeed after plg update: %v", err)
	}
	if canUseGroups {
		t.Fatalf("expected plg DB group to disable group selection")
	}

	if err := db.Model(&model.User{}).Where("id = ?", 21).Update("group", "").Error; err != nil {
		t.Fatalf("failed to clear user group: %v", err)
	}
	canUseGroups, err = userCanUseGroups(21)
	if err != nil {
		t.Fatalf("expected group lookup to succeed after empty group update: %v", err)
	}
	if canUseGroups {
		t.Fatalf("expected empty DB group to disable group selection")
	}
}

func TestGetGroupsUserIncludesPLG(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/group/?type=user", nil)

	GetGroups(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool     `json:"success"`
		Data    []string `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	require.True(t, response.Success)
	require.Contains(t, response.Data, defaultUserGroup)
	require.Contains(t, response.Data, plgGroup)
}
