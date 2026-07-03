package common

import (
	"strings"
	"testing"
)

// TestSSRFProtection_AllowPrivateHosts 锁定「私网放行白名单」的行为边界：
// 只放松「域名解析到私网」这一条，scheme / 端口 / 字面私网 IP 仍照常拦截。
func TestSSRFProtection_AllowPrivateHosts(t *testing.T) {
	base := func() *SSRFProtection {
		return &SSRFProtection{
			AllowedPorts:           []int{80, 443},
			ApplyIPFilterForDomain: true, // 触发域名解析后的 IP 校验
		}
	}

	// 无白名单：localhost 解析到私网(127.0.0.1/::1) → 拒绝
	if err := base().ValidateURL("http://localhost/x"); err == nil {
		t.Fatal("expected private-IP rejection for localhost without allowlist")
	}

	p := base()
	p.AllowPrivateHosts = []string{"localhost"}

	// 白名单命中：私网放行
	if err := p.ValidateURL("http://localhost/x"); err != nil {
		t.Fatalf("expected localhost allowed via AllowPrivateHosts, got %v", err)
	}
	// host 匹配大小写不敏感
	if err := p.ValidateURL("http://LOCALHOST/x"); err != nil {
		t.Fatalf("expected case-insensitive host match, got %v", err)
	}
	// 端口仍强制：即便 host 在白名单，非 80/443 端口仍被拒
	if err := p.ValidateURL("http://localhost:6379/"); err == nil || !strings.Contains(err.Error(), "port") {
		t.Fatalf("expected port rejection even for allowed host, got %v", err)
	}
	// scheme 仍强制
	if err := p.ValidateURL("ftp://localhost/"); err == nil {
		t.Fatal("expected scheme rejection")
	}
	// 字面私网 IP 不受白名单影响（白名单只作用于「域名解析后」路径）
	if err := p.ValidateURL("http://127.0.0.1/"); err == nil {
		t.Fatal("expected literal private IP still rejected")
	}
}

func TestSSRFProtection_hostPrivateAllowed(t *testing.T) {
	p := &SSRFProtection{AllowPrivateHosts: []string{"", "a.example.com"}}
	if !p.hostPrivateAllowed("A.EXAMPLE.COM") {
		t.Error("expected case-insensitive match")
	}
	if p.hostPrivateAllowed("b.example.com") {
		t.Error("unexpected match")
	}
	if p.hostPrivateAllowed("") {
		t.Error("empty host must not match empty allowlist entry")
	}
}
