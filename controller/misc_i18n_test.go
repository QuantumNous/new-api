package controller

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestBuildVerificationEmailUsesEnglishDefaults(t *testing.T) {
	subject, content := buildVerificationEmail("new-api", "123456")

	if subject != "new-api Email Verification" {
		t.Fatalf("expected english subject, got %q", subject)
	}
	if !strings.Contains(content, "Hello") {
		t.Fatalf("expected english greeting in content, got %q", content)
	}
	if !strings.Contains(content, "123456") {
		t.Fatalf("expected verification code in content, got %q", content)
	}
	if strings.Contains(content, "邮箱") {
		t.Fatalf("expected english-only content, got %q", content)
	}
}

func TestBuildPasswordResetEmailUsesEnglishDefaults(t *testing.T) {
	link := "https://example.com/user/reset?email=test@example.com&token=token"
	subject, content := buildPasswordResetEmail("new-api", link)

	if subject != "new-api Password Reset" {
		t.Fatalf("expected english subject, got %q", subject)
	}
	if !strings.Contains(content, "resetting your password") {
		t.Fatalf("expected english reset content, got %q", content)
	}
	if !strings.Contains(content, link) {
		t.Fatalf("expected reset link in content, got %q", content)
	}
	if strings.Contains(content, "密码") {
		t.Fatalf("expected english-only content, got %q", content)
	}
}

func TestBuildVerificationEmailIncludesConfiguredValidityWindow(t *testing.T) {
	_, content := buildVerificationEmail("new-api", "654321")

	expectedWindow := fmt.Sprintf("valid for %d minutes", common.VerificationValidMinutes)
	if !strings.Contains(content, expectedWindow) {
		t.Fatalf("expected english validity window, got %q", content)
	}
}
