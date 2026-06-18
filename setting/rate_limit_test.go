package setting

import "testing"

// 成功数 < 总数时仅告警、不阻断保存（返回 nil）；非法值仍按原规则报错。
func TestCheckModelRequestRateLimitGroup(t *testing.T) {
	tests := []struct {
		name    string
		json    string
		wantErr bool
	}{
		{"合法配置 成功数>总数", `{"vip":[100,500]}`, false},
		{"成功数等于总数", `{"vip":[40,40]}`, false},
		{"成功数小于总数 仅告警不阻断", `{"vip":[40,10]}`, false},
		{"总数为0不参与告警", `{"vip":[0,5]}`, false},
		{"成功数<1 非法", `{"vip":[40,0]}`, true},
		{"总数为负 非法", `{"vip":[-1,10]}`, true},
		{"非法JSON", `{bad`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckModelRequestRateLimitGroup(tt.json)
			if (err != nil) != tt.wantErr {
				t.Fatalf("CheckModelRequestRateLimitGroup(%q) err=%v wantErr=%v", tt.json, err, tt.wantErr)
			}
		})
	}
}
