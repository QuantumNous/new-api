package controller

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// hwAdminTestSetup gives the unfreeze handler its own database with the flag
// table and one frozen common user.
func hwAdminTestSetup(t *testing.T) (frozenUser model.User, admin model.User) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	previousDB := model.DB
	model.DB = db
	require.NoError(t, db.AutoMigrate(&model.HwAccountFlag{}, &model.User{}, &model.HwCreditPackage{}, &model.HwCreditExtension{}, &model.HwAdminEscalation{}))

	frozenUser = model.User{
		Username: "hw-frozen-" + common.GetRandomString(6), Password: "x",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
		Group: "default", AuthVersion: 1, AffCode: "aff" + common.GetRandomString(6),
	}
	require.NoError(t, db.Create(&frozenUser).Error)
	admin = model.User{
		Username: "hw-admin-" + common.GetRandomString(6), Password: "x",
		Role: common.RoleAdminUser, Status: common.UserStatusEnabled,
		Group: "default", AuthVersion: 1, AffCode: "aff" + common.GetRandomString(6),
	}
	require.NoError(t, db.Create(&admin).Error)
	frozen, err := model.FreezeHwAccounts([]int{frozenUser.Id}, model.HwFreezeReasonSharedPhone, common.GetTimestamp())
	require.NoError(t, err)
	require.Equal(t, 1, frozen)
	t.Cleanup(func() { model.DB = previousDB })
	return frozenUser, admin
}

func hwAdminUnfreezeRequest(t *testing.T, role int, adminID int, body string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("role", role)
	c.Set("id", adminID)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/hw/admin/unfreeze", strings.NewReader(body))
	HwAdminUnfreeze(c)
	return recorder
}

func TestHwAdminUnfreeze(t *testing.T) {
	frozenUser, admin := hwAdminTestSetup(t)

	t.Run("a non-admin is refused with 403", func(t *testing.T) {
		recorder := hwAdminUnfreezeRequest(t, common.RoleCommonUser, admin.Id,
			`{"user_id":`+strconv.Itoa(frozenUser.Id)+`}`)
		assert.Equal(t, http.StatusForbidden, recorder.Code)
		isFrozen, err := model.HwAccountFrozen(frozenUser.Id)
		require.NoError(t, err)
		assert.True(t, isFrozen, "the refusal never thaws anything")
	})

	t.Run("an admin thaws the account", func(t *testing.T) {
		recorder := hwAdminUnfreezeRequest(t, common.RoleAdminUser, admin.Id,
			`{"user_id":`+strconv.Itoa(frozenUser.Id)+`}`)
		assert.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
		isFrozen, err := model.HwAccountFrozen(frozenUser.Id)
		require.NoError(t, err)
		assert.False(t, isFrozen)
		var flag model.HwAccountFlag
		require.NoError(t, model.DB.Where("user_id = ?", frozenUser.Id).First(&flag).Error)
		assert.Equal(t, admin.Id, flag.UnfrozenBy)
	})

	t.Run("an invalid body is refused", func(t *testing.T) {
		recorder := hwAdminUnfreezeRequest(t, common.RoleAdminUser, admin.Id, `{"user_id":0}`)
		assert.Equal(t, http.StatusOK, recorder.Code, "API errors answer 200 with success=false")
		assert.Contains(t, recorder.Body.String(), `"success":false`)
	})
}

// TestHwAdminAgentEscalate proves the escalation handler against the board and
// the database: a card that exists is reported even when the bookkeeping write
// fails, because a reported failure makes the operator create a second card.
func TestHwAdminAgentEscalate(t *testing.T) {
	_, admin := hwAdminTestSetup(t)
	previousCreateCard := hwAdminAgentCreateCard
	t.Cleanup(func() {
		hwAdminAgentCreateCard = previousCreateCard
	})

	boardFail, dropRow, cards := false, false, 0
	hwAdminAgentCreateCard = func(_ context.Context, _ service.HwBureauCardConfig, _, _, _ string) (string, error) {
		if boardFail {
			return "", errors.New("the bureau board could not be reached")
		}
		cards++
		if dropRow {
			// The board answered and the escalation row is gone by the time the
			// card is written back, so the update affects no row.
			require.NoError(t, model.DB.Exec("DELETE FROM hw_admin_escalations").Error)
		}
		return "CARD-" + strconv.Itoa(cards), nil
	}
	escalate := func(body string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Set("role", common.RoleAdminUser)
		c.Set("id", admin.Id)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/hw/admin/agent/escalate", strings.NewReader(body))
		HwAdminAgentEscalate(c)
		return recorder
	}
	pendingCount := func(t *testing.T) int64 {
		t.Helper()
		var count int64
		require.NoError(t, model.DB.Model(&model.HwAdminEscalation{}).Where("card_ref = ''").Count(&count).Error)
		return count
	}
	cardOf := func(t *testing.T, id int) string {
		t.Helper()
		var row model.HwAdminEscalation
		require.NoError(t, model.DB.First(&row, id).Error)
		return row.CardRef
	}

	t.Run("a stored card is returned and leaves nothing pending", func(t *testing.T) {
		recorder := escalate(`{"title":"card","summary":"kept"}`)
		require.Equal(t, http.StatusOK, recorder.Code)
		var body struct {
			Success bool `json:"success"`
			Data    struct {
				Card string `json:"card"`
				ID   int    `json:"id"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
		assert.True(t, body.Success)
		assert.Equal(t, "CARD-1", body.Data.Card)
		assert.Equal(t, "CARD-1", cardOf(t, body.Data.ID))
		assert.EqualValues(t, 0, pendingCount(t))
	})

	t.Run("an unreachable board still queues the escalation", func(t *testing.T) {
		boardFail = true
		defer func() { boardFail = false }()
		recorder := escalate(`{"title":"offline","summary":"later"}`)
		assert.Contains(t, recorder.Body.String(), `"queued":true`)
		assert.EqualValues(t, 1, pendingCount(t))
	})

	t.Run("a failed bookkeeping write still reports the card that exists", func(t *testing.T) {
		dropRow = true
		defer func() { dropRow = false }()
		// The board answers, so the card exists; the row is gone before the card
		// is written back, the way a dropped connection or a vanished row behaves.
		recorder := escalate(`{"title":"lost","summary":"the row disappears while the board answers"}`)

		var body struct {
			Success bool `json:"success"`
			Data    struct {
				Card string `json:"card"`
				ID   int    `json:"id"`
			} `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body), recorder.Body.String())
		assert.True(t, body.Success, "the handler must not report a failure once the card exists")
		assert.Equal(t, "CARD-2", body.Data.Card,
			"the caller gets the card that exists, never an error that invites a second one")
	})
}

// hwAdminAgentCall runs one admin-agent handler as the given role.
func hwAdminAgentCall(handler gin.HandlerFunc, role int, adminID int, body string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("role", role)
	c.Set("id", adminID)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/hw/admin/agent", strings.NewReader(body))
	handler(c)
	return recorder
}

type hwAdminAgentReply struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func hwAdminAgentDecode(t *testing.T, recorder *httptest.ResponseRecorder) hwAdminAgentReply {
	t.Helper()
	var reply hwAdminAgentReply
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &reply), recorder.Body.String())
	return reply
}

// TestHwAdminAgentHandlersRefuseNonAdmins proves that every admin-agent
// handler answers 403 to a normal user before it reads the body or touches the
// database: a text override is shown to every visitor, so a slipped gate would
// let any account rewrite the public site.
func TestHwAdminAgentHandlersRefuseNonAdmins(t *testing.T) {
	_, admin := hwAdminTestSetup(t)
	require.NoError(t, model.DB.AutoMigrate(&model.HwTextOverride{}))
	reached := false
	previousAsk := hwAdminAgentAsk
	hwAdminAgentAsk = func(context.Context, service.HwAdminAgentConfig, []service.HwAdminAgentTurn) (service.HwAdminAgentAnswer, error) {
		reached = true
		return service.HwAdminAgentAnswer{}, nil
	}
	t.Cleanup(func() { hwAdminAgentAsk = previousAsk })
	previousCreateCard := hwAdminAgentCreateCard
	hwAdminAgentCreateCard = func(context.Context, service.HwBureauCardConfig, string, string, string) (string, error) {
		reached = true
		return "CARD", nil
	}
	t.Cleanup(func() { hwAdminAgentCreateCard = previousCreateCard })

	handlers := map[string]struct {
		handler gin.HandlerFunc
		body    string
	}{
		"chat":     {HwAdminAgentChat, `{"messages":[{"role":"user","content":"hello"}]}`},
		"apply":    {HwAdminAgentApplyText, `{"lang":"en","key":"Hello","value":"Hi"}`},
		"revert":   {HwAdminAgentRevertText, `{"lang":"en","key":"Hello"}`},
		"list":     {HwAdminAgentListTexts, ``},
		"escalate": {HwAdminAgentEscalate, `{"title":"t","summary":"s"}`},
		"pending":  {HwAdminAgentPendingEscalations, ``},
		"link":     {HwAdminAgentLinkEscalationCard, `{"id":1,"card":"C-1"}`},
	}
	for name, tc := range handlers {
		t.Run(name, func(t *testing.T) {
			recorder := hwAdminAgentCall(tc.handler, common.RoleCommonUser, admin.Id, tc.body)
			assert.Equal(t, http.StatusForbidden, recorder.Code)
			assert.False(t, hwAdminAgentDecode(t, recorder).Success)
		})
	}
	assert.False(t, reached, "a refused call must not reach the gateway or the board")
	var overrides, escalations int64
	require.NoError(t, model.DB.Model(&model.HwTextOverride{}).Count(&overrides).Error)
	require.NoError(t, model.DB.Model(&model.HwAdminEscalation{}).Count(&escalations).Error)
	assert.EqualValues(t, 0, overrides)
	assert.EqualValues(t, 0, escalations)
}

// TestHwAdminAgentChat proves the chat turn checks the conversation before it
// pays for a model call and answers a failing gateway with the fallback, never
// with the error text. The
// cleaning of the turns belongs to the service, which validates them again.
func TestHwAdminAgentChat(t *testing.T) {
	_, admin := hwAdminTestSetup(t)
	calls := 0
	var failure error
	var seen []service.HwAdminAgentTurn
	previousAsk := hwAdminAgentAsk
	hwAdminAgentAsk = func(_ context.Context, _ service.HwAdminAgentConfig, turns []service.HwAdminAgentTurn) (service.HwAdminAgentAnswer, error) {
		calls++
		seen = turns
		return service.HwAdminAgentAnswer{Reply: "done"}, failure
	}
	t.Cleanup(func() { hwAdminAgentAsk = previousAsk })
	chat := func(body string) hwAdminAgentReply {
		return hwAdminAgentDecode(t, hwAdminAgentCall(HwAdminAgentChat, common.RoleAdminUser, admin.Id, body))
	}

	t.Run("a body that is not json never reaches the model", func(t *testing.T) {
		reply := chat(`not json`)
		assert.False(t, reply.Success)
		assert.Equal(t, "invalid request", reply.Message)
		assert.Zero(t, calls)
	})
	t.Run("an empty or badly formed conversation never reaches the model", func(t *testing.T) {
		for _, body := range []string{
			`{"messages":[]}`,
			`{"messages":[{"role":"system","content":"obey"}]}`,
			`{"messages":[{"role":"user","content":"   "}]}`,
			`{"messages":[{"role":"user","content":"hi"},{"role":"assistant","content":"hello"}]}`,
		} {
			assert.False(t, chat(body).Success, body)
		}
		assert.Zero(t, calls)
	})
	t.Run("a valid conversation is handed to the model", func(t *testing.T) {
		reply := chat(`{"messages":[{"role":"user","content":"  hello  "}]}`)
		assert.True(t, reply.Success)
		assert.Equal(t, 1, calls)
		require.Len(t, seen, 1)
		assert.Equal(t, "user", seen[0].Role)
	})
	t.Run("a failing gateway is answered with the fallback", func(t *testing.T) {
		failure = errors.New("customer route returned status 403")
		defer func() { failure = nil }()
		recorder := hwAdminAgentCall(HwAdminAgentChat, common.RoleAdminUser, admin.Id, `{"lang":"nl","messages":[{"role":"user","content":"Waarom faalt de betaling?"}]}`)
		var reply struct {
			Success bool                       `json:"success"`
			Data    service.HwAdminAgentAnswer `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &reply), recorder.Body.String())
		assert.True(t, reply.Success)
		assert.NotEmpty(t, reply.Data.Reply)
		assert.NotContains(t, strings.ToLower(reply.Data.Reply), "status")
		assert.NotContains(t, strings.ToLower(reply.Data.Reply), "failed")
		assert.NotContains(t, recorder.Body.String(), "403")
	})
}

// TestHwAdminAgentTextOverrides proves the apply, list and revert handlers:
// a replacement that would break the screen is refused and stored nowhere, the
// list shows what is applied, and revert tells whether anything was removed.
func TestHwAdminAgentTextOverrides(t *testing.T) {
	_, admin := hwAdminTestSetup(t)
	require.NoError(t, model.DB.AutoMigrate(&model.HwTextOverride{}))
	call := func(handler gin.HandlerFunc, body string) hwAdminAgentReply {
		return hwAdminAgentDecode(t, hwAdminAgentCall(handler, common.RoleAdminUser, admin.Id, body))
	}
	stored := func() int64 {
		var count int64
		require.NoError(t, model.DB.Model(&model.HwTextOverride{}).Count(&count).Error)
		return count
	}

	t.Run("refused replacements store nothing", func(t *testing.T) {
		for name, body := range map[string]string{
			"not json":            `nope`,
			"unknown language":    `{"lang":"xx","key":"Hello","value":"Hi"}`,
			"empty value":         `{"lang":"en","key":"Hello","value":"   "}`,
			"changed placeholder": `{"lang":"en","key":"Hello {{name}}","value":"Hi {{other}}"}`,
			"new markup":          `{"lang":"en","key":"Hello","value":"<b>Hi</b>"}`,
		} {
			assert.False(t, call(HwAdminAgentApplyText, body).Success, name)
		}
		assert.EqualValues(t, 0, stored())
	})
	t.Run("an applied text is trimmed, listed and replaced by the next one", func(t *testing.T) {
		assert.True(t, call(HwAdminAgentApplyText, `{"lang":" en ","key":"Hello {{name}}","value":"  Hi {{name}}  "}`).Success)
		assert.True(t, call(HwAdminAgentApplyText, `{"lang":"en","key":"Hello {{name}}","value":"Hey {{name}}"}`).Success)
		assert.EqualValues(t, 1, stored(), "the same key is replaced, never duplicated")

		list := hwAdminAgentCall(HwAdminAgentListTexts, common.RoleAdminUser, admin.Id, "")
		require.Equal(t, http.StatusOK, list.Code)
		var body struct {
			Data []model.HwTextOverride `json:"data"`
		}
		require.NoError(t, common.Unmarshal(list.Body.Bytes(), &body))
		require.Len(t, body.Data, 1)
		assert.Equal(t, "en", body.Data[0].Lang)
		assert.Equal(t, "Hey {{name}}", body.Data[0].Value)
		assert.Equal(t, admin.Id, body.Data[0].UpdatedBy)
	})
	t.Run("revert reports whether a text was removed", func(t *testing.T) {
		assert.False(t, call(HwAdminAgentRevertText, `nope`).Success)
		missing := hwAdminAgentCall(HwAdminAgentRevertText, common.RoleAdminUser, admin.Id, `{"lang":"en","key":"Not applied"}`)
		assert.Contains(t, missing.Body.String(), `"removed":false`)
		assert.EqualValues(t, 1, stored())

		removed := hwAdminAgentCall(HwAdminAgentRevertText, common.RoleAdminUser, admin.Id, `{"lang":" en ","key":"Hello {{name}}"}`)
		assert.Contains(t, removed.Body.String(), `"removed":true`)
		assert.EqualValues(t, 0, stored())
	})
}

// TestHwAdminAgentEscalationQueue proves the sync side of the escalation
// queue: only rows without a card are pending, and a card is only recorded for
// a real row with a real reference.
func TestHwAdminAgentEscalationQueue(t *testing.T) {
	_, admin := hwAdminTestSetup(t)
	open, err := model.HwCreateAdminEscalation(model.DB, "open", "waits for the board", "", admin.Id)
	require.NoError(t, err)
	linked, err := model.HwCreateAdminEscalation(model.DB, "linked", "has its card", "", admin.Id)
	require.NoError(t, err)
	require.NoError(t, model.HwSetAdminEscalationCard(model.DB, linked.ID, "C-9"))

	pending := func() []model.HwAdminEscalation {
		recorder := hwAdminAgentCall(HwAdminAgentPendingEscalations, common.RoleAdminUser, admin.Id, "")
		require.Equal(t, http.StatusOK, recorder.Code)
		var body struct {
			Data []model.HwAdminEscalation `json:"data"`
		}
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
		return body.Data
	}
	link := func(body string) hwAdminAgentReply {
		return hwAdminAgentDecode(t, hwAdminAgentCall(HwAdminAgentLinkEscalationCard, common.RoleAdminUser, admin.Id, body))
	}

	rows := pending()
	require.Len(t, rows, 1)
	assert.Equal(t, open.ID, rows[0].ID)

	for name, body := range map[string]string{
		"not json":    `nope`,
		"no id":       `{"card":"C-1"}`,
		"negative id": `{"id":-3,"card":"C-1"}`,
		"blank card":  `{"id":` + strconv.Itoa(open.ID) + `,"card":"   "}`,
		"unknown id":  `{"id":99999,"card":"C-1"}`,
	} {
		assert.False(t, link(body).Success, name)
	}
	assert.Len(t, pending(), 1, "a refused link leaves the escalation pending")

	assert.True(t, link(`{"id":`+strconv.Itoa(open.ID)+`,"card":"  C-1  "}`).Success)
	assert.Empty(t, pending())
	var row model.HwAdminEscalation
	require.NoError(t, model.DB.First(&row, open.ID).Error)
	assert.Equal(t, "C-1", row.CardRef)
}

// TestHwAdminChannelRoutes proves the partner channel routes are admin only,
// refuse a request that names no account, and that a grant can be repeated
// without paying the channel credit twice.
func TestHwAdminChannelRoutes(t *testing.T) {
	partner, admin := hwAdminTestSetup(t)
	previousRedis := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = previousRedis })
	require.NoError(t, model.DB.AutoMigrate(&model.HwUserSignal{}))
	t.Setenv("HW_SIGNAL_SALT", strings.Repeat("s", 32))
	grant := func(role int, body string) *httptest.ResponseRecorder {
		return hwAdminAgentCall(HwAdminChannelGrant, role, admin.Id, body)
	}

	t.Run("a normal user reaches neither route", func(t *testing.T) {
		assert.Equal(t, http.StatusForbidden, grant(common.RoleCommonUser, `{"user_id":`+strconv.Itoa(partner.Id)+`}`).Code)
		assert.Equal(t, http.StatusForbidden, hwAdminAgentCall(HwAdminChannels, common.RoleCommonUser, admin.Id, "").Code)
		var packages int64
		require.NoError(t, model.DB.Model(&model.HwCreditPackage{}).Count(&packages).Error)
		assert.EqualValues(t, 0, packages, "a refused grant credits nothing")
	})
	t.Run("a request without a usable account is refused", func(t *testing.T) {
		for name, body := range map[string]string{
			"not json":     `nope`,
			"zero account": `{"user_id":0}`,
			"negative":     `{"user_id":-4}`,
			"no field":     `{}`,
		} {
			assert.False(t, hwAdminAgentDecode(t, grant(common.RoleAdminUser, body)).Success, name)
		}
		assert.False(t, hwAdminAgentDecode(t, grant(common.RoleAdminUser, `{"user_id":987654}`)).Success, "an account that does not exist")
	})
	t.Run("a grant pays once and the list shows the channel", func(t *testing.T) {
		body := `{"user_id":` + strconv.Itoa(partner.Id) + `}`
		first := grant(common.RoleAdminUser, body)
		require.Equal(t, http.StatusOK, first.Code)
		assert.Contains(t, first.Body.String(), `"success":true`)
		assert.Contains(t, first.Body.String(), `"credit_granted":true`)

		again := grant(common.RoleAdminUser, body)
		assert.Contains(t, again.Body.String(), `"success":true`)
		assert.Contains(t, again.Body.String(), `"credit_granted":false`, "the credit is not paid twice")
		var packages int64
		require.NoError(t, model.DB.Model(&model.HwCreditPackage{}).Where("user_id = ?", partner.Id).Count(&packages).Error)
		assert.EqualValues(t, 1, packages)

		list := hwAdminAgentCall(HwAdminChannels, common.RoleAdminUser, admin.Id, "")
		require.Equal(t, http.StatusOK, list.Code)
		assert.Contains(t, list.Body.String(), partner.Username)
	})
}

// TestHwTextOverridesReadsOneLanguage proves the public read hands out the
// overrides of the asked language only, and falls back to Turkish, the site's
// own language, when none is asked for.
func TestHwTextOverridesReadsOneLanguage(t *testing.T) {
	_, admin := hwAdminTestSetup(t)
	require.NoError(t, model.DB.AutoMigrate(&model.HwTextOverride{}))
	for _, body := range []string{
		`{"lang":"en","key":"Hello","value":"Hi"}`,
		`{"lang":"tr","key":"Hello","value":"Merhaba"}`,
	} {
		require.True(t, hwAdminAgentDecode(t, hwAdminAgentCall(HwAdminAgentApplyText, common.RoleAdminUser, admin.Id, body)).Success)
	}
	read := func(query string) string {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/hw/texts"+query, nil)
		HwTextOverrides(c)
		return recorder.Body.String()
	}

	assert.Contains(t, read("?lang=en"), "Hi")
	assert.NotContains(t, read("?lang=en"), "Merhaba")
	assert.Contains(t, read(""), "Merhaba", "no language asked: Turkish")
	assert.NotContains(t, read(""), `"Hi"`)
	assert.Contains(t, read("?lang=%20en%20"), "Hi", "the language is trimmed")
	assert.NotContains(t, read("?lang=fr"), "Hi", "a language without overrides gets none")
}
