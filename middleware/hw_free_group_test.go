package middleware

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// hwFreeGroupTestDB gives the limiter an empty flag table, because the frozen
// check runs on the same path. Every account id in these tests has no flag row,
// so no account is frozen.
func hwFreeGroupTestDB(t *testing.T) {
	t.Helper()
	if model.DB != nil {
		return
	}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	require.NoError(t, db.AutoMigrate(&model.HwAccountFlag{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = nil
		_ = sqlDB.Close()
	})
}

var hwFreeGroupUserCounter atomic.Int64

// hwFreeGroupFreshUser returns an account id nobody used before in this
// process. The limiter keeps its counters per process, so a fixed id would be
// spent by an earlier run of the same test under -count or -shuffle.
func hwFreeGroupFreshUser() int {
	return int(4000000 + hwFreeGroupUserCounter.Add(1))
}

// hwFreeGroupTestRouter serves a request as one user in one account group, with
// the token group and the request group set the way TokenAuth and a playground
// body would set them, so a test can prove which of the three the limiter reads.
func hwFreeGroupTestRouter(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())
	hwFreeGroupTestDB(t)
	router := gin.New()
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		c.Set("id", hwFreeGroupTestUserID(c))
		userGroup := c.Query("usergroup")
		common.SetContextKey(c, constant.ContextKeyUserGroup, userGroup)
		common.SetContextKey(c, constant.ContextKeyTokenGroup, c.Query("group"))
		requestGroup := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if requestGroup == "" {
			requestGroup = userGroup
		}
		common.SetContextKey(c, constant.ContextKeyUsingGroup, requestGroup)
	}, HwFreeGroupRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return router
}

// hwFreeGroupTestUserID reads the user of the request from the path query, so
// every case of a table test can use its own counter.
func hwFreeGroupTestUserID(c *gin.Context) int {
	id, _ := strconv.Atoi(c.Query("user"))
	return id
}

func TestHwFreeGroupRateLimitCapsFreeAccounts(t *testing.T) {
	t.Setenv("HW_FREE_GROUP_PER_MINUTE", "2")
	t.Setenv("HW_FREE_GROUP_PER_DAY", "10")
	router := hwFreeGroupTestRouter(t)

	call := func(userGroup, tokenGroup string, userID int) int {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost,
			"/v1/chat/completions?user="+strconv.Itoa(userID)+"&usergroup="+userGroup+"&group="+tokenGroup, nil)
		router.ServeHTTP(recorder, request)
		return recorder.Code
	}

	firstUser, otherUser := hwFreeGroupFreshUser(), hwFreeGroupFreshUser()
	assert.Equal(t, http.StatusOK, call("free", "free", firstUser))
	assert.Equal(t, http.StatusOK, call("free", "free", firstUser))
	assert.Equal(t, http.StatusTooManyRequests, call("free", "free", firstUser), "the third request in a minute is refused")
	assert.Equal(t, http.StatusOK, call("free", "free", otherUser), "another account has its own budget")
	for range 3 {
		assert.Equal(t, http.StatusOK, call("paid", "paid", firstUser), "a paid account is not capped here")
	}
}

// A free account that holds a token in default, vip or auto, or whose request
// names one of those groups, keeps the budget of the free account.
func TestHwFreeGroupRateLimitReadsTheAccountGroup(t *testing.T) {
	t.Setenv("HW_FREE_GROUP_PER_MINUTE", "1")
	t.Setenv("HW_FREE_GROUP_PER_DAY", "10")
	router := hwFreeGroupTestRouter(t)

	call := func(userID int, tokenGroup string) int {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost,
			"/v1/chat/completions?user="+strconv.Itoa(userID)+"&usergroup=free&group="+tokenGroup, nil)
		router.ServeHTTP(recorder, request)
		return recorder.Code
	}
	for _, tokenGroup := range []string{"default", "vip", "auto", "free"} {
		userID := hwFreeGroupFreshUser()
		assert.Equal(t, http.StatusOK, call(userID, tokenGroup), "the first request of %s passes", tokenGroup)
		assert.Equal(t, http.StatusTooManyRequests, call(userID, tokenGroup),
			"a token group %s does not lift the free budget", tokenGroup)
	}
}

// A pinned channel must not skip the free-group model class: the pin decides
// where a request goes, never what a trial account may call.
func TestHwFreeGroupModelGateAlsoRunsForPinnedChannels(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, i18n.Init())
	hwFreeGroupTestDB(t)

	router := gin.New()
	router.POST("/v1/chat/completions", func(c *gin.Context) {
		common.SetContextKey(c, constant.ContextKeyUserGroup, "free")
		common.SetContextKey(c, constant.ContextKeyUsingGroup, "free")
		service.GetChannelConstraints(c).AddPin(dto.ChannelPin{
			ChannelId: 7,
			Source:    dto.PinSourceToken,
			Rank:      dto.PinRankToken,
			RetryMode: dto.PinRetrySingleAttempt,
		})
	}, Distribute(), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(`{"model":"claude-opus-5"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	assert.Equal(t, http.StatusForbidden, recorder.Code, "the pinned channel must not lift the model class of a free account")
}

func TestHwFreeGroupRateLimitCapsTheDay(t *testing.T) {
	t.Setenv("HW_FREE_GROUP_PER_MINUTE", "100")
	t.Setenv("HW_FREE_GROUP_PER_DAY", "1")
	router := hwFreeGroupTestRouter(t)
	dayUser := strconv.Itoa(hwFreeGroupFreshUser())

	first := httptest.NewRecorder()
	router.ServeHTTP(first, httptest.NewRequest(http.MethodPost, "/v1/chat/completions?user="+dayUser+"&usergroup=free&group=free", nil))
	second := httptest.NewRecorder()
	router.ServeHTTP(second, httptest.NewRequest(http.MethodPost, "/v1/chat/completions?user="+dayUser+"&usergroup=free&group=free", nil))

	assert.Equal(t, http.StatusOK, first.Code)
	assert.Equal(t, http.StatusTooManyRequests, second.Code, "the daily budget ends the day")
}

func TestHwFreeGroupModelAllowed(t *testing.T) {
	t.Setenv("HW_FREE_MODELS", " our-extra-model ")
	cases := []struct {
		name  string
		group string
		model string
		want  bool
	}{
		{name: "free may call haiku", group: "free", model: "claude-haiku-4-5", want: true},
		{name: "free may call haiku in another spelling", group: "free", model: "Claude-Haiku-4-5-Latest", want: true},
		{name: "free may call the older haiku family", group: "free", model: "claude-3-5-haiku-20241022", want: true},
		{name: "free may call haiku with a reasoning modifier", group: "free", model: "claude-haiku-5-5@high", want: true},
		{name: "free may call a namespaced haiku", group: "free", model: "vendor/anthropic/claude-haiku-4-5", want: true},
		{name: "free may not call a model that only mentions haiku", group: "free", model: "claude-haiku-pro", want: false},
		{name: "free may not call a sonnet alias with haiku in the name", group: "free", model: "sonnet-haiku-blend", want: false},
		{name: "free may not call the bare family name", group: "free", model: "claude-haiku", want: false},
		{name: "free may call a sold sonnet", group: "free", model: "claude-sonnet-5-5", want: true},
		{name: "free may call the premium fable", group: "free", model: "claude-fable-5-1", want: true},
		{name: "free may call the premium astra with a modifier", group: "free", model: "gpt-6-astra@high", want: true},
		{name: "free may not call an opus outside the catalog", group: "free", model: "claude-opus-5", want: false},
		{name: "free may not call a retired model", group: "free", model: "gpt-6", want: false},
		{name: "free may not call an unrelated model", group: "free", model: "gpt-5", want: false},
		{name: "free may not call an empty model", group: "free", model: "", want: false},
		{name: "the allow-list admits an exact extra model", group: "free", model: "our-extra-model", want: true},
		{name: "paid may call sonnet", group: "paid", model: "claude-sonnet-5-5", want: true},
		{name: "default group may call opus", group: "default", model: "claude-opus-5", want: true},
	}
	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(t, testCase.want, HwFreeGroupModelAllowed(testCase.group, testCase.model))
		})
	}
}
