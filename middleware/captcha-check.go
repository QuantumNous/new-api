package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// CaptchaScene 人机验证保护的应用场景。
// 场景开关用于控制某类业务接口是否需要人机验证；未列出的场景（如签到）始终跟随渠道开关。
type CaptchaScene string

const (
	CaptchaSceneLogin    CaptchaScene = "login"
	CaptchaSceneRegister CaptchaScene = "register"
	CaptchaSceneReset    CaptchaScene = "reset"
)

func captchaSceneEnabled(scene CaptchaScene) bool {
	switch scene {
	case CaptchaSceneLogin:
		return common.CaptchaLoginEnabled
	case CaptchaSceneRegister:
		return common.CaptchaRegisterEnabled
	case CaptchaSceneReset:
		return common.CaptchaResetEnabled
	default:
		return true
	}
}

// CaptchaCheckFor 机器人保护统一入口，按业务场景启用。
// 目前支持 Cloudflare Turnstile、极验 GeeTest 与 Corptcha 三种渠道，
// 且同一时刻仅允许启用一个，按当前配置分发到对应渠道的校验中间件。
func CaptchaCheckFor(scene CaptchaScene) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !captchaSceneEnabled(scene) {
			c.Next()
			return
		}
		switch {
		case common.CorptchaCheckEnabled:
			CorptchaCheck(scene)(c)
		case common.GeeTestCheckEnabled:
			GeeTestCheck()(c)
		case common.TurnstileCheckEnabled:
			TurnstileCheck()(c)
		default:
			c.Next()
		}
	}
}
