package controller

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/go-fuego/fuego"
)

func Setup2FA(c fuego.ContextNoBody) (*dto.Response[dto.Setup2FAResponse], error) {
	userId := dto.UserID(c)

	// 检查用户是否已经启用2FA
	existing, err := model.GetTwoFAByUserId(userId)
	if err != nil {
		return dto.Fail[dto.Setup2FAResponse](err.Error())
	}
	if existing != nil && existing.IsEnabled {
		return dto.Fail[dto.Setup2FAResponse]("用户已启用2FA，请先禁用后重新设置")
	}

	// 如果存在已禁用的2FA记录，先删除它
	if existing != nil && !existing.IsEnabled {
		if err := existing.Delete(); err != nil {
			return dto.Fail[dto.Setup2FAResponse](err.Error())
		}
		existing = nil // 重置为nil，后续将创建新记录
	}

	// 获取用户信息
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return dto.Fail[dto.Setup2FAResponse](err.Error())
	}

	// 生成TOTP密钥
	key, err := common.GenerateTOTPSecret(user.Username)
	if err != nil {
		common.SysLog("生成TOTP密钥失败: " + err.Error())
		return dto.Fail[dto.Setup2FAResponse]("生成2FA密钥失败")
	}

	// 生成备用码
	backupCodes, err := common.GenerateBackupCodes()
	if err != nil {
		common.SysLog("生成备用码失败: " + err.Error())
		return dto.Fail[dto.Setup2FAResponse]("生成备用码失败")
	}

	// 生成二维码数据
	qrCodeData := common.GenerateQRCodeData(key.Secret(), user.Username)

	// 创建或更新2FA记录（暂未启用）
	twoFA := &model.TwoFA{
		UserId:    userId,
		Secret:    key.Secret(),
		IsEnabled: false,
	}

	if existing != nil {
		// 更新现有记录
		twoFA.Id = existing.Id
		err = twoFA.Update()
	} else {
		// 创建新记录
		err = twoFA.Create()
	}

	if err != nil {
		return dto.Fail[dto.Setup2FAResponse](err.Error())
	}

	// 创建备用码记录
	if err := model.CreateBackupCodes(userId, backupCodes); err != nil {
		common.SysLog("保存备用码失败: " + err.Error())
		return dto.Fail[dto.Setup2FAResponse]("保存备用码失败")
	}

	// 记录操作日志
	model.RecordLog(userId, model.LogTypeSystem, "开始设置两步验证")

	return dto.OkMsg("2FA设置初始化成功，请使用认证器扫描二维码并输入验证码完成设置", dto.Setup2FAResponse{
		Secret:      key.Secret(),
		QRCodeData:  qrCodeData,
		BackupCodes: backupCodes,
	})
}

func Enable2FA(c fuego.ContextWithBody[dto.Setup2FARequest]) (dto.MessageResponse, error) {
	req, err := c.Body()
	if err != nil {
		return dto.FailMsg("参数错误")
	}

	userId := dto.UserID(c)

	// 获取2FA记录
	twoFA, err := model.GetTwoFAByUserId(userId)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if twoFA == nil {
		return dto.FailMsg("请先完成2FA初始化设置")
	}
	if twoFA.IsEnabled {
		return dto.FailMsg("2FA已经启用")
	}

	// 验证TOTP验证码
	cleanCode, err := common.ValidateNumericCode(req.Code)
	if err != nil {
		return dto.FailMsg(err.Error())
	}

	if !common.ValidateTOTPCode(twoFA.Secret, cleanCode) {
		return dto.FailMsg("验证码或备用码错误，请重试")
	}

	// 启用2FA
	if err := twoFA.Enable(); err != nil {
		return dto.FailMsg(err.Error())
	}

	// 记录操作日志
	model.RecordLog(userId, model.LogTypeSystem, "成功启用两步验证")

	return dto.Msg("两步验证启用成功")
}

func Disable2FA(c fuego.ContextWithBody[dto.Verify2FARequest]) (dto.MessageResponse, error) {
	req, err := c.Body()
	if err != nil {
		return dto.FailMsg("参数错误")
	}

	userId := dto.UserID(c)

	// 获取2FA记录
	twoFA, err := model.GetTwoFAByUserId(userId)
	if err != nil {
		return dto.FailMsg(err.Error())
	}
	if twoFA == nil || !twoFA.IsEnabled {
		return dto.FailMsg("用户未启用2FA")
	}

	// 验证TOTP验证码或备用码
	cleanCode, err := common.ValidateNumericCode(req.Code)
	isValidTOTP := false
	isValidBackup := false

	if err == nil {
		// 尝试验证TOTP
		isValidTOTP, _ = twoFA.ValidateTOTPAndUpdateUsage(cleanCode)
	}

	if !isValidTOTP {
		// 尝试验证备用码
		isValidBackup, err = twoFA.ValidateBackupCodeAndUpdateUsage(req.Code)
		if err != nil {
			return dto.FailMsg(err.Error())
		}
	}

	if !isValidTOTP && !isValidBackup {
		return dto.FailMsg("验证码或备用码错误，请重试")
	}

	// 禁用2FA
	if err := model.DisableTwoFA(userId); err != nil {
		return dto.FailMsg(err.Error())
	}

	// 记录操作日志
	model.RecordLog(userId, model.LogTypeSystem, "禁用两步验证")

	return dto.Msg("两步验证已禁用")
}

func Get2FAStatus(c fuego.ContextNoBody) (*dto.Response[dto.TwoFAStatusData], error) {
	userId := dto.UserID(c)

	twoFA, err := model.GetTwoFAByUserId(userId)
	if err != nil {
		return dto.Fail[dto.TwoFAStatusData](err.Error())
	}

	status := dto.TwoFAStatusData{
		Enabled: false,
		Locked:  false,
	}

	if twoFA != nil {
		status.Enabled = twoFA.IsEnabled
		status.Locked = twoFA.IsLocked()
		if twoFA.IsEnabled {
			// 获取剩余备用码数量
			backupCount, err := model.GetUnusedBackupCodeCount(userId)
			if err != nil {
				common.SysLog("获取备用码数量失败: " + err.Error())
			} else {
				status.BackupCodesRemaining = backupCount
			}
		}
	}

	return dto.Ok(status)
}

func RegenerateBackupCodes(c fuego.ContextWithBody[dto.Verify2FARequest]) (*dto.Response[dto.BackupCodesData], error) {
	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.BackupCodesData]("参数错误")
	}

	userId := dto.UserID(c)

	// 获取2FA记录
	twoFA, err := model.GetTwoFAByUserId(userId)
	if err != nil {
		return dto.Fail[dto.BackupCodesData](err.Error())
	}
	if twoFA == nil || !twoFA.IsEnabled {
		return dto.Fail[dto.BackupCodesData]("用户未启用2FA")
	}

	// 验证TOTP验证码
	cleanCode, err := common.ValidateNumericCode(req.Code)
	if err != nil {
		return dto.Fail[dto.BackupCodesData](err.Error())
	}

	valid, err := twoFA.ValidateTOTPAndUpdateUsage(cleanCode)
	if err != nil {
		return dto.Fail[dto.BackupCodesData](err.Error())
	}
	if !valid {
		return dto.Fail[dto.BackupCodesData]("验证码或备用码错误，请重试")
	}

	// 生成新的备用码
	backupCodes, err := common.GenerateBackupCodes()
	if err != nil {
		common.SysLog("生成备用码失败: " + err.Error())
		return dto.Fail[dto.BackupCodesData]("生成备用码失败")
	}

	// 保存新的备用码
	if err := model.CreateBackupCodes(userId, backupCodes); err != nil {
		common.SysLog("保存备用码失败: " + err.Error())
		return dto.Fail[dto.BackupCodesData]("保存备用码失败")
	}

	// 记录操作日志
	model.RecordLog(userId, model.LogTypeSystem, "重新生成两步验证备用码")

	return dto.OkMsg("备用码重新生成成功", dto.BackupCodesData{
		BackupCodes: backupCodes,
	})
}

func Verify2FALogin(c *gin.Context) {
	var req dto.Verify2FARequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(200, dto.ApiResponse{Message: "参数错误"})
		return
	}

	// 从会话中获取pending用户信息
	session := sessions.Default(c)
	pendingUserId := session.Get("pending_user_id")
	if pendingUserId == nil {
		c.JSON(200, dto.ApiResponse{Message: "会话已过期，请重新登录"})
		return
	}
	userId, ok := pendingUserId.(int)
	if !ok {
		c.JSON(200, dto.ApiResponse{Message: "会话数据无效，请重新登录"})
		return
	}
	// 获取用户信息
	user, err := model.GetUserById(userId, false)
	if err != nil {
		c.JSON(200, dto.ApiResponse{Message: "用户不存在"})
		return
	}

	// 获取2FA记录
	twoFA, err := model.GetTwoFAByUserId(user.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if twoFA == nil || !twoFA.IsEnabled {
		c.JSON(200, dto.ApiResponse{Message: "用户未启用2FA"})
		return
	}

	// 验证TOTP验证码或备用码
	cleanCode, err := common.ValidateNumericCode(req.Code)
	isValidTOTP := false
	isValidBackup := false

	if err == nil {
		// 尝试验证TOTP
		isValidTOTP, _ = twoFA.ValidateTOTPAndUpdateUsage(cleanCode)
	}

	if !isValidTOTP {
		// 尝试验证备用码
		isValidBackup, err = twoFA.ValidateBackupCodeAndUpdateUsage(req.Code)
		if err != nil {
			c.JSON(200, dto.ApiResponse{Message: err.Error()})
			return
		}
	}

	if !isValidTOTP && !isValidBackup {
		c.JSON(200, dto.ApiResponse{Message: "验证码或备用码错误，请重试"})
		return
	}

	// 2FA验证成功，清理pending会话信息并完成登录
	session.Delete("pending_username")
	session.Delete("pending_user_id")
	session.Save()

	setupLogin(user, c)
}

func Admin2FAStats(c fuego.ContextNoBody) (*dto.Response[*model.TwoFAStats], error) {
	stats, err := model.GetTwoFAStats()
	if err != nil {
		return dto.Fail[*model.TwoFAStats](err.Error())
	}

	return dto.Ok(stats)
}

func AdminDisable2FA(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	userId, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailMsg("用户ID格式错误")
	}

	// 检查目标用户权限
	targetUser, err := model.GetUserById(userId, false)
	if err != nil {
		return dto.FailMsg(err.Error())
	}

	myRole := dto.UserRole(c)
	if myRole <= targetUser.Role && myRole != common.RoleRootUser {
		return dto.FailMsg("无权操作同级或更高级用户的2FA设置")
	}

	// 禁用2FA
	if err := model.DisableTwoFA(userId); err != nil {
		if errors.Is(err, model.ErrTwoFANotEnabled) {
			return dto.FailMsg("用户未启用2FA")
		}
		return dto.FailMsg(err.Error())
	}

	// 记录操作日志
	adminId := dto.UserID(c)
	model.RecordLog(userId, model.LogTypeManage,
		fmt.Sprintf("管理员(ID:%d)强制禁用了用户的两步验证", adminId))

	return dto.Msg("用户2FA已被强制禁用")
}
