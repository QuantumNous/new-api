package common

import "testing"

func TestCaptchaMemoryStoreVerify(t *testing.T) {
	prev := RedisEnabled
	RedisEnabled = false
	defer func() { RedisEnabled = prev }()

	captchaMemMu.Lock()
	captchaMemMap = make(map[string]captchaMemValue)
	captchaMemMu.Unlock()

	store := captchaStoreInst
	if err := store.Set("id-1", "123456"); err != nil {
		t.Fatalf("Set returned error: %v", err)
	}

	// 错误答案应失败，且不消费（允许合法用户重试同一验证码）
	if store.Verify("id-1", "000000", true) {
		t.Fatal("wrong answer should not verify")
	}
	// 错误一次后正确答案仍应通过
	if !store.Verify("id-1", "123456", false) {
		t.Fatal("correct answer should verify after a wrong attempt")
	}
	// clear=true 成功后应被一次性消费
	if !store.Verify("id-1", "123456", true) {
		t.Fatal("correct answer should verify before clear")
	}
	if store.Verify("id-1", "123456", true) {
		t.Fatal("answer should be consumed after a successful clear")
	}
}

func TestVerifyCaptchaEmptyInput(t *testing.T) {
	if VerifyCaptcha("", "123") {
		t.Fatal("empty id should fail")
	}
	if VerifyCaptcha("id", "") {
		t.Fatal("empty answer should fail")
	}
}

func TestGenerateCaptcha(t *testing.T) {
	prev := RedisEnabled
	RedisEnabled = false
	defer func() { RedisEnabled = prev }()

	id, b64, err := GenerateCaptcha()
	if err != nil {
		t.Fatalf("GenerateCaptcha error: %v", err)
	}
	if id == "" {
		t.Fatal("captcha id should not be empty")
	}
	if len(b64) == 0 || b64[:5] != "data:" {
		t.Fatalf("captcha image should be a data url, got prefix: %.10q", b64)
	}
}
