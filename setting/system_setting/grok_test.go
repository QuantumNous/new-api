package system_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/config"
	_ "github.com/QuantumNous/new-api/setting/model_setting" // 触发其 init 注册 "grok"（计费段）
)

func TestGrokSubscriptionSettingsDefaults(t *testing.T) {
	s := GetGrokSubscriptionSettings()
	if s == nil {
		t.Fatalf("GetGrokSubscriptionSettings must not be nil")
	}
	// 密码登录默认关闭（ToS/风控风险，设计 §12/§13）
	if s.PasswordAuthEnabled {
		t.Fatalf("password auth must default to disabled")
	}
	if s.CLIClientVersion != "" {
		t.Fatalf("cli client version override must default to empty")
	}
}

// 回归护栏：grok_subscription 与 model_setting 的 "grok"（计费）必须是两个独立注册段，
// 防止同名 Register 静默互相覆盖（config.Register = map 覆写，无报错）。
// 保护主要由下面的非 nil 断言承担（注册名改回 "grok" 会令 Get("grok_subscription")
// 变 nil）；billing == sub 因两侧动态类型不同实际恒非等，仅文档化"两段非同一实例"。
func TestGrokSettingsRegisterNameDoesNotCollide(t *testing.T) {
	billing := config.GlobalConfig.Get("grok")
	sub := config.GlobalConfig.Get("grok_subscription")
	if billing == nil || sub == nil {
		t.Fatalf("both sections must be registered: grok=%v grok_subscription=%v", billing != nil, sub != nil)
	}
	if billing == sub {
		t.Fatalf("grok (billing) and grok_subscription must be distinct config sections")
	}
}
