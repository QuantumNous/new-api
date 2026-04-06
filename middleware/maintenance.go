package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

const maintenanceRedisKey = "maintenance:current"
const maintenanceRedisTTL = 5 * time.Minute

// MaintenanceCheck 维护模式检查中间件
// 在 relay 和核心 API 路由上挂载，用于拦截维护期间的用户请求
func MaintenanceCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		setting := getMaintenanceState()

		// 未启用维护模式，直接放行
		if !setting.Enabled {
			// 检查是否在预告期，如果是则注入 header
			if setting.NoticeEnabled {
				now := time.Now().Unix()
				if setting.NoticeStartAt > 0 && now >= setting.NoticeStartAt {
					c.Header("X-Maintenance-Notice", "true")
				}
			}
			c.Next()
			return
		}

		now := time.Now().Unix()

		// 维护尚未开始（还在预告期）
		if setting.StartAt > 0 && now < setting.StartAt {
			c.Header("X-Maintenance-Notice", "true")
			c.Next()
			return
		}

		// 维护已结束
		if setting.EndAt > 0 && now > setting.EndAt {
			c.Next()
			return
		}

		// ---- 维护进行中，判断是否放行 ----

		// 1. 检查 session 认证的用户角色（来自 authHelper 设置的 context）
		if role, exists := c.Get("role"); exists {
			roleInt, ok := role.(int)
			if ok {
				// root 用户始终放行
				if roleInt >= common.RoleRootUser {
					c.Next()
					return
				}
				// admin 用户根据配置放行
				if roleInt >= common.RoleAdminUser && setting.AllowAdminPass {
					c.Next()
					return
				}
			}
		}

		// 2. 检查 token 认证的用户（来自 TokenAuth 设置的 context）
		userId := c.GetInt("id")
		if userId > 0 {
			// 检查是否为 admin/root
			if model.IsAdmin(userId) {
				c.Next()
				return
			}

			// 检查白名单
			whitelistIds := system_setting.GetWhitelistUserIds()
			for _, wid := range whitelistIds {
				if wid == userId {
					c.Next()
					return
				}
			}
		}

		// 拦截请求，返回 503
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": setting.Message,
			"data": gin.H{
				"title":    setting.Title,
				"end_at":   setting.EndAt,
				"start_at": setting.StartAt,
			},
		})
		c.Abort()
	}
}

// getMaintenanceState 获取维护状态
// 优先从 Redis 读取，失败则回退到配置
func getMaintenanceState() *system_setting.MaintenanceSetting {
	if common.RedisEnabled {
		setting, err := getMaintenanceFromRedis()
		if err == nil && setting != nil {
			return setting
		}
		// Redis 读取失败，回退到配置
		if err != nil {
			logger.LogError(context.Background(), "从 Redis 读取维护状态失败，回退到配置: "+err.Error())
		}
	}
	return system_setting.GetMaintenanceSetting()
}

// getMaintenanceFromRedis 从 Redis 读取维护状态
func getMaintenanceFromRedis() (*system_setting.MaintenanceSetting, error) {
	ctx := context.Background()
	val, err := common.RDB.Get(ctx, maintenanceRedisKey).Result()
	if err != nil {
		return nil, err
	}

	var setting system_setting.MaintenanceSetting
	err = json.Unmarshal([]byte(val), &setting)
	if err != nil {
		return nil, err
	}
	return &setting, nil
}

// SetMaintenanceToRedis 将维护状态写入 Redis
func SetMaintenanceToRedis(setting *system_setting.MaintenanceSetting) error {
	if !common.RedisEnabled {
		return nil
	}

	ctx := context.Background()
	data, err := json.Marshal(setting)
	if err != nil {
		return err
	}

	return common.RDB.Set(ctx, maintenanceRedisKey, string(data), maintenanceRedisTTL).Err()
}

// DeleteMaintenanceFromRedis 删除 Redis 中的维护状态
func DeleteMaintenanceFromRedis() error {
	if !common.RedisEnabled {
		return nil
	}
	ctx := context.Background()
	return common.RDB.Del(ctx, maintenanceRedisKey).Err()
}
