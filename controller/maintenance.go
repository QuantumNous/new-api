package controller

import (
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// GetMaintenanceStatus 获取当前维护配置
func GetMaintenanceStatus(c *gin.Context) {
	setting := system_setting.GetMaintenanceSetting()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    setting,
	})
}

// UpdateMaintenanceRequest 更新维护配置请求体
type UpdateMaintenanceRequest struct {
	Enabled          bool   `json:"enabled"`
	Title            string `json:"title"`
	Message          string `json:"message"`
	NoticeEnabled    bool   `json:"notice_enabled"`
	NoticeStartAt    int64  `json:"notice_start_at"`
	StartAt          int64  `json:"start_at"`
	EndAt            int64  `json:"end_at"`
	WhitelistUserIds string `json:"whitelist_user_ids"`
	AllowAdminPass   bool   `json:"allow_admin_pass"`
}

// UpdateMaintenanceStatus 更新维护配置
func UpdateMaintenanceStatus(c *gin.Context) {
	var req UpdateMaintenanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的请求参数: " + err.Error(),
		})
		return
	}

	// 构造新配置
	newSetting := system_setting.MaintenanceSetting{
		Enabled:          req.Enabled,
		Title:            req.Title,
		Message:          req.Message,
		NoticeEnabled:    req.NoticeEnabled,
		NoticeStartAt:    req.NoticeStartAt,
		StartAt:          req.StartAt,
		EndAt:            req.EndAt,
		WhitelistUserIds: req.WhitelistUserIds,
		AllowAdminPass:   req.AllowAdminPass,
	}

	// 默认值处理
	if newSetting.WhitelistUserIds == "" {
		newSetting.WhitelistUserIds = "[]"
	}

	// 更新内存配置
	system_setting.UpdateMaintenanceSetting(newSetting)

	// 持久化到数据库
	if err := saveMaintenanceToDb(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "保存配置失败: " + err.Error(),
		})
		return
	}

	// 同步到 Redis
	if err := middleware.SetMaintenanceToRedis(&newSetting); err != nil {
		// Redis 写入失败不影响主流程，只记录日志
		common.SysError("同步维护状态到 Redis 失败: " + err.Error())
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "维护配置已更新",
	})
}

// DisableMaintenance 快速关闭维护模式
func DisableMaintenance(c *gin.Context) {
	setting := system_setting.GetMaintenanceSetting()
	setting.Enabled = false
	setting.NoticeEnabled = false
	system_setting.UpdateMaintenanceSetting(*setting)

	// 持久化到数据库
	if err := saveMaintenanceToDb(); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "保存配置失败: " + err.Error(),
		})
		return
	}

	// 同步到 Redis
	if err := middleware.SetMaintenanceToRedis(setting); err != nil {
		common.SysError("同步维护状态到 Redis 失败: " + err.Error())
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "维护模式已关闭",
	})
}

// saveMaintenanceToDb 将维护配置持久化到数据库
func saveMaintenanceToDb() error {
	return config.GlobalConfig.SaveToDB(func(key, value string) error {
		// 只保存 maintenance_setting 前缀的配置
		if len(key) > 21 && key[:21] == "maintenance_setting." {
			return model.UpdateOption(key, value)
		}
		return nil
	})
}

// checkMaintenanceLoginAllowed 检查维护期间是否允许该用户登录
// 返回 true 表示允许登录，false 表示已拒绝（已写入 HTTP 响应）
func checkMaintenanceLoginAllowed(user *model.User, c *gin.Context) bool {
	setting := system_setting.GetMaintenanceSetting()
	if !setting.Enabled {
		return true
	}

	// 检查维护时间窗口
	now := time.Now().Unix()
	if setting.StartAt > 0 && now < setting.StartAt {
		return true // 维护尚未开始
	}
	if setting.EndAt > 0 && now > setting.EndAt {
		return true // 维护已结束
	}

	// root 用户始终放行
	if user.Role >= common.RoleRootUser {
		return true
	}

	// admin 用户根据配置放行
	if user.Role >= common.RoleAdminUser && setting.AllowAdminPass {
		return true
	}

	// 白名单用户放行
	whitelistIds := system_setting.GetWhitelistUserIds()
	for _, wid := range whitelistIds {
		if wid == user.Id {
			return true
		}
	}

	// 拒绝登录
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"success": false,
		"message": setting.Message,
		"data": gin.H{
			"title":  setting.Title,
			"end_at": setting.EndAt,
		},
	})
	return false
}
