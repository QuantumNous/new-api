package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// 企业子账户管理（docs/enterprise-features-design.md 功能C）。
// 所有接口：requireEnterpriseApproved 前置 + handler 内强校验归属（IDOR）。
// 路由层已挂 SubAccountForbidden 防套娃；这里再以 enterprise_status==2 兜底。

// selfDataScope 描述「自身数据」类接口（日志/任务/看板）的有效查询范围。
//   - 普通用户：userId=自己，tokenIds=nil（不过滤），isSubAccount=false；
//   - 子账户：userId=企业主账户 id，username=企业主账户用户名，tokenIds=该子账户已绑定的 key 集合。
//
// 关键安全约束：子账户的 tokenIds 为空集合时，调用方必须短路返回空结果（emptyForSubAccount），
// 绝不能把空集合当作「不过滤」下发给 model 层——否则会泄漏企业主账户的全量数据。
type selfDataScope struct {
	userId       int
	username     string
	tokenIds     []int
	isSubAccount bool
}

// emptyForSubAccount 子账户且无任何绑定 → 应直接返回空结果，不查库。
func (s selfDataScope) emptyForSubAccount() bool {
	return s.isSubAccount && len(s.tokenIds) == 0
}

// resolveSelfDataScope 解析当前请求者的自身数据范围。
func resolveSelfDataScope(c *gin.Context) (selfDataScope, error) {
	userId := c.GetInt("id")
	cache, err := model.GetUserCache(userId)
	if err != nil {
		return selfDataScope{}, err
	}
	if cache.ParentUserId <= 0 {
		return selfDataScope{userId: userId, username: cache.Username}, nil
	}
	parent, err := model.GetUserCache(cache.ParentUserId)
	if err != nil {
		return selfDataScope{}, err
	}
	tokenIds, err := model.GetBoundTokenIdsBySubUser(userId)
	if err != nil {
		return selfDataScope{}, err
	}
	return selfDataScope{
		userId:       cache.ParentUserId,
		username:     parent.Username,
		tokenIds:     tokenIds,
		isSubAccount: true,
	}, nil
}

// GetSubAccounts GET /api/user/sub_account —— 企业自己的子账户列表（含绑定数）。
func GetSubAccounts(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	parentId := c.GetInt("id")
	subs, err := model.GetSubAccountsByParent(parentId)
	if err != nil {
		common.ApiErrorMsg(c, "查询子账户失败")
		return
	}
	counts, err := model.GetBindingCountsByParent(parentId)
	if err != nil {
		common.ApiErrorMsg(c, "查询绑定信息失败")
		return
	}
	lastUsed, err := model.GetLastUsedTimesByParent(parentId)
	if err != nil {
		common.ApiErrorMsg(c, "查询使用时间失败")
		return
	}
	list := make([]dto.SubAccountResponse, 0, len(subs))
	for _, s := range subs {
		list = append(list, dto.SubAccountResponse{
			Id:           s.Id,
			Username:     s.Username,
			DisplayName:  s.DisplayName,
			Status:       s.Status,
			BindingCount: counts[s.Id],
			CreatedAt:    s.CreatedAt,
			LastUsedTime: lastUsed[s.Id],
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     list,
			"max_count": operation_setting.GetSubAccountMaxCount(),
		},
	})
}

// CreateSubAccount POST /api/user/sub_account —— 创建只读子账户。
func CreateSubAccount(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	parentId := c.GetInt("id")

	var req dto.CreateSubAccountRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "请求参数错误")
		return
	}
	req.Username = strings.TrimSpace(req.Username)
	if err := common.Validate.Struct(&req); err != nil {
		common.ApiErrorMsg(c, "用户名或密码格式不正确（用户名≤20位，密码8-20位）")
		return
	}

	// 数量上限预检（友好提示）；model.CreateSubAccount 事务内会再复检防并发越限。
	count, err := model.CountSubAccountsByParent(parentId)
	if err != nil {
		common.ApiErrorMsg(c, "查询子账户数量失败")
		return
	}
	if count >= int64(operation_setting.GetSubAccountMaxCount()) {
		common.ApiErrorMsg(c, "子账户数量已达上限")
		return
	}

	// 用户名全局唯一预检（含软删用户）。
	exist, err := model.CheckUserExistOrDeleted(req.Username, "")
	if err != nil {
		common.ApiErrorMsg(c, "校验用户名失败，请稍后重试")
		return
	}
	if exist {
		common.ApiErrorMsg(c, "该用户名已被占用")
		return
	}

	sub, err := model.CreateSubAccount(parentId, req.Username, req.Password, req.DisplayName)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": dto.SubAccountResponse{
			Id:          sub.Id,
			Username:    sub.Username,
			DisplayName: sub.DisplayName,
			Status:      sub.Status,
			CreatedAt:   sub.CreatedAt,
		},
	})
}

// ResetSubAccountPassword PUT /api/user/sub_account/:id/password
func ResetSubAccountPassword(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	parentId := c.GetInt("id")
	subId, err := strconv.Atoi(c.Param("id"))
	if err != nil || subId <= 0 {
		common.ApiErrorMsg(c, "无效的子账户 id")
		return
	}
	var req dto.ResetSubAccountPasswordRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "请求参数错误")
		return
	}
	if err := common.Validate.Struct(&req); err != nil {
		common.ApiErrorMsg(c, "密码格式不正确（8-20位）")
		return
	}
	// 归属校验：子账户必须隶属当前企业。
	if _, err := model.GetSubAccount(subId, parentId); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ResetSubAccountPassword(subId, req.Password); err != nil {
		common.ApiErrorMsg(c, "重置密码失败")
		return
	}
	common.ApiSuccess(c, nil)
}

// SetSubAccountStatus PUT /api/user/sub_account/:id/status
func SetSubAccountStatus(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	parentId := c.GetInt("id")
	subId, err := strconv.Atoi(c.Param("id"))
	if err != nil || subId <= 0 {
		common.ApiErrorMsg(c, "无效的子账户 id")
		return
	}
	var req dto.SetSubAccountStatusRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "请求参数错误")
		return
	}
	if req.Status != common.UserStatusEnabled && req.Status != common.UserStatusDisabled {
		common.ApiErrorMsg(c, "无效的状态值")
		return
	}
	if _, err := model.GetSubAccount(subId, parentId); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SetSubAccountStatus(subId, req.Status); err != nil {
		common.ApiErrorMsg(c, "更新状态失败")
		return
	}
	common.ApiSuccess(c, nil)
}

// DeleteSubAccount DELETE /api/user/sub_account/:id —— 名下有绑定则拒绝（绑定保护）。
func DeleteSubAccount(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	parentId := c.GetInt("id")
	subId, err := strconv.Atoi(c.Param("id"))
	if err != nil || subId <= 0 {
		common.ApiErrorMsg(c, "无效的子账户 id")
		return
	}
	if err := model.DeleteSubAccount(subId, parentId); err != nil {
		common.ApiError(c, err)
		return
	}
	// 删除后清理该子账户名下令牌缓存（其本无自有令牌，稳妥起见仍清一次用户缓存）。
	_ = model.InvalidateUserCache(subId)
	common.ApiSuccess(c, nil)
}

// GetSubAccountBindings GET /api/user/sub_account/:id/bindings —— 某子账户已绑定的令牌列表。
func GetSubAccountBindings(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	parentId := c.GetInt("id")
	subId, err := strconv.Atoi(c.Param("id"))
	if err != nil || subId <= 0 {
		common.ApiErrorMsg(c, "无效的子账户 id")
		return
	}
	if _, err := model.GetSubAccount(subId, parentId); err != nil {
		common.ApiError(c, err)
		return
	}
	bindings, err := model.GetBindingsBySubUser(subId)
	if err != nil {
		common.ApiErrorMsg(c, "查询绑定信息失败")
		return
	}
	list := make([]dto.SubAccountBindingResponse, 0, len(bindings))
	for _, b := range bindings {
		item := dto.SubAccountBindingResponse{
			Id:        b.Id,
			TokenId:   b.TokenId,
			CreatedAt: b.CreatedAt.Unix(),
		}
		// 令牌仍归属企业主账户；带上名称/明文 key/余额供企业核对与子账户使用（D11/D12）。
		if token, err := model.GetTokenByIds(b.TokenId, parentId); err == nil && token != nil {
			item.TokenName = token.Name
			item.TokenKey = token.Key
			item.RemainQuota = token.RemainQuota
			item.UsedQuota = token.UsedQuota
			item.UnlimitedQuota = token.UnlimitedQuota
			item.Status = token.Status
			item.Group = token.Group
			item.ExpiredTime = token.ExpiredTime
			item.ModelLimitsEnabled = token.ModelLimitsEnabled
			item.ModelLimits = token.ModelLimits
		}
		list = append(list, item)
	}
	common.ApiSuccess(c, list)
}

// BindSubAccountToken POST /api/user/sub_account/:id/bind —— 绑定企业自有 key 给子账户。
func BindSubAccountToken(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	parentId := c.GetInt("id")
	subId, err := strconv.Atoi(c.Param("id"))
	if err != nil || subId <= 0 {
		common.ApiErrorMsg(c, "无效的子账户 id")
		return
	}
	var req dto.SubAccountTokenRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.TokenId <= 0 {
		common.ApiErrorMsg(c, "请求参数错误")
		return
	}
	if err := model.BindTokenToSubAccount(parentId, subId, req.TokenId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// UnbindSubAccountToken POST /api/user/sub_account/:id/unbind
func UnbindSubAccountToken(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	parentId := c.GetInt("id")
	subId, err := strconv.Atoi(c.Param("id"))
	if err != nil || subId <= 0 {
		common.ApiErrorMsg(c, "无效的子账户 id")
		return
	}
	var req dto.SubAccountTokenRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || req.TokenId <= 0 {
		common.ApiErrorMsg(c, "请求参数错误")
		return
	}
	if err := model.UnbindTokenFromSubAccount(parentId, subId, req.TokenId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
