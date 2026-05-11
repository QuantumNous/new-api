package controller

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

// Image size limits: 5 MB decoded binary. The base64 fast-guard (~6.7 MB) keeps
// us from decoding obviously oversized payloads at all.
const (
	maxImageDecodedBytes = 5 * 1024 * 1024
	maxImageBase64Len    = 7 * 1024 * 1024
)

// Sentinel errors returned by upsertKYCMaybeImages so handlers can map them to
// i18n keys without leaking raw strings.
var (
	errKYCImagesIncomplete  = errors.New("kyc images incomplete")
	errKYCImageTooLarge     = errors.New("kyc image too large")
	errKYCImageInvalid      = errors.New("kyc image invalid")
	errKYCImageUploadFailed = errors.New("kyc image upload failed")
)

// ─── User-side handlers ───────────────────────────────────────────────────────

// GetKYCStatus GET /api/user/kyc
func GetKYCStatus(c *gin.Context) {
	userId := c.GetInt("id")
	kyc, err := model.GetKYCByUserId(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiSuccess(c, dto.KYCStatusResponse{Status: 0})
			return
		}
		common.ApiErrorMsg(c, "获取认证状态失败")
		return
	}

	plain, _ := common.DecryptIDNumber(kyc.IdNumberEnc)
	resp := dto.KYCStatusResponse{
		Status:         kyc.Status,
		RealName:       kyc.RealName,
		IdType:         kyc.IdType,
		IdNumberMasked: common.MaskIDNumber(plain),
		RejectReason:   kyc.RejectReason,
		SubmitCount:    kyc.SubmitCount,
		SubmittedAt:    kyc.SubmittedAt,
		VerifiedAt:     kyc.VerifiedAt,
	}
	common.ApiSuccess(c, resp)
}

// SubmitKYC POST /api/user/kyc
func SubmitKYC(c *gin.Context) {
	userId := c.GetInt("id")

	existingKyc, err := model.GetKYCByUserId(userId)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "获取认证状态失败")
		return
	}
	if existingKyc != nil {
		switch existingKyc.Status {
		case model.KYCStatusApproved:
			common.ApiErrorMsg(c, "已通过认证，无需重复提交")
			return
		case model.KYCStatusPending:
			common.ApiErrorMsg(c, "已有待审核记录，请使用修改接口更新")
			return
		}
	}

	var req dto.KYCSubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}

	enc, err := common.EncryptIDNumber(req.IdNumber)
	if err != nil {
		common.ApiErrorMsg(c, "加密失败")
		return
	}
	hash, err := common.HMACIDNumber(req.IdNumber)
	if err != nil {
		common.ApiErrorMsg(c, "哈希计算失败")
		return
	}

	kyc, err := upsertKYCMaybeImages(userId, req, enc, hash)
	if err != nil {
		if key := mapKYCImageError(err); key != "" {
			common.ApiErrorI18n(c, key)
			return
		}
		if errors.Is(err, model.ErrKYCDuplicateID) || errors.Is(err, model.ErrKYCSubmitLimitExceeded) {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		common.ApiErrorMsg(c, "提交失败："+err.Error())
		return
	}

	plain, _ := common.DecryptIDNumber(kyc.IdNumberEnc)
	resp := dto.KYCStatusResponse{
		Status:         kyc.Status,
		RealName:       kyc.RealName,
		IdType:         kyc.IdType,
		IdNumberMasked: common.MaskIDNumber(plain),
		SubmitCount:    kyc.SubmitCount,
		SubmittedAt:    kyc.SubmittedAt,
	}
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "",
		"data":    resp,
	})
}

// UpdateKYC PUT /api/user/kyc
func UpdateKYC(c *gin.Context) {
	userId := c.GetInt("id")

	existingKyc, err := model.GetKYCByUserId(userId)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "获取认证状态失败")
		return
	}

	currentStatus := 0
	if existingKyc != nil {
		currentStatus = existingKyc.Status
	}

	switch currentStatus {
	case 0:
		common.ApiErrorMsg(c, "尚未提交认证，请使用提交接口")
		return
	case model.KYCStatusApproved:
		common.ApiErrorMsg(c, "已通过认证，不允许覆盖")
		return
	}

	var req dto.KYCSubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}

	enc, err := common.EncryptIDNumber(req.IdNumber)
	if err != nil {
		common.ApiErrorMsg(c, "加密失败")
		return
	}
	hash, err := common.HMACIDNumber(req.IdNumber)
	if err != nil {
		common.ApiErrorMsg(c, "哈希计算失败")
		return
	}

	kyc, err := upsertKYCMaybeImages(userId, req, enc, hash)
	if err != nil {
		if key := mapKYCImageError(err); key != "" {
			common.ApiErrorI18n(c, key)
			return
		}
		if errors.Is(err, model.ErrKYCDuplicateID) || errors.Is(err, model.ErrKYCSubmitLimitExceeded) {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		common.ApiErrorMsg(c, "更新失败："+err.Error())
		return
	}

	plain, _ := common.DecryptIDNumber(kyc.IdNumberEnc)
	resp := dto.KYCStatusResponse{
		Status:         kyc.Status,
		RealName:       kyc.RealName,
		IdType:         kyc.IdType,
		IdNumberMasked: common.MaskIDNumber(plain),
		SubmitCount:    kyc.SubmitCount,
		SubmittedAt:    kyc.SubmittedAt,
	}
	common.ApiSuccess(c, resp)
}

// DeleteKYC DELETE /api/user/kyc
func DeleteKYC(c *gin.Context) {
	userId := c.GetInt("id")

	existingKyc, err := model.GetKYCByUserId(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "无可撤销的认证申请")
			return
		}
		common.ApiErrorMsg(c, "获取认证状态失败")
		return
	}

	switch existingKyc.Status {
	case model.KYCStatusApproved:
		common.ApiErrorMsg(c, "已通过的认证不可撤销，如需变更请联系管理员重置")
		return
	case model.KYCStatusRejected:
		common.ApiErrorMsg(c, "请使用修改接口重新提交，或联系管理员重置")
		return
	}

	// Delete images before soft-deleting KYC record (revoke upload authorization)
	_ = model.DeleteKYCImagesByKYCId(existingKyc.Id)

	if err := model.DeleteKYCByUserId(userId); err != nil {
		common.ApiErrorMsg(c, "撤销失败："+err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// ─── Admin-side handlers ──────────────────────────────────────────────────────

// AdminGetKYCList GET /api/user/kyc/admin?status=1&keyword=xxx&page=1&page_size=20
func AdminGetKYCList(c *gin.Context) {
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	rows, total, err := model.GetKYCList(status, keyword, page, pageSize)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	items := make([]dto.KYCAdminItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, kycRowToAdminItem(row))
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    items,
		"total":   total,
	})
}

// AdminGetKYCByUser GET /api/user/kyc/admin/by-user/:user_id
func AdminGetKYCByUser(c *gin.Context) {
	userIdStr := c.Param("user_id")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户 ID")
		return
	}

	kyc, err := model.GetKYCByUserId(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiSuccess(c, nil)
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	item := kycToAdminItem(kyc)
	common.ApiSuccess(c, item)
}

// AdminApproveKYC PUT /api/user/kyc/admin/:id/approve
func AdminApproveKYC(c *gin.Context) {
	id, err := parseKYCId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	reviewerId := c.GetInt("id")
	if err := model.ApproveKYC(id, reviewerId); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminRejectKYC PUT /api/user/kyc/admin/:id/reject
func AdminRejectKYC(c *gin.Context) {
	id, err := parseKYCId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	var req dto.KYCRejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	reviewerId := c.GetInt("id")
	if err := model.RejectKYC(id, reviewerId, req.Reason); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminResetKYC PUT /api/user/kyc/admin/:id/reset — Admin + Root
//
// Reset is destructive: the user_kycs row is hard-deleted and images are
// hard-deleted, so we capture the original state BEFORE mutation and write a
// LogTypeManage entry afterwards. This is the only audit trace of a reset
// (the row itself no longer exists to inspect).
func AdminResetKYC(c *gin.Context) {
	id, err := parseKYCId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	kyc, err := model.GetKYCById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "记录不存在")
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	_ = model.DeleteKYCImagesByKYCId(id)

	reviewerId := c.GetInt("id")
	if err := model.ResetKYC(id, reviewerId); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	model.RecordLog(reviewerId, model.LogTypeManage,
		fmt.Sprintf("重置用户 %d 的 KYC [reset] (kyc_id=%d, 原状态=%d)", kyc.UserId, kyc.Id, kyc.Status))

	common.ApiSuccess(c, nil)
}

// AdminRevealKYC GET /api/user/kyc/admin/:id/reveal — status-aware permission
func AdminRevealKYC(c *gin.Context) {
	id, err := parseKYCId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	kyc, err := model.GetKYCById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "记录不存在")
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	if !checkSensitiveAccessPermission(c, kyc) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgKycSensitiveAccessDenied),
		})
		return
	}

	plain, err := common.DecryptIDNumber(kyc.IdNumberEnc)
	if err != nil {
		common.ApiErrorMsg(c, "解密失败："+err.Error())
		return
	}

	adminId := c.GetInt("id")
	model.RecordLog(adminId, model.LogTypeManage,
		fmt.Sprintf("查看用户 %d KYC 敏感信息 [reveal] (kyc_id=%d)", kyc.UserId, kyc.Id))

	common.ApiSuccess(c, dto.KYCRevealResponse{
		RealName: kyc.RealName,
		IdType:   kyc.IdType,
		IdNumber: plain,
	})
}

// AdminGetKYCImages GET /api/user/kyc/admin/:id/images — status-aware permission
func AdminGetKYCImages(c *gin.Context) {
	id, err := parseKYCId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	kyc, err := model.GetKYCById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "记录不存在")
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	if !checkSensitiveAccessPermission(c, kyc) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgKycSensitiveAccessDenied),
		})
		return
	}

	img, err := model.GetKYCImages(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorI18n(c, i18n.MsgKycImagesNotFound)
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	frontPlain, err := common.DecryptIDNumber(img.FrontEnc)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgKycImageInvalid)
		return
	}
	backPlain, err := common.DecryptIDNumber(img.BackEnc)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgKycImageInvalid)
		return
	}

	adminId := c.GetInt("id")
	model.RecordLog(adminId, model.LogTypeManage,
		fmt.Sprintf("查看用户 %d KYC 敏感信息 [images] (kyc_id=%d)", kyc.UserId, kyc.Id))

	common.ApiSuccess(c, dto.KYCImagesResponse{
		FrontImage: "data:image/jpeg;base64," + frontPlain,
		BackImage:  "data:image/jpeg;base64," + backPlain,
	})
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// checkSensitiveAccessPermission enforces status-aware access:
//   - pending/rejected: Admin (role≥10) + Root can view
//   - approved: Root only
//
// role is read from the literal "role" key written by adminRoute's authHelper.
func checkSensitiveAccessPermission(c *gin.Context, kyc *model.UserKYC) bool {
	role := c.GetInt("role")
	if kyc.Status == model.KYCStatusApproved {
		return role == common.RoleRootUser
	}
	return role >= common.RoleAdminUser
}

// upsertKYCMaybeImages decides whether to use the transactional image upsert.
// - Both images present: UpsertKYCWithImages (atomic transaction)
// - One image missing: errKYCImagesIncomplete (front and back must be submitted together)
// - Neither image: UpsertKYC (backward-compatible, no images)
//
// Returns sentinel errors so the caller can map to i18n keys.
func upsertKYCMaybeImages(userId int, req dto.KYCSubmitRequest, enc, hash string) (*model.UserKYC, error) {
	hasFront := req.IdCardFront != ""
	hasBack := req.IdCardBack != ""

	if hasFront != hasBack {
		return nil, errKYCImagesIncomplete
	}

	if !hasFront {
		return model.UpsertKYC(userId, req.RealName, req.IdType, enc, hash)
	}

	// Fast guard before decode.
	if len(req.IdCardFront) > maxImageBase64Len || len(req.IdCardBack) > maxImageBase64Len {
		return nil, errKYCImageTooLarge
	}

	// Strict check: base64 must decode and decoded payload ≤ 5MB.
	frontBytes, err := base64.StdEncoding.DecodeString(req.IdCardFront)
	if err != nil {
		return nil, errKYCImageInvalid
	}
	backBytes, err := base64.StdEncoding.DecodeString(req.IdCardBack)
	if err != nil {
		return nil, errKYCImageInvalid
	}
	if len(frontBytes) > maxImageDecodedBytes || len(backBytes) > maxImageDecodedBytes {
		return nil, errKYCImageTooLarge
	}

	frontEnc, err := common.EncryptIDNumber(req.IdCardFront)
	if err != nil {
		return nil, errKYCImageUploadFailed
	}
	backEnc, err := common.EncryptIDNumber(req.IdCardBack)
	if err != nil {
		return nil, errKYCImageUploadFailed
	}

	return model.UpsertKYCWithImages(userId, req.RealName, req.IdType, enc, hash, frontEnc, backEnc)
}

// mapKYCImageError maps an image-related sentinel error to an i18n key.
// Returns "" if err is not an image sentinel.
func mapKYCImageError(err error) string {
	switch {
	case errors.Is(err, errKYCImagesIncomplete):
		return i18n.MsgKycImagesIncomplete
	case errors.Is(err, errKYCImageTooLarge):
		return i18n.MsgKycImageTooLarge
	case errors.Is(err, errKYCImageInvalid):
		return i18n.MsgKycImageInvalid
	case errors.Is(err, errKYCImageUploadFailed):
		return i18n.MsgKycImageUploadFailed
	}
	return ""
}

func parseKYCId(c *gin.Context) (int, error) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("无效的 KYC ID")
	}
	return id, nil
}

// kycToAdminItem builds the admin DTO for a single record (e.g. by-user lookup).
func kycToAdminItem(kyc *model.UserKYC) dto.KYCAdminItem {
	plain, _ := common.DecryptIDNumber(kyc.IdNumberEnc)

	username := ""
	if user, err := model.GetUserById(kyc.UserId, false); err == nil && user != nil {
		username = user.Username
	}

	reviewerName := ""
	if kyc.ReviewedBy > 0 {
		if reviewer, err := model.GetUserById(kyc.ReviewedBy, false); err == nil && reviewer != nil {
			reviewerName = reviewer.Username
		}
	}

	return buildAdminItem(kyc, plain, username, reviewerName)
}

// kycRowToAdminItem builds the admin DTO from a JOINed list row.
func kycRowToAdminItem(row *model.KYCAdminRow) dto.KYCAdminItem {
	plain, _ := common.DecryptIDNumber(row.IdNumberEnc)
	return buildAdminItem(&row.UserKYC, plain, row.Username, row.ReviewerName)
}

func buildAdminItem(kyc *model.UserKYC, plain, username, reviewerName string) dto.KYCAdminItem {
	return dto.KYCAdminItem{
		Id:             kyc.Id,
		UserId:         kyc.UserId,
		Username:       username,
		RealName:       kyc.RealName,
		IdType:         kyc.IdType,
		IdNumberMasked: common.MaskIDNumber(plain),
		SubmitCount:    kyc.SubmitCount,
		Status:         kyc.Status,
		RejectReason:   kyc.RejectReason,
		ReviewedBy:     kyc.ReviewedBy,
		ReviewerName:   reviewerName,
		HasImages:      model.HasKYCImages(kyc.Id),
		SubmittedAt:    kyc.SubmittedAt,
		VerifiedAt:     kyc.VerifiedAt,
	}
}
