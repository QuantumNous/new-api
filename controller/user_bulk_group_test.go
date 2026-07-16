package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	// import ratio_setting for its init() that seeds defaultGroupRatio
	// ("default", "vip", "svip") into groupRatioMap.
	_ "github.com/QuantumNous/new-api/setting/ratio_setting"
)

type bulkGroupAPIResponse struct {
	Success bool                        `json:"success"`
	Message string                      `json:"message"`
	Data    *BulkUpdateUserGroupResponse `json:"data"`
}

func openUserControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatalf("failed to migrate user table: %v", err)
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

func seedUser(t *testing.T, db *gorm.DB, username string, role int, group string) *model.User {
	t.Helper()
	u := &model.User{
		Username:    username,
		Password:    "$2a$10$placeholder.placeholder.placeholder.placeholder.plh",
		DisplayName: username,
		Role:        role,
		Status:      common.UserStatusEnabled,
		Group:       group,
		AffCode:     "aff_" + username,
	}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("failed to create user %q: %v", username, err)
	}
	return u
}

func newBulkGroupContext(t *testing.T, body any, callerRole int) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		payload, err := common.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(payload)
	} else {
		reader = bytes.NewReader(nil)
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/user/group/batch", reader)
	if body != nil {
		ctx.Request.Header.Set("Content-Type", "application/json")
	}
	ctx.Set("id", 1)
	ctx.Set("role", callerRole)
	return ctx, recorder
}

func decodeBulkResponse(t *testing.T, recorder *httptest.ResponseRecorder) bulkGroupAPIResponse {
	t.Helper()
	var resp bulkGroupAPIResponse
	if err := common.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v (body=%s)", err, recorder.Body.String())
	}
	return resp
}

func TestBulkUpdateUserGroup_HappyPath(t *testing.T) {
	db := openUserControllerTestDB(t)
	u1 := seedUser(t, db, "alice", common.RoleCommonUser, "default")
	u2 := seedUser(t, db, "bob", common.RoleCommonUser, "default")
	u3 := seedUser(t, db, "carol", common.RoleCommonUser, "default")

	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: []int{u1.Id, u2.Id, u3.Id},
		Group:   "vip",
	}, common.RoleAdminUser)
	BulkUpdateUserGroup(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200 body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeBulkResponse(t, rec)
	if !resp.Success || resp.Data == nil {
		t.Fatalf("expected success with data: %+v", resp)
	}
	if resp.Data.Updated != 3 || len(resp.Data.UpdatedIds) != 3 {
		t.Fatalf("expected 3 updated, got %+v", resp.Data)
	}
	if len(resp.Data.SkippedIds) != 0 || len(resp.Data.NotFoundIds) != 0 {
		t.Fatalf("expected no skipped/not_found, got %+v", resp.Data)
	}

	var got []model.User
	if err := db.Where("id IN ?", []int{u1.Id, u2.Id, u3.Id}).Find(&got).Error; err != nil {
		t.Fatalf("read back: %v", err)
	}
	for _, u := range got {
		if u.Group != "vip" {
			t.Errorf("user %d group=%q want vip", u.Id, u.Group)
		}
	}
}

func TestBulkUpdateUserGroup_EmptyIds(t *testing.T) {
	openUserControllerTestDB(t)
	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: []int{},
		Group:   "vip",
	}, common.RoleAdminUser)
	BulkUpdateUserGroup(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestBulkUpdateUserGroup_EmptyGroup(t *testing.T) {
	openUserControllerTestDB(t)
	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: []int{1, 2},
		Group:   "",
	}, common.RoleAdminUser)
	BulkUpdateUserGroup(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400", rec.Code)
	}
}

func TestBulkUpdateUserGroup_BatchTooLarge(t *testing.T) {
	openUserControllerTestDB(t)
	ids := make([]int, bulkUpdateUserGroupMaxBatch+1)
	for i := range ids {
		ids[i] = i + 1
	}
	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: ids,
		Group:   "vip",
	}, common.RoleAdminUser)
	BulkUpdateUserGroup(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400", rec.Code)
	}
}

func TestBulkUpdateUserGroup_UnknownGroup(t *testing.T) {
	db := openUserControllerTestDB(t)
	u := seedUser(t, db, "alice", common.RoleCommonUser, "default")
	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: []int{u.Id},
		Group:   "does-not-exist",
	}, common.RoleAdminUser)
	BulkUpdateUserGroup(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
}

func TestBulkUpdateUserGroup_AllNotFound(t *testing.T) {
	openUserControllerTestDB(t)
	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: []int{9001, 9002},
		Group:   "vip",
	}, common.RoleAdminUser)
	BulkUpdateUserGroup(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
}

func TestBulkUpdateUserGroup_AllForbiddenByRole(t *testing.T) {
	db := openUserControllerTestDB(t)
	// caller is admin; targets are root → admin cannot manage root
	root := seedUser(t, db, "root1", common.RoleRootUser, "default")

	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: []int{root.Id},
		Group:   "vip",
	}, common.RoleAdminUser)
	BulkUpdateUserGroup(ctx)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status: got %d want 403 body=%s", rec.Code, rec.Body.String())
	}

	var u model.User
	if err := db.First(&u, root.Id).Error; err != nil {
		t.Fatalf("read back: %v", err)
	}
	if u.Group != "default" {
		t.Errorf("group should remain default, got %q", u.Group)
	}
}

func TestBulkUpdateUserGroup_PartialSuccess(t *testing.T) {
	db := openUserControllerTestDB(t)
	common1 := seedUser(t, db, "alice", common.RoleCommonUser, "default")
	root := seedUser(t, db, "root1", common.RoleRootUser, "default")
	// missing id 9999

	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: []int{common1.Id, root.Id, 9999},
		Group:   "vip",
	}, common.RoleAdminUser)
	BulkUpdateUserGroup(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200 body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeBulkResponse(t, rec)
	if !resp.Success || resp.Data == nil {
		t.Fatalf("expected success with data: %+v", resp)
	}
	if resp.Data.Updated != 1 || len(resp.Data.UpdatedIds) != 1 || resp.Data.UpdatedIds[0] != common1.Id {
		t.Errorf("expected updated=[%d], got %+v", common1.Id, resp.Data)
	}
	if len(resp.Data.SkippedIds) != 1 || resp.Data.SkippedIds[0] != root.Id {
		t.Errorf("expected skipped=[%d], got %+v", root.Id, resp.Data.SkippedIds)
	}
	if len(resp.Data.NotFoundIds) != 1 || resp.Data.NotFoundIds[0] != 9999 {
		t.Errorf("expected not_found=[9999], got %+v", resp.Data.NotFoundIds)
	}

	var rootRead model.User
	if err := db.First(&rootRead, root.Id).Error; err != nil {
		t.Fatalf("read root back: %v", err)
	}
	if rootRead.Group != "default" {
		t.Errorf("root group should remain default, got %q", rootRead.Group)
	}
}

func TestBulkUpdateUserGroup_RootCallerCanManageAnyone(t *testing.T) {
	db := openUserControllerTestDB(t)
	admin := seedUser(t, db, "admin1", common.RoleAdminUser, "default")
	root := seedUser(t, db, "root2", common.RoleRootUser, "default")

	ctx, rec := newBulkGroupContext(t, BulkUpdateUserGroupRequest{
		UserIds: []int{admin.Id, root.Id},
		Group:   "svip",
	}, common.RoleRootUser)
	BulkUpdateUserGroup(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d want 200 body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeBulkResponse(t, rec)
	if resp.Data.Updated != 2 {
		t.Fatalf("expected 2 updated, got %+v", resp.Data)
	}
}
