package common

import "testing"

func setOpt(img, vid string) {
	OptionMapRWMutex.Lock()
	if OptionMap == nil {
		OptionMap = map[string]string{}
	}
	OptionMap["ImageModelSizeConfig"] = img
	OptionMap["VideoModelConfig"] = vid
	OptionMapRWMutex.Unlock()
}

func TestImageSizeValidation(t *testing.T) {
	setOpt(`{"default":["1024x1024"],"models":{"z-image":{"sizes":["1024x1024","1664x928"]},"legacy":["512x512"]}}`, "")
	// 未配置的模型:放行
	if err := ValidateImageSizeForModel("9999x9999", "not-configured"); err != nil {
		t.Fatalf("unconfigured model should pass, got %v", err)
	}
	// 配置命中(含大小写/分隔符归一化)
	if err := ValidateImageSizeForModel("1664X928", "z-image"); err != nil {
		t.Fatalf("allowed size should pass, got %v", err)
	}
	// 配置未命中:拒绝
	if err := ValidateImageSizeForModel("2048x2048", "z-image"); err == nil {
		t.Fatal("disallowed size should be rejected")
	}
	// 旧形态(值为数组)
	if err := ValidateImageSizeForModel("512x512", "legacy"); err != nil {
		t.Fatalf("legacy array form should pass, got %v", err)
	}
	// size 为空:不校验
	if err := ValidateImageSizeForModel("", "z-image"); err != nil {
		t.Fatalf("empty size should pass, got %v", err)
	}
}

func TestVideoParamsValidation(t *testing.T) {
	setOpt("", `{"models":{"wan2.2-t2v":{"sizes":["1280x720"],"durations":["5","10"]}}}`)
	// 未配置模型:放行
	if err := ValidateVideoParamsForModel("9x9", 999, "", "other"); err != nil {
		t.Fatalf("unconfigured should pass, got %v", err)
	}
	// 尺寸+时长命中
	if err := ValidateVideoParamsForModel("1280x720", 5, "", "wan2.2-t2v"); err != nil {
		t.Fatalf("allowed params should pass, got %v", err)
	}
	// 尺寸不中
	if err := ValidateVideoParamsForModel("640x480", 5, "", "wan2.2-t2v"); err == nil {
		t.Fatal("bad size should reject")
	}
	// 时长不中
	if err := ValidateVideoParamsForModel("1280x720", 7, "", "wan2.2-t2v"); err == nil {
		t.Fatal("bad duration should reject")
	}
	// 时长走 secondsStr 且带单位 "10s" 兼容(前导整数匹配)
	setOpt("", `{"models":{"m":{"durations":["10s"]}}}`)
	if err := ValidateVideoParamsForModel("", 10, "", "m"); err != nil {
		t.Fatalf("10 vs 10s should match, got %v", err)
	}
}
