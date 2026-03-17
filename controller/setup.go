package controller

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/go-fuego/fuego"
)

func GetSetup(c fuego.ContextNoBody) (*dto.Response[dto.SetupData], error) {
	setup := dto.SetupData{
		Status: constant.Setup,
	}
	if constant.Setup {
		return dto.Ok(setup)
	}
	setup.RootInit = model.RootUserExists()
	if common.UsingMySQL {
		setup.DatabaseType = "mysql"
	}
	if common.UsingPostgreSQL {
		setup.DatabaseType = "postgres"
	}
	if common.UsingSQLite {
		setup.DatabaseType = "sqlite"
	}
	return dto.Ok(setup)
}

func PostSetup(c fuego.ContextWithBody[dto.SetupRequest]) (dto.MessageResponse, error) {
	if constant.Setup {
		return dto.FailMsg("系统已经初始化完成")
	}

	rootExists := model.RootUserExists()

	req, err := c.Body()
	if err != nil {
		return dto.FailMsg("请求参数有误")
	}

	if !rootExists {
		if len(req.Username) > 12 {
			return dto.FailMsg("用户名长度不能超过12个字符")
		}
		if req.Password != req.ConfirmPassword {
			return dto.FailMsg("两次输入的密码不一致")
		}
		if len(req.Password) < 8 {
			return dto.FailMsg("密码长度至少为8个字符")
		}

		hashedPassword, err := common.Password2Hash(req.Password)
		if err != nil {
			return dto.FailMsg("系统错误: " + err.Error())
		}
		rootUser := model.User{
			Username:    req.Username,
			Password:    hashedPassword,
			Role:        common.RoleRootUser,
			Status:      common.UserStatusEnabled,
			DisplayName: "Root User",
			AccessToken: nil,
			Quota:       100000000,
		}
		err = model.DB.Create(&rootUser).Error
		if err != nil {
			return dto.FailMsg("创建管理员账号失败: " + err.Error())
		}
	}

	operation_setting.SelfUseModeEnabled = req.SelfUseModeEnabled
	operation_setting.DemoSiteEnabled = req.DemoSiteEnabled

	err = model.UpdateOption("SelfUseModeEnabled", boolToString(req.SelfUseModeEnabled))
	if err != nil {
		return dto.FailMsg("保存自用模式设置失败: " + err.Error())
	}

	err = model.UpdateOption("DemoSiteEnabled", boolToString(req.DemoSiteEnabled))
	if err != nil {
		return dto.FailMsg("保存演示站点模式设置失败: " + err.Error())
	}

	constant.Setup = true

	setup := model.Setup{
		Version:       common.Version,
		InitializedAt: time.Now().Unix(),
	}
	err = model.DB.Create(&setup).Error
	if err != nil {
		return dto.FailMsg("系统初始化失败: " + err.Error())
	}

	return dto.Msg("系统初始化成功")
}

func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}
