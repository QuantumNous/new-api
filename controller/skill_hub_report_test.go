package controller

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func TestBuildSkillHubReportEmailExcludesUntrustedDescription(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	system_setting.ServerAddress = "https://admin.example.com/console-root/"
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
	})

	report := &model.SkillHubReport{
		Id:           123,
		UserID:       42,
		SkillID:      "safe-skill",
		SkillName:    "Safe Skill",
		SkillVersion: "1.0.0",
		Description:  `紧急点击 https://evil.example/login <a href="https://evil.example">登录</a>`,
		CreatedTime:  1_750_000_000,
	}
	subject, content := buildSkillHubReportEmail(report)
	if strings.Contains(subject, "evil.example") || strings.Contains(content, "evil.example") {
		t.Fatalf("email includes untrusted report content: subject=%q content=%q", subject, content)
	}
	if !strings.Contains(content, "https://admin.example.com/console-root/skill-hub/reports?report=123") {
		t.Fatalf("email does not include the fixed management URL: %q", content)
	}
	if !strings.Contains(content, "邮件不会展示任何用户提交的举报正文") {
		t.Fatalf("email does not include the safety warning: %q", content)
	}
}

func TestSkillHubReportManagementURLRejectsUnsafeBaseURL(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
	})

	for _, value := range []string{
		"javascript:alert(1)",
		"https://user:password@example.com",
		"not a URL",
	} {
		system_setting.ServerAddress = value
		if got := skillHubReportManagementURL(123); got != "" {
			t.Fatalf("skillHubReportManagementURL(%q) = %q, want empty", value, got)
		}
	}
}
