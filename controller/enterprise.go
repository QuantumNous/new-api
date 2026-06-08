package controller

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

// Image size limits and base64 fast-guard are shared with KYC
// (maxImageDecodedBytes / maxImageBase64Len in controller/kyc.go).

// Sentinel errors returned by upsertEnterpriseMaybeImages so handlers can map
// them to i18n keys (reusing the KYC image keys — same semantics).
var (
	errEntImagesIncomplete  = errors.New("enterprise images incomplete")
	errEntImageTooLarge     = errors.New("enterprise image too large")
	errEntImageInvalid      = errors.New("enterprise image invalid")
	errEntImageUploadFailed = errors.New("enterprise image upload failed")
)

// ─── User-side handlers ───────────────────────────────────────────────────────

// GetEnterpriseStatus GET /api/user/enterprise
func GetEnterpriseStatus(c *gin.Context) {
	userId := c.GetInt("id")
	ent, err := model.GetEnterpriseByUserId(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiSuccess(c, dto.EnterpriseStatusResponse{Status: 0})
			return
		}
		common.ApiErrorMsg(c, "获取认证状态失败")
		return
	}
	common.ApiSuccess(c, enterpriseToStatusResponse(ent))
}

// SubmitEnterprise POST /api/user/enterprise
func SubmitEnterprise(c *gin.Context) {
	userId := c.GetInt("id")

	existing, err := model.GetEnterpriseByUserId(userId)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "获取认证状态失败")
		return
	}
	if existing != nil {
		switch existing.Status {
		case model.EnterpriseStatusApproved:
			common.ApiErrorMsg(c, "已通过认证，无需重复提交")
			return
		case model.EnterpriseStatusPending:
			common.ApiErrorMsg(c, "已有待审核记录，请使用修改接口更新")
			return
		}
	}

	ent, err := bindAndUpsertEnterprise(c, userId)
	if err != nil {
		return // bindAndUpsertEnterprise already wrote the response
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "",
		"data":    enterpriseToStatusResponse(ent),
	})
}

// UpdateEnterprise PUT /api/user/enterprise
func UpdateEnterprise(c *gin.Context) {
	userId := c.GetInt("id")

	existing, err := model.GetEnterpriseByUserId(userId)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		common.ApiErrorMsg(c, "获取认证状态失败")
		return
	}

	currentStatus := 0
	if existing != nil {
		currentStatus = existing.Status
	}
	switch currentStatus {
	case 0:
		common.ApiErrorMsg(c, "尚未提交认证，请使用提交接口")
		return
	case model.EnterpriseStatusApproved:
		common.ApiErrorMsg(c, "已通过认证，不允许覆盖")
		return
	}

	ent, err := bindAndUpsertEnterprise(c, userId)
	if err != nil {
		return
	}
	common.ApiSuccess(c, enterpriseToStatusResponse(ent))
}

// DeleteEnterprise DELETE /api/user/enterprise
func DeleteEnterprise(c *gin.Context) {
	userId := c.GetInt("id")

	existing, err := model.GetEnterpriseByUserId(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "无可撤销的认证申请")
			return
		}
		common.ApiErrorMsg(c, "获取认证状态失败")
		return
	}

	switch existing.Status {
	case model.EnterpriseStatusApproved:
		common.ApiErrorMsg(c, "已通过的认证不可撤销，如需变更请联系管理员重置")
		return
	case model.EnterpriseStatusRejected:
		common.ApiErrorMsg(c, "请使用修改接口重新提交，或联系管理员重置")
		return
	}

	_ = model.DeleteEnterpriseImagesByEnterpriseId(existing.Id)

	if err := model.DeleteEnterpriseByUserId(userId); err != nil {
		common.ApiErrorMsg(c, "撤销失败："+err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// ─── Admin-side handlers ──────────────────────────────────────────────────────

// AdminGetEnterpriseList GET /api/user/enterprise/admin?status=1&keyword=xxx&page=1&page_size=20
func AdminGetEnterpriseList(c *gin.Context) {
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

	rows, total, err := model.GetEnterpriseList(status, keyword, page, pageSize)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	items := make([]dto.EnterpriseAdminItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, enterpriseRowToAdminItem(row))
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    items,
		"total":   total,
	})
}

// AdminGetEnterpriseByUser GET /api/user/enterprise/admin/by-user/:user_id
func AdminGetEnterpriseByUser(c *gin.Context) {
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil || userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户 ID")
		return
	}

	ent, err := model.GetEnterpriseByUserId(userId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiSuccess(c, nil)
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}
	common.ApiSuccess(c, enterpriseToAdminItem(ent))
}

// AdminApproveEnterprise PUT /api/user/enterprise/admin/:id/approve
func AdminApproveEnterprise(c *gin.Context) {
	id, err := parseEnterpriseId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	reviewerId := c.GetInt("id")
	if err := model.ApproveEnterprise(id, reviewerId); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminRejectEnterprise PUT /api/user/enterprise/admin/:id/reject
func AdminRejectEnterprise(c *gin.Context) {
	id, err := parseEnterpriseId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	var req dto.EnterpriseRejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	reviewerId := c.GetInt("id")
	if err := model.RejectEnterprise(id, reviewerId, req.Reason); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminResetEnterprise PUT /api/user/enterprise/admin/:id/reset — Admin + Root.
//
// Reset is destructive (hard-delete of row + images), so the original state is
// captured before mutation and a LogTypeManage entry written afterwards — the
// only audit trace once the row is gone.
func AdminResetEnterprise(c *gin.Context) {
	id, err := parseEnterpriseId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	ent, err := model.GetEnterpriseById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "记录不存在")
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	_ = model.DeleteEnterpriseImagesByEnterpriseId(id)

	reviewerId := c.GetInt("id")
	if err := model.ResetEnterprise(id, reviewerId); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	model.RecordLog(reviewerId, model.LogTypeManage,
		fmt.Sprintf("重置用户 %d 的企业认证 [reset] (enterprise_id=%d, 原状态=%d)", ent.UserId, ent.Id, ent.Status))

	common.ApiSuccess(c, nil)
}

// AdminRevealEnterprise GET /api/user/enterprise/admin/:id/reveal — status-aware
func AdminRevealEnterprise(c *gin.Context) {
	id, err := parseEnterpriseId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	ent, err := model.GetEnterpriseById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "记录不存在")
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	if !checkEnterpriseSensitiveAccessPermission(c, ent) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgKycSensitiveAccessDenied),
		})
		return
	}

	uscc, err := common.DecryptIDNumber(ent.UsccEnc)
	if err != nil {
		common.ApiErrorMsg(c, "解密失败："+err.Error())
		return
	}
	legalRepId, err := common.DecryptIDNumber(ent.LegalRepIdEnc)
	if err != nil {
		common.ApiErrorMsg(c, "解密失败："+err.Error())
		return
	}

	adminId := c.GetInt("id")
	model.RecordLog(adminId, model.LogTypeManage,
		fmt.Sprintf("查看用户 %d 企业认证敏感信息 [reveal] (enterprise_id=%d)", ent.UserId, ent.Id))

	common.ApiSuccess(c, dto.EnterpriseRevealResponse{
		CompanyName:  ent.CompanyName,
		Uscc:         uscc,
		LegalRepName: ent.LegalRepName,
		LegalRepId:   legalRepId,
	})
}

// AdminGetEnterpriseImages GET /api/user/enterprise/admin/:id/images — status-aware
func AdminGetEnterpriseImages(c *gin.Context) {
	id, err := parseEnterpriseId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	ent, err := model.GetEnterpriseById(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "记录不存在")
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	if !checkEnterpriseSensitiveAccessPermission(c, ent) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": common.TranslateMessage(c, i18n.MsgKycSensitiveAccessDenied),
		})
		return
	}

	img, err := model.GetEnterpriseImages(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorI18n(c, i18n.MsgKycImagesNotFound)
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	license, err := common.DecryptIDNumber(img.LicenseEnc)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgKycImageInvalid)
		return
	}
	legalFront, err := common.DecryptIDNumber(img.LegalFrontEnc)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgKycImageInvalid)
		return
	}
	legalBack, err := common.DecryptIDNumber(img.LegalBackEnc)
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgKycImageInvalid)
		return
	}

	adminId := c.GetInt("id")
	model.RecordLog(adminId, model.LogTypeManage,
		fmt.Sprintf("查看用户 %d 企业认证敏感信息 [images] (enterprise_id=%d)", ent.UserId, ent.Id))

	common.ApiSuccess(c, dto.EnterpriseImagesResponse{
		LicenseImage:    "data:image/jpeg;base64," + license,
		LegalFrontImage: "data:image/jpeg;base64," + legalFront,
		LegalBackImage:  "data:image/jpeg;base64," + legalBack,
	})
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// checkEnterpriseSensitiveAccessPermission enforces status-aware access:
//   - pending/rejected: Admin (role≥10) + Root can view
//   - approved: Root only
func checkEnterpriseSensitiveAccessPermission(c *gin.Context, ent *model.UserEnterprise) bool {
	role := c.GetInt("role")
	if ent.Status == model.EnterpriseStatusApproved {
		return role == common.RoleRootUser
	}
	return role >= common.RoleAdminUser
}

// bindAndUpsertEnterprise binds the request, encrypts sensitive fields, runs the
// upsert (with images when present), and writes an error response on failure.
// On error it returns a non-nil error so callers just `return`.
func bindAndUpsertEnterprise(c *gin.Context, userId int) (*model.UserEnterprise, error) {
	var req dto.EnterpriseSubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return nil, err
	}

	// USCCs are case-insensitive (uppercase letters only by spec). Normalize
	// before encrypt+hash so a lowercase direct-API submission dedups against
	// the uppercase value the frontend sends for the same enterprise.
	uscc := strings.ToUpper(strings.TrimSpace(req.Uscc))

	usccEnc, err := common.EncryptIDNumber(uscc)
	if err != nil {
		common.ApiErrorMsg(c, "加密失败")
		return nil, err
	}
	usccHash, err := common.HMACIDNumber(uscc)
	if err != nil {
		common.ApiErrorMsg(c, "哈希计算失败")
		return nil, err
	}
	legalRepIdEnc, err := common.EncryptIDNumber(req.LegalRepId)
	if err != nil {
		common.ApiErrorMsg(c, "加密失败")
		return nil, err
	}

	fields := model.EnterpriseFields{
		CompanyName:   req.CompanyName,
		UsccEnc:       usccEnc,
		UsccHash:      usccHash,
		LegalRepName:  req.LegalRepName,
		LegalRepIdEnc: legalRepIdEnc,
		ContactName:   req.ContactName,
		ContactPhone:  req.ContactPhone,
	}

	ent, err := upsertEnterpriseImages(userId, req, fields)
	if err != nil {
		if key := mapEnterpriseImageError(err); key != "" {
			common.ApiErrorI18n(c, key)
			return nil, err
		}
		if errors.Is(err, model.ErrEnterpriseDuplicateUscc) || errors.Is(err, model.ErrEnterpriseSubmitLimitExceeded) {
			common.ApiErrorMsg(c, err.Error())
			return nil, err
		}
		common.ApiErrorMsg(c, "提交失败："+err.Error())
		return nil, err
	}
	return ent, nil
}

// upsertEnterpriseImages validates and encrypts the three mandatory images,
// then runs the transactional upsert. Unlike KYC (whose images were added later
// and stayed optional for backward compatibility), enterprise certification is
// a new feature with no legacy API callers — the business license and both
// legal-rep ID photos are always required, so a submission missing any of them
// is rejected with errEntImagesIncomplete (this also blocks image-less approval
// via direct API calls).
func upsertEnterpriseImages(userId int, req dto.EnterpriseSubmitRequest, fields model.EnterpriseFields) (*model.UserEnterprise, error) {
	imgs := []string{req.License, req.LegalFront, req.LegalBack}
	for _, s := range imgs {
		if s == "" {
			return nil, errEntImagesIncomplete
		}
	}

	encs := make([]string, len(imgs))
	for i, s := range imgs {
		if len(s) > maxImageBase64Len {
			return nil, errEntImageTooLarge
		}
		decoded, err := base64.StdEncoding.DecodeString(s)
		if err != nil {
			return nil, errEntImageInvalid
		}
		if len(decoded) > maxImageDecodedBytes {
			return nil, errEntImageTooLarge
		}
		enc, err := common.EncryptIDNumber(s)
		if err != nil {
			return nil, errEntImageUploadFailed
		}
		encs[i] = enc
	}

	return model.UpsertEnterpriseWithImages(userId, fields, encs[0], encs[1], encs[2])
}

// mapEnterpriseImageError maps an image sentinel to an i18n key (reusing the KYC
// image keys — same wording applies). Returns "" if not an image sentinel.
func mapEnterpriseImageError(err error) string {
	switch {
	case errors.Is(err, errEntImagesIncomplete):
		return i18n.MsgKycImagesIncomplete
	case errors.Is(err, errEntImageTooLarge):
		return i18n.MsgKycImageTooLarge
	case errors.Is(err, errEntImageInvalid):
		return i18n.MsgKycImageInvalid
	case errors.Is(err, errEntImageUploadFailed):
		return i18n.MsgKycImageUploadFailed
	}
	return ""
}

func parseEnterpriseId(c *gin.Context) (int, error) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("无效的企业认证 ID")
	}
	return id, nil
}

func enterpriseToStatusResponse(ent *model.UserEnterprise) dto.EnterpriseStatusResponse {
	uscc, _ := common.DecryptIDNumber(ent.UsccEnc)
	return dto.EnterpriseStatusResponse{
		Status:       ent.Status,
		CompanyName:  ent.CompanyName,
		UsccMasked:   common.MaskIDNumber(uscc),
		LegalRepName: ent.LegalRepName,
		ContactName:  ent.ContactName,
		ContactPhone: common.MaskIDNumber(ent.ContactPhone),
		RejectReason: ent.RejectReason,
		SubmitCount:  ent.SubmitCount,
		SubmittedAt:  ent.SubmittedAt,
		VerifiedAt:   ent.VerifiedAt,
	}
}

func enterpriseToAdminItem(ent *model.UserEnterprise) dto.EnterpriseAdminItem {
	uscc, _ := common.DecryptIDNumber(ent.UsccEnc)

	username := ""
	if user, err := model.GetUserById(ent.UserId, false); err == nil && user != nil {
		username = user.Username
	}
	reviewerName := ""
	if ent.ReviewedBy > 0 {
		if reviewer, err := model.GetUserById(ent.ReviewedBy, false); err == nil && reviewer != nil {
			reviewerName = reviewer.Username
		}
	}
	return buildEnterpriseAdminItem(ent, uscc, username, reviewerName)
}

func enterpriseRowToAdminItem(row *model.EnterpriseAdminRow) dto.EnterpriseAdminItem {
	uscc, _ := common.DecryptIDNumber(row.UsccEnc)
	return buildEnterpriseAdminItem(&row.UserEnterprise, uscc, row.Username, row.ReviewerName)
}

func buildEnterpriseAdminItem(ent *model.UserEnterprise, uscc, username, reviewerName string) dto.EnterpriseAdminItem {
	return dto.EnterpriseAdminItem{
		Id:           ent.Id,
		UserId:       ent.UserId,
		Username:     username,
		CompanyName:  ent.CompanyName,
		UsccMasked:   common.MaskIDNumber(uscc),
		LegalRepName: ent.LegalRepName,
		ContactName:  ent.ContactName,
		ContactPhone: common.MaskIDNumber(ent.ContactPhone),
		SubmitCount:  ent.SubmitCount,
		Status:       ent.Status,
		RejectReason: ent.RejectReason,
		ReviewedBy:   ent.ReviewedBy,
		ReviewerName: reviewerName,
		HasImages:    model.HasEnterpriseImages(ent.Id),
		SubmittedAt:  ent.SubmittedAt,
		VerifiedAt:   ent.VerifiedAt,
	}
}
