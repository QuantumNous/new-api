package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestChimeraUserCodeRegex(t *testing.T) {
	valid := []string{"ABCD-2345", "WXYZ-6789", "AAAA-BBBB"}
	for _, v := range valid {
		if !chimeraUserCodeRe.MatchString(v) {
			t.Fatalf("expected %q to be valid", v)
		}
	}
	invalid := []string{
		"", "abcd-2345", "ABCD2345", "ABC-2345", "ABCD-234",
		"${alert(1)}", "AAAA-BBB`", "AA<B-CCCC", "ABCD-2345 ",
		"0OIL-1234", // 排除的易混淆字符不应通过
	}
	for _, v := range invalid {
		if chimeraUserCodeRe.MatchString(v) {
			t.Fatalf("expected %q to be rejected", v)
		}
	}
}

// 回归 P1：确认页把 URL 传入的 user_code 反射到收集账密的 HTML/JS 页面。
// 非法字符（反引号 / ${} / 尖括号）必须被拒（400 静态页），绝不回显原始输入。
func TestChimeraDeviceVerifyPageRejectsInjection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	payloads := []string{
		"${alert(document.cookie)}",
		"`+alert(1)+`",
		"<script>alert(1)</script>",
		"AAAA-BBBB${x}",
	}
	for _, p := range payloads {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/chimera/device/verify?user_code="+p, nil)
		ChimeraDeviceVerifyPage(c)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("payload %q: expected 400, got %d", p, w.Code)
		}
		body := w.Body.String()
		for _, needle := range []string{"alert", "${", "<script>alert", "`+"} {
			if strings.Contains(body, needle) {
				t.Fatalf("payload %q: response leaked %q", p, needle)
			}
		}
	}
}

func TestChimeraDeviceVerifyPageRendersValidCode(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/chimera/device/verify?user_code=ABCD-2345", nil)
	ChimeraDeviceVerifyPage(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for valid code, got %d", w.Code)
	}
	body := w.Body.String()
	if !strings.Contains(body, "ABCD-2345") {
		t.Fatalf("valid code not rendered")
	}
	// JS 应从 DOM 读取 user_code，而非把它插进模板字符串
	if !strings.Contains(body, `getElementById("uc").textContent`) {
		t.Fatalf("expected JS to read user_code from DOM")
	}
}
