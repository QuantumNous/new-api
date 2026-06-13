package controller

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// 实网验证：直接调用各 provider 的 query 函数（不经 storeBalanceResult，避免依赖 DB）。
// 默认跳过；用 LIVE_BALANCE_TEST=1 打开。
//
// 凭据一律从环境变量读取，绝不硬编码进仓库（避免泄露生产 key/密码）。
// 每个用例缺失对应 env 时单独跳过。示例：
//
//	LIVE_BALANCE_TEST=1 \
//	LK888_BASE=https://api.lk888.ai/api LK888_KEY=sk-xxx \
//	LISTENHUB_BASE=https://api.marswave.ai/openapi LISTENHUB_KEY=lh_sk_xxx \
//	NEWAPI_SPEND_BASE=https://api.bltcy.ai NEWAPI_SPEND_KEY=sk-xxx \
//	CONSOLE_BASE=https://api.manxiaobai.online CONSOLE_USER=xxx CONSOLE_PASS=xxx \
//	go test ./controller/ -run 'TestLiveBalance|TestLiveConsole' -v
func ptr(s string) *string { return &s }

func skipUnlessLive(t *testing.T) {
	if os.Getenv("LIVE_BALANCE_TEST") != "1" {
		t.Skip("set LIVE_BALANCE_TEST=1 to run live balance probes")
	}
}

func TestLiveBalanceProviders(t *testing.T) {
	skipUnlessLive(t)

	cases := []struct {
		name    string
		baseEnv string
		keyEnv  string
		typ     int
		other   string
		fn      func(*model.Channel) (*BalanceQueryResult, error)
	}{
		{"lk888", "LK888_BASE", "LK888_KEY", constant.ChannelTypeOpenAIVideo, "lk888", queryLK888Balance},
		{"listenhub", "LISTENHUB_BASE", "LISTENHUB_KEY", constant.ChannelTypeListenHub, "", queryListenHubBalance},
		{"newapi-spend", "NEWAPI_SPEND_BASE", "NEWAPI_SPEND_KEY", constant.ChannelTypeOpenAI, "", queryNewAPISpend},
		{"console-only", "CONSOLE_ONLY_BASE", "CONSOLE_ONLY_KEY", constant.ChannelTypeOpenAIVideo, "", queryNewAPISpend},
	}

	for _, tc := range cases {
		base, key := os.Getenv(tc.baseEnv), os.Getenv(tc.keyEnv)
		if base == "" || key == "" {
			t.Logf("skip %s: set %s and %s to run", tc.name, tc.baseEnv, tc.keyEnv)
			continue
		}
		t.Run(tc.name, func(t *testing.T) {
			ch := &model.Channel{Type: tc.typ, Other: tc.other, BaseURL: ptr(base), Key: key}
			r, err := tc.fn(ch)
			if err != nil {
				t.Fatalf("%s query error: %v", tc.name, err)
			}
			t.Logf("%s => kind=%s remaining=%.4f used=%.4f unit=%s expires=%d", tc.name, r.Kind, r.Remaining, r.Used, r.Unit, r.ExpiresAt)
		})
	}
}

// 登录态拿真实钱包余额（new-api 套壳站）
func TestLiveConsoleBalance(t *testing.T) {
	skipUnlessLive(t)
	base, user, pass := os.Getenv("CONSOLE_BASE"), os.Getenv("CONSOLE_USER"), os.Getenv("CONSOLE_PASS")
	if base == "" || user == "" || pass == "" {
		t.Skip("set CONSOLE_BASE/CONSOLE_USER/CONSOLE_PASS to run console balance test")
	}
	ch := &model.Channel{Type: constant.ChannelTypeOpenAI, BaseURL: ptr(base), Key: os.Getenv("CONSOLE_KEY")}
	ch.SetSetting(dto.ChannelSettings{
		BalanceQuery: &dto.BalanceQuerySetting{Mode: "newapi_console", Username: user, Password: pass},
	})
	r, err := queryNewAPIStationBalance(ch)
	if err != nil {
		t.Fatalf("console query error: %v", err)
	}
	t.Logf("console => kind=%s remaining=%.4f(USD) used=%.4f unit=%s", r.Kind, r.Remaining, r.Used, r.Unit)
}

// 集成测试：用本地 sqlite 副本初始化 DB，直接调用 GetChannelBalanceOverview（绕过 AdminAuth），
// 验证一次性查出全部下游余额。需 LIVE_BALANCE_TEST=1 且 OVERVIEW_DB 指向 sqlite 文件。
func TestLiveBalanceOverview(t *testing.T) {
	skipUnlessLive(t)
	dbPath := os.Getenv("OVERVIEW_DB")
	if dbPath == "" {
		t.Skip("set OVERVIEW_DB=/path/to/one-api.db to run the overview integration test")
	}
	os.Setenv("SQLITE_PATH", dbPath)
	common.InitEnv()
	if err := model.InitDB(); err != nil {
		t.Fatalf("InitDB: %v", err)
	}

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/channel/balance_overview", nil)

	GetChannelBalanceOverview(c)

	t.Logf("HTTP %d", rec.Code)
	t.Logf("response:\n%s", rec.Body.String())
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
}
