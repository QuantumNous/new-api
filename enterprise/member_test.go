/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const nicknameTestEnterpriseID = 1
const nicknameTestAdminUserID = 1
const nicknameTestMemberUserID = 2

// setupNicknameTestDB returns an in-memory SQLite DB migrated for enterprise
// member tests, with one enabled enterprise, its admin member, and a regular
// member plus the matching user rows.
func setupNicknameTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(&Enterprise{}, &Member{}, &Invitation{}, &JoinRequest{}, &Tag{}, &MemberTag{}, &model.User{}))

	now := common.GetTimestamp()
	require.NoError(t, db.Create(&Enterprise{Id: nicknameTestEnterpriseID, Name: "Acme", Status: EnterpriseStatusEnabled, AdminUserId: nicknameTestAdminUserID, CreatedTime: now, UpdatedTime: now}).Error)
	require.NoError(t, db.Create(&Member{EnterpriseId: nicknameTestEnterpriseID, UserId: nicknameTestMemberUserID, Role: MemberRoleUser, Status: MemberStatusActive, JoinedAt: now}).Error)
	require.NoError(t, db.Create(&model.User{Id: nicknameTestAdminUserID, Username: "admin", Password: "password123", AffCode: "admin"}).Error)
	require.NoError(t, db.Create(&model.User{Id: nicknameTestMemberUserID, Username: "alice", Password: "password123", AffCode: "alice"}).Error)

	model.DB = db
	return db
}

// nicknameContext builds a gin context for a PUT /members/:uid request body,
// with the enterprise_id context key set so updateMember runs as an admin
// without going through EnterpriseAdminAuth.
func nicknameContext(t *testing.T, uid int, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	payload, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/members/"+strconv.Itoa(uid), bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "uid", Value: strconv.Itoa(uid)}}
	ctx.Set(enterpriseIDContextKey, nicknameTestEnterpriseID)
	return ctx, recorder
}

// i18n must be initialized once so failureI18n can localize error keys.
func initI18nOnce(t *testing.T) {
	t.Helper()
	require.NoError(t, i18n.Init())
}

func TestUpdateMember_SetsNickname(t *testing.T) {
	db := setupNicknameTestDB(t)
	initI18nOnce(t)

	ctx, recorder := nicknameContext(t, nicknameTestMemberUserID, updateMemberRequest{Nickname: ptr("产品组-小李")})
	updateMember(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, "body=%s", recorder.Body.String())
	var resp struct {
		Success bool                      `json:"success"`
		Data    enterpriseMemberResponse  `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &resp))
	assert.True(t, resp.Success)
	assert.Equal(t, "产品组-小李", resp.Data.Nickname)

	var member Member
	require.NoError(t, db.Where("user_id = ?", nicknameTestMemberUserID).First(&member).Error)
	assert.Equal(t, "产品组-小李", member.Nickname)
}

func TestUpdateMember_NicknameBoundary(t *testing.T) {
	db := setupNicknameTestDB(t)
	initI18nOnce(t)

	thirtyTwo := strings.Repeat("啊", 32) // 32 runes, within limit
	ctx, recorder := nicknameContext(t, nicknameTestMemberUserID, updateMemberRequest{Nickname: ptr(thirtyTwo)})
	updateMember(ctx)
	require.Equal(t, http.StatusOK, recorder.Code, "32-rune nickname should be accepted; body=%s", recorder.Body.String())
	var member Member
	require.NoError(t, db.Where("user_id = ?", nicknameTestMemberUserID).First(&member).Error)
	assert.Equal(t, thirtyTwo, member.Nickname)

	// whitespace is trimmed before the rune count, so surrounding spaces don't count
	ctx, recorder = nicknameContext(t, nicknameTestMemberUserID, updateMemberRequest{Nickname: ptr("  bob  ")})
	updateMember(ctx)
	require.Equal(t, http.StatusOK, recorder.Code, "body=%s", recorder.Body.String())
	require.NoError(t, db.Where("user_id = ?", nicknameTestMemberUserID).First(&member).Error)
	assert.Equal(t, "bob", member.Nickname, "nickname should be trimmed")
}

func TestUpdateMember_NicknameTooLong(t *testing.T) {
	setupNicknameTestDB(t)
	initI18nOnce(t)

	tooLong := strings.Repeat("x", 33)
	ctx, recorder := nicknameContext(t, nicknameTestMemberUserID, updateMemberRequest{Nickname: ptr(tooLong)})
	updateMember(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	// failureI18n returns the translated message, not the key.
	assert.Contains(t, recorder.Body.String(), i18n.Translate(i18n.LangEn, i18n.MsgEnterpriseNicknameTooLong))
}

func TestUpdateMember_ClearNicknameWithEmptyString(t *testing.T) {
	db := setupNicknameTestDB(t)
	initI18nOnce(t)

	require.NoError(t, db.Model(&Member{}).Where("user_id = ?", nicknameTestMemberUserID).Update("nickname", "old").Error)

	ctx, recorder := nicknameContext(t, nicknameTestMemberUserID, updateMemberRequest{Nickname: ptr("")})
	updateMember(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, "body=%s", recorder.Body.String())
	var member Member
	require.NoError(t, db.Where("user_id = ?", nicknameTestMemberUserID).First(&member).Error)
	assert.Equal(t, "", member.Nickname, "empty nickname should clear the value")
}

func TestUpdateMember_NilNicknameLeavesValueUnchanged(t *testing.T) {
	db := setupNicknameTestDB(t)
	initI18nOnce(t)

	require.NoError(t, db.Model(&Member{}).Where("user_id = ?", nicknameTestMemberUserID).Update("nickname", "keep").Error)

	ctx, recorder := nicknameContext(t, nicknameTestMemberUserID, updateMemberRequest{Nickname: nil})
	updateMember(ctx)

	require.Equal(t, http.StatusOK, recorder.Code, "body=%s", recorder.Body.String())
	var member Member
	require.NoError(t, db.Where("user_id = ?", nicknameTestMemberUserID).First(&member).Error)
	assert.Equal(t, "keep", member.Nickname, "nil nickname should not clear an existing value")
}

func TestUpdateMember_NotFoundForUnknownUser(t *testing.T) {
	setupNicknameTestDB(t)
	initI18nOnce(t)

	ctx, recorder := nicknameContext(t, 9999, updateMemberRequest{Nickname: ptr("ghost")})
	updateMember(ctx)

	require.Equal(t, http.StatusNotFound, recorder.Code)
	// failureI18n returns the translated message, not the key.
	assert.Contains(t, recorder.Body.String(), i18n.Translate(i18n.LangEn, i18n.MsgEnterpriseMemberNotFound))
}

func TestUpdateMember_InvalidJSON(t *testing.T) {
	setupNicknameTestDB(t)
	initI18nOnce(t)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPut, "/members/2", bytes.NewReader([]byte("not-json")))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = gin.Params{{Key: "uid", Value: "2"}}
	ctx.Set(enterpriseIDContextKey, nicknameTestEnterpriseID)
	updateMember(ctx)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
}

func ptr[T any](v T) *T { return &v }
