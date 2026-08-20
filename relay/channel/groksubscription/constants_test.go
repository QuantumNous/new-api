package groksubscription

import "testing"

func TestCLIClientVersionSemver(t *testing.T) {
	// 合法且 >= min 直接采用
	t.Setenv("GROK_CLI_CLIENT_VERSION", "0.2.114")
	if got := CLIClientVersion(); got != "0.2.114" {
		t.Fatalf("valid version = %q, want 0.2.114", got)
	}
	// 低于 min 回退默认
	t.Setenv("GROK_CLI_CLIENT_VERSION", "0.2.92")
	if got := CLIClientVersion(); got != CLIClientVersionDefault {
		t.Fatalf("below-min version should fall back, got %q", got)
	}
	// 非法(非三段)回退默认
	t.Setenv("GROK_CLI_CLIENT_VERSION", "0.3")
	if got := CLIClientVersion(); got != CLIClientVersionDefault {
		t.Fatalf("invalid version should fall back, got %q", got)
	}
	// 空回退默认
	t.Setenv("GROK_CLI_CLIENT_VERSION", "")
	if got := CLIClientVersion(); got != CLIClientVersionDefault {
		t.Fatalf("empty version should fall back, got %q", got)
	}
	// 高于 min 也应采用
	t.Setenv("GROK_CLI_CLIENT_VERSION", "1.0.0")
	if got := CLIClientVersion(); got != "1.0.0" {
		t.Fatalf("above-min version = %q, want 1.0.0", got)
	}
}
