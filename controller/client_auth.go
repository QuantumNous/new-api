package controller

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// ClientLoginRequest 客户端 SMS 登录请求
// 安全考虑:
//   - 通过 CriticalRateLimit + SmsRateLimit 限速，防止暴力破解和短信轰炸
//   - 验证码一次性使用，校验后立即删除
//   - 自动注册需要全局开关 RegisterEnabled 启用
//   - Token 名称固定，同一用户多次登录复用同一个 Token，不重复生成
//   - 完整 Key 仅在登录响应中返回一次，落盘时由客户端自行加密
//   - 不返回 session_token / cookie，客户端只持有 API Key
type ClientLoginRequest struct {
	Phone    string `json:"phone"`
	Code     string `json:"code"`
	ClientId string `json:"client_id,omitempty"`
}

// ClientLoginResponseData 登录响应数据
type ClientLoginResponseData struct {
	User   ClientUserInfo `json:"user"`
	ApiKey string         `json:"api_key"`
}

// ClientUserInfo 返回给客户端的用户信息（精简版，不含敏感字段）
type ClientUserInfo struct {
	Id           int    `json:"id"`
	Phone        string `json:"phone"`
	Quota        int    `json:"quota"`
	UsedQuota    int    `json:"used_quota"`
	RequestCount int    `json:"request_count"`
}

// 客户端 Token 的固定名称，每个用户唯一
const clientTokenName = "MyClaw Client"

// ClientSmsLogin 客户端手机验证码登录（自动注册 + 自动创建/复用 Token）
//
// POST /api/client/login_sms
// 请求体: { phone, code, client_id? }
// 响应: { success, data: { user, api_key } }
//
// 与 SmsLogin 的区别:
//   - 不创建 cookie session（客户端不需要）
//   - 自动确保用户拥有一个名为 "MyClaw Client" 的 Token，并返回完整 Key
//   - 不支持 2FA 流程（客户端登录场景简化）
func ClientSmsLogin(c *gin.Context) {
	// 1. 检查 SMS 功能是否启用
	smsSettings := system_setting.GetSmsSettings()
	if !smsSettings.Enabled {
		common.ApiErrorI18n(c, i18n.MsgSmsLoginDisabled)
		return
	}

	// 2. 解析请求
	var req ClientLoginRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	if req.Phone == "" {
		common.ApiErrorI18n(c, i18n.MsgSmsPhoneRequired)
		return
	}
	if req.Code == "" {
		common.ApiErrorI18n(c, i18n.MsgSmsCodeRequired)
		return
	}
	if !phoneRegex.MatchString(req.Phone) {
		common.ApiErrorI18n(c, i18n.MsgSmsPhoneInvalid)
		return
	}

	// 3. 验证短信验证码（验证后立即删除，防重放）
	if !common.VerifyCodeWithKey(req.Phone, req.Code, common.SmsVerificationPurpose) {
		common.ApiErrorI18n(c, i18n.MsgSmsVerificationCodeErr)
		return
	}
	common.DeleteKey(req.Phone, common.SmsVerificationPurpose)

	// 4. 查找用户，若不存在则自动注册
	user := model.User{Phone: req.Phone}
	err := user.FillUserByPhone()
	if err != nil || user.Id == 0 {
		// 必须开启注册功能，防止恶意注册
		if !common.RegisterEnabled {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterDisabled)
			return
		}

		nextId := model.GetMaxUserId() + 1
		username := fmt.Sprintf("sms_%d", nextId)
		displayName := maskPhone(req.Phone)

		randPassword, perr := common.GenerateKey()
		if perr != nil {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
			return
		}

		newUser := model.User{
			Username:    username,
			Password:    randPassword,
			DisplayName: displayName,
			Phone:       req.Phone,
			Role:        common.RoleCommonUser,
		}

		if perr := newUser.Insert(0); perr != nil {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
			return
		}

		// 重新加载用户以拿到 Id
		user = model.User{Phone: req.Phone}
		if err := user.FillUserByPhone(); err != nil || user.Id == 0 {
			common.ApiErrorI18n(c, i18n.MsgUserRegisterFailed)
			return
		}
	}

	// 5. 状态校验
	if user.Status != common.UserStatusEnabled {
		common.ApiErrorI18n(c, i18n.MsgUserDisabled)
		return
	}

	// 6. 查找或创建客户端专用 Token
	apiKey, err := ensureClientToken(user.Id, user.Username)
	if err != nil {
		common.SysLog("ClientSmsLogin: failed to ensure client token: " + err.Error())
		common.ApiErrorMsg(c, "创建客户端令牌失败")
		return
	}

	// 7. 记录登录日志（便于审计异常登录）
	model.RecordLog(user.Id, model.LogTypeManage,
		fmt.Sprintf("客户端登录: phone=%s client_id=%s ip=%s",
			maskPhone(req.Phone), req.ClientId, c.ClientIP()))

	// 8. 返回结果（一次性返回 Key，客户端必须妥善保存）
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": ClientLoginResponseData{
			User: ClientUserInfo{
				Id:           user.Id,
				Phone:        user.Phone,
				Quota:        user.Quota,
				UsedQuota:    user.UsedQuota,
				RequestCount: user.RequestCount,
			},
			ApiKey: "sk-" + apiKey,
		},
	})
}

// ensureClientToken 查找或创建用户的客户端专用 Token，返回完整 Key（不带 sk- 前缀）
//
// 安全考虑:
//   - 同一用户只创建一个名为 clientTokenName 的 Token
//   - Token 不限额度（依赖用户级别配额控制）
//   - Token Key 仅在创建时返回；后续登录从数据库读取（数据库存的是明文，与现有逻辑一致）
func ensureClientToken(userId int, username string) (string, error) {
	// 先尝试查找已有的客户端 Token
	var existing model.Token
	err := model.DB.Where("user_id = ? AND name = ?", userId, clientTokenName).First(&existing).Error
	if err == nil {
		// 已存在，直接返回 Key
		return existing.Key, nil
	}

	// 不存在则创建
	key, err := common.GenerateKey()
	if err != nil {
		return "", err
	}

	token := model.Token{
		UserId:             userId,
		Name:               clientTokenName,
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        -1,
		RemainQuota:        0,
		UnlimitedQuota:     true, // 依赖用户级别 quota 控制，避免单独维护 token 额度
		ModelLimitsEnabled: false,
	}
	if setting.DefaultUseAutoGroup {
		token.Group = "auto"
	}

	if err := token.Insert(); err != nil {
		return "", err
	}

	// 保留 constant 引用避免 import 被优化掉（如未来需要根据 GenerateDefaultToken 开关控制）
	_ = constant.GenerateDefaultToken

	return token.Key, nil
}

// ClientGetSelf 客户端获取自己的用户信息（基于 API Key 鉴权）
//
// GET /api/client/self
// Header: Authorization: Bearer sk-xxx
//
// 通过 TokenAuth 中间件验证 API Key，从 context 取出 user_id 加载完整信息
func ClientGetSelf(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "未授权")
		return
	}

	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": ClientUserInfo{
			Id:           user.Id,
			Phone:        user.Phone,
			Quota:        user.Quota,
			UsedQuota:    user.UsedQuota,
			RequestCount: user.RequestCount,
		},
	})
}
