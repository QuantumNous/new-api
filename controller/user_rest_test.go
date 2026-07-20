package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type restErrorEnvelope struct {
	Success bool   `json:"success"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type userResponseEnvelope struct {
	Success bool             `json:"success"`
	Message string           `json:"message"`
	Data    *json.RawMessage `json:"data"`
}

func newRestContext(t *testing.T, method, target string, body any, params gin.Params, callerRole int) (*gin.Context, *httptest.ResponseRecorder) {
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
	ctx.Request = httptest.NewRequest(method, target, reader)
	if body != nil {
		ctx.Request.Header.Set("Content-Type", "application/json")
	}
	ctx.Params = params
	ctx.Set("id", 1)
	ctx.Set("role", callerRole)
	ctx.Set("username", "test-admin")
	return ctx, recorder
}

func decodeRestError(t *testing.T, rec *httptest.ResponseRecorder) restErrorEnvelope {
	t.Helper()
	var resp restErrorEnvelope
	if err := common.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal err envelope: %v body=%s", err, rec.Body.String())
	}
	return resp
}

// ---------- GetUser ----------

func TestGetUser_NotFound_404(t *testing.T) {
	openUserControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/user/999999", nil,
		gin.Params{{Key: "id", Value: "999999"}}, common.RoleAdminUser)
	GetUser(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeRestError(t, rec)
	if resp.Code != "user_not_found" {
		t.Errorf("code: got %q want user_not_found", resp.Code)
	}
	if resp.Success {
		t.Errorf("success should be false")
	}
}

func TestGetUser_BadId_400(t *testing.T) {
	openUserControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodGet, "/api/user/abc", nil,
		gin.Params{{Key: "id", Value: "abc"}}, common.RoleAdminUser)
	GetUser(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

func TestGetUser_PermissionDenied_403(t *testing.T) {
	db := openUserControllerTestDB(t)
	root := seedUser(t, db, "rootbob", common.RoleRootUser, "default")
	ctx, rec := newRestContext(t, http.MethodGet, "/api/user/", nil,
		gin.Params{{Key: "id", Value: itoa(root.Id)}}, common.RoleAdminUser)
	GetUser(ctx)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status got %d want 403 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "permission_denied" {
		t.Errorf("code: got %q want permission_denied", c)
	}
}

// ---------- DeleteUser ----------

func TestDeleteUser_NotFound_404(t *testing.T) {
	openUserControllerTestDB(t)
	ctx, rec := newRestContext(t, http.MethodDelete, "/api/user/9999", nil,
		gin.Params{{Key: "id", Value: "9999"}}, common.RoleRootUser)
	DeleteUser(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404", rec.Code)
	}
	if c := decodeRestError(t, rec).Code; c != "user_not_found" {
		t.Errorf("code: got %q want user_not_found", c)
	}
}

func TestDeleteUser_PermissionDenied_403(t *testing.T) {
	db := openUserControllerTestDB(t)
	root := seedUser(t, db, "rootkill", common.RoleRootUser, "default")
	ctx, rec := newRestContext(t, http.MethodDelete, "/api/user/", nil,
		gin.Params{{Key: "id", Value: itoa(root.Id)}}, common.RoleAdminUser)
	DeleteUser(ctx)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status got %d want 403 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "permission_denied" {
		t.Errorf("code: got %q want permission_denied", c)
	}
}

// ---------- UpdateUser ----------

func TestUpdateUser_NotFound_404(t *testing.T) {
	openUserControllerTestDB(t)
	body := map[string]any{"id": 9999, "username": "nope", "display_name": "x", "password": "Password12"}
	ctx, rec := newRestContext(t, http.MethodPut, "/api/user/", body, nil, common.RoleRootUser)
	UpdateUser(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "user_not_found" {
		t.Errorf("code: got %q want user_not_found", c)
	}
}

func TestUpdateUser_InvalidParams_400(t *testing.T) {
	openUserControllerTestDB(t)
	body := map[string]any{"username": "missing-id"}
	ctx, rec := newRestContext(t, http.MethodPut, "/api/user/", body, nil, common.RoleRootUser)
	UpdateUser(ctx)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status got %d want 400 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "invalid_params" {
		t.Errorf("code: got %q want invalid_params", c)
	}
}

// ---------- ManageUser ----------

func TestManageUser_NotFound_404(t *testing.T) {
	openUserControllerTestDB(t)
	body := ManageRequest{Id: 9999, Action: "disable"}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/manage", body, nil, common.RoleRootUser)
	ManageUser(ctx)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status got %d want 404 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "user_not_found" {
		t.Errorf("code: got %q want user_not_found", c)
	}
}

func TestManageUser_DisableRoot_403(t *testing.T) {
	db := openUserControllerTestDB(t)
	root := seedUser(t, db, "rootguard", common.RoleRootUser, "default")
	body := ManageRequest{Id: root.Id, Action: "disable"}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/manage", body, nil, common.RoleRootUser)
	ManageUser(ctx)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status got %d want 403 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "cannot_disable_root" {
		t.Errorf("code: got %q want cannot_disable_root", c)
	}
}

func TestManageUser_AdminCannotPromote_403(t *testing.T) {
	db := openUserControllerTestDB(t)
	target := seedUser(t, db, "common1", common.RoleCommonUser, "default")
	body := ManageRequest{Id: target.Id, Action: "promote"}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/manage", body, nil, common.RoleAdminUser)
	ManageUser(ctx)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status got %d want 403 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "admin_cannot_promote" {
		t.Errorf("code: got %q want admin_cannot_promote", c)
	}
}

func TestManageUser_AlreadyAdmin_409(t *testing.T) {
	db := openUserControllerTestDB(t)
	admin := seedUser(t, db, "admin1", common.RoleAdminUser, "default")
	body := ManageRequest{Id: admin.Id, Action: "promote"}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/manage", body, nil, common.RoleRootUser)
	ManageUser(ctx)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status got %d want 409 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "user_already_admin" {
		t.Errorf("code: got %q want user_already_admin", c)
	}
}

func TestManageUser_DisableSuccess_200(t *testing.T) {
	db := openUserControllerTestDB(t)
	target := seedUser(t, db, "tobedisabled", common.RoleCommonUser, "default")
	body := ManageRequest{Id: target.Id, Action: "disable"}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/manage", body, nil, common.RoleAdminUser)
	ManageUser(ctx)
	if rec.Code != http.StatusOK {
		t.Fatalf("status got %d want 200 body=%s", rec.Code, rec.Body.String())
	}
	var env userResponseEnvelope
	if err := common.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !env.Success || env.Data == nil {
		t.Fatalf("expected success+data: %+v", env)
	}
	var resp ManageUserResponse
	if err := common.Unmarshal(*env.Data, &resp); err != nil {
		t.Fatalf("unmarshal data: %v", err)
	}
	if resp.Action != "disable" || resp.UserId != target.Id || resp.Status != common.UserStatusDisabled {
		t.Errorf("unexpected manage response: %+v", resp)
	}

	var after model.User
	if err := db.First(&after, target.Id).Error; err != nil {
		t.Fatalf("read back: %v", err)
	}
	if after.Status != common.UserStatusDisabled {
		t.Errorf("status not persisted: got %d", after.Status)
	}
}

// ---------- CreateUser ----------

func TestCreateUser_UsernameCollision_409(t *testing.T) {
	db := openUserControllerTestDB(t)
	seedUser(t, db, "taken", common.RoleCommonUser, "default")

	body := map[string]any{"username": "taken", "password": "Password12", "role": common.RoleCommonUser}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/", body, nil, common.RoleRootUser)
	CreateUser(ctx)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status got %d want 409 body=%s", rec.Code, rec.Body.String())
	}
	resp := decodeRestError(t, rec)
	if resp.Code != "username_already_taken" {
		t.Errorf("code: got %q want username_already_taken", resp.Code)
	}
	if resp.Success {
		t.Errorf("success should be false")
	}
}

func TestCreateUser_UsernameCollision_SecondRequest_409(t *testing.T) {
	db := openUserControllerTestDB(t)
	seedUser(t, db, "secondtaken", common.RoleCommonUser, "default")

	body := map[string]any{"username": "secondtaken", "password": "Password12", "role": common.RoleCommonUser}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/", body, nil, common.RoleRootUser)
	CreateUser(ctx)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status got %d want 409 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "username_already_taken" {
		t.Errorf("code got %q want username_already_taken", c)
	}
}

func TestCreateUser_HappyPath_201(t *testing.T) {
	openUserControllerTestDB(t)

	// Admin (non-root) caller creating a common user avoids the root-only authz
	// reconciliation path (casbin_rule), keeping the test scoped to the guard.
	body := map[string]any{"username": "brandnew", "password": "Password12", "role": common.RoleCommonUser}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/", body, nil, common.RoleAdminUser)
	CreateUser(ctx)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status got %d want 201 body=%s", rec.Code, rec.Body.String())
	}
}

func TestCreateUser_SoftDeletedUsernameCollision_409(t *testing.T) {
	db := openUserControllerTestDB(t)
	deleted := seedUser(t, db, "ghost", common.RoleCommonUser, "default")
	if err := db.Delete(&model.User{}, deleted.Id).Error; err != nil {
		t.Fatalf("soft-delete user: %v", err)
	}

	body := map[string]any{"username": "ghost", "password": "Password12", "role": common.RoleCommonUser}
	ctx, rec := newRestContext(t, http.MethodPost, "/api/user/", body, nil, common.RoleRootUser)
	CreateUser(ctx)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status got %d want 409 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "username_already_taken" {
		t.Errorf("code: got %q want username_already_taken", c)
	}
}

// ---------- UpdateUser username collision ----------

func TestUpdateUser_UsernameCollision_409(t *testing.T) {
	db := openUserControllerTestDB(t)
	seedUser(t, db, "existing", common.RoleCommonUser, "default")
	target := seedUser(t, db, "target", common.RoleCommonUser, "default")

	body := map[string]any{"id": target.Id, "username": "existing", "display_name": "x", "password": "Password12"}
	ctx, rec := newRestContext(t, http.MethodPut, "/api/user/", body, nil, common.RoleRootUser)
	UpdateUser(ctx)

	if rec.Code != http.StatusConflict {
		t.Fatalf("status got %d want 409 body=%s", rec.Code, rec.Body.String())
	}
	if c := decodeRestError(t, rec).Code; c != "username_already_taken" {
		t.Errorf("code: got %q want username_already_taken", c)
	}
}

func TestUpdateUser_SameUsername_200(t *testing.T) {
	db := openUserControllerTestDB(t)
	target := seedUser(t, db, "keepname", common.RoleCommonUser, "default")

	body := map[string]any{"id": target.Id, "username": "keepname", "display_name": "updated", "password": "Password12"}
	ctx, rec := newRestContext(t, http.MethodPut, "/api/user/", body, nil, common.RoleRootUser)
	UpdateUser(ctx)

	if rec.Code != http.StatusOK {
		t.Fatalf("status got %d want 200 body=%s", rec.Code, rec.Body.String())
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := false
	if n < 0 {
		neg = true
		n = -n
	}
	buf := make([]byte, 0, 12)
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	if neg {
		buf = append([]byte{'-'}, buf...)
	}
	return string(buf)
}
