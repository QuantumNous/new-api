package controller

import (
	"errors"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAgentInvitationsBindDifferentCustomerPrices(t *testing.T) {
	r, _ := setupDrawingTests(t)
	require.NoError(t, model.DB.AutoMigrate(&model.TopUp{}))
	oldRegister, oldPassword, oldEmail, oldToken := common.RegisterEnabled, common.PasswordRegisterEnabled, common.EmailVerificationEnabled, constant.GenerateDefaultToken
	common.RegisterEnabled, common.PasswordRegisterEnabled, common.EmailVerificationEnabled, constant.GenerateDefaultToken = true, true, false, false
	t.Cleanup(func() {
		common.RegisterEnabled, common.PasswordRegisterEnabled, common.EmailVerificationEnabled, constant.GenerateDefaultToken = oldRegister, oldPassword, oldEmail, oldToken
	})
	r.POST("/register", Register)
	r.POST("/invitations", AgentInvitations)
	r.GET("/invitations", AgentInvitations)
	r.GET("/preview/:token", PreviewAgentInvitation)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 81002).Update("inviter_id", 81001).Error)
	_, err := model.UpdateAgentProfile(81001, 1, 3, true, 0, false)
	require.NoError(t, err)
	links := make([]model.AgentInvitation, 0, 2)
	ids := make([]int, 0, 2)
	for _, cents := range []int{6, 2} {
		res := httptest.NewRecorder()
		r.ServeHTTP(res, httptest.NewRequest("POST", "/invitations", strings.NewReader(fmt.Sprintf(`{"price_cents":%d,"agent_id":81002}`, cents))))
		require.Equal(t, 201, res.Code, res.Body.String())
		var link model.AgentInvitation
		require.NoError(t, common.Unmarshal(res.Body.Bytes(), &link))
		assert.EqualValues(t, 7200, link.ExpiresAt-link.CreatedAt)
		require.Len(t, link.Token, 64)
		links = append(links, link)
		res = httptest.NewRecorder()
		r.ServeHTTP(res, httptest.NewRequest("GET", "/preview/"+link.Token, nil))
		require.Equal(t, 200, res.Code, res.Body.String())
		assert.NotContains(t, res.Body.String(), "agent_id")
		res = httptest.NewRecorder()
		name := fmt.Sprintf("invited-%d", cents)
		r.ServeHTTP(res, httptest.NewRequest("POST", "/register", strings.NewReader(fmt.Sprintf(`{"username":%q,"password":"StrongTest123!","agent_invite":%q,"aff_code":"drawtwo","price_cents":1,"role":100}`, name, link.Token))))
		require.Equal(t, 200, res.Code, res.Body.String())
		assert.Contains(t, res.Body.String(), `"success":true`)
		var user model.User
		require.NoError(t, model.DB.Where("username = ?", name).First(&user).Error)
		assert.Equal(t, 81001, user.InviterId, "link owner takes precedence over stale affiliate code")
		assert.Equal(t, common.RoleCommonUser, user.Role)
		quote, err := service.ResolveAgentImageQuote(user.Id, model.AgentImageModel)
		require.NoError(t, err)
		require.NotNil(t, quote)
		assert.Equal(t, cents, quote.PriceCents)
		ids = append(ids, user.Id)
	}
	assert.NotEqual(t, links[0].Token, links[1].Token)
	_, err = model.UpdateAgentProfile(81001, 1, 5, true, 1, false)
	require.NoError(t, err)
	for i, id := range ids {
		quote, err := service.ResolveAgentImageQuote(id, model.AgentImageModel)
		require.NoError(t, err)
		require.NotNil(t, quote)
		assert.Equal(t, links[i].PriceCents, quote.PriceCents, "new agent defaults do not reprice registered customers")
	}
	legacy, err := service.ResolveAgentImageQuote(81002, model.AgentImageModel)
	require.NoError(t, err)
	require.NotNil(t, legacy)
	assert.Equal(t, 3, legacy.PriceCents, "historical customer retains original price")
	customers, count, _, err := model.AgentCustomers(81001, 0, 20)
	require.NoError(t, err)
	assert.EqualValues(t, 3, count)
	for _, customer := range customers {
		require.NotNil(t, customer.PriceCents)
	}
	res := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/invitations", nil)
	req.Header.Set("X-Test-User", "second")
	r.ServeHTTP(res, req)
	assert.Equal(t, 403, res.Code)
	for _, cents := range []int{1, 7} {
		res = httptest.NewRecorder()
		r.ServeHTTP(res, httptest.NewRequest("POST", "/invitations", strings.NewReader(fmt.Sprintf(`{"price_cents":%d}`, cents))))
		assert.Equal(t, 400, res.Code)
	}
}

func TestAgentInvitationBindingFailureRollsBackAccount(t *testing.T) {
	_, _ = setupDrawingTests(t)
	_, err := model.UpdateAgentProfile(81001, 1, 6, true, 0, false)
	require.NoError(t, err)
	link, err := model.CreateAgentInvitation(81001, 2)
	require.NoError(t, err)
	errBinding := errors.New("price storage unavailable")
	require.NoError(t, model.DB.Callback().Create().Before("gorm:create").Register("test:binding-unavailable", func(tx *gorm.DB) {
		if tx.Statement.Table == "agent_customer_prices" {
			tx.AddError(errBinding)
		}
	}))
	t.Cleanup(func() { model.DB.Callback().Create().Remove("test:binding-unavailable") })
	user := model.User{Username: "atomic-invite", Password: "StrongTest123!", Role: 1}
	assert.ErrorIs(t, user.InsertWithAgentInvitation(link.Token), errBinding)
	var count int64
	require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", user.Username).Count(&count).Error)
	assert.Zero(t, count, "a customer account must not survive without its promised price")
}

func TestAgentInvitationLimitCountsOnlyActiveLinks(t *testing.T) {
	_, _ = setupDrawingTests(t)
	_, err := model.UpdateAgentProfile(81001, 1, 6, true, 0, false)
	require.NoError(t, err)
	links := make([]model.AgentInvitation, model.AgentInvitationLimit)
	for i := range links {
		links[i] = model.AgentInvitation{Token: fmt.Sprintf("%064x", i), AgentID: 81001, PriceCents: 6, CreatedAt: time.Now().Unix(), ExpiresAt: time.Now().Unix() + 7200}
	}
	require.NoError(t, model.DB.Create(&links).Error)
	_, err = model.CreateAgentInvitation(81001, 2)
	assert.ErrorIs(t, err, model.ErrAgentInvitationLimit)
	require.NoError(t, model.DB.Model(&model.AgentInvitation{}).Where("token = ?", links[0].Token).Update("expires_at", time.Now().Unix()-1).Error)
	_, err = model.CreateAgentInvitation(81001, 2)
	require.NoError(t, err)
}

func TestAgentInvitationExpiryRejectsRegistrationButKeepsBoundPrice(t *testing.T) {
	_, _ = setupDrawingTests(t)
	_, err := model.UpdateAgentProfile(81001, 1, 6, true, 0, false)
	require.NoError(t, err)
	link, err := model.CreateAgentInvitation(81001, 2)
	require.NoError(t, err)
	user := model.User{Username: "before-expiry", Password: "StrongTest123!", Role: 1}
	require.NoError(t, user.InsertWithAgentInvitation(link.Token))
	require.NoError(t, model.DB.Model(&model.AgentInvitation{}).Where("token = ?", link.Token).Update("expires_at", time.Now().Unix()).Error)
	_, err = model.GetAgentInvitation(link.Token)
	assert.ErrorIs(t, err, model.ErrAgentInvitationExpired)
	late := model.User{Username: "after-expiry", Password: "StrongTest123!", Role: 1}
	assert.ErrorIs(t, late.InsertWithAgentInvitation(link.Token), model.ErrAgentInvitationExpired)
	var count int64
	require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", late.Username).Count(&count).Error)
	assert.Zero(t, count)
	quote, err := service.ResolveAgentImageQuote(user.Id, model.AgentImageModel)
	require.NoError(t, err)
	require.NotNil(t, quote)
	assert.Equal(t, 2, quote.PriceCents)
	_, err = model.GetAgentInvitation(strings.Repeat("f", 64))
	assert.ErrorIs(t, err, model.ErrAgentInvitationExpired)
	_, err = model.GetAgentInvitation("bad")
	assert.ErrorIs(t, err, model.ErrAgentInvitationExpired)
	active, err := model.CreateAgentInvitation(81001, 6)
	require.NoError(t, err)
	_, err = model.UpdateAgentProfile(81001, 1, 6, false, 1, false)
	require.NoError(t, err)
	_, err = model.GetAgentInvitation(active.Token)
	assert.ErrorIs(t, err, model.ErrAgentInvitationExpired)
	quote, err = service.ResolveAgentImageQuote(user.Id, model.AgentImageModel)
	require.NoError(t, err)
	assert.Nil(t, quote)
}

func TestAgentUpgradeFreezesHistoryOnceAndPlainAffiliateCannotIssueDiscount(t *testing.T) {
	_, _ = setupDrawingTests(t)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 81002).Update("inviter_id", 81001).Error)
	require.NoError(t, model.DB.Create(&model.AgentProfile{UserID: 81001, Enabled: true, PriceCents: 2, Version: 1}).Error)
	require.NoError(t, model.InitializeAgentCustomerPrices())
	require.NoError(t, model.DB.Model(&model.AgentProfile{}).Where("user_id = ?", 81001).Update("price_cents", 6).Error)
	require.NoError(t, model.InitializeAgentCustomerPrices())
	quote, err := service.ResolveAgentImageQuote(81002, model.AgentImageModel)
	require.NoError(t, err)
	require.NotNil(t, quote)
	assert.Equal(t, 2, quote.PriceCents)
	user := model.User{Username: "plain-referral", Password: "StrongTest123!", Role: 1, InviterId: 81001}
	require.NoError(t, user.Insert(81001))
	quote, err = service.ResolveAgentImageQuote(user.Id, model.AgentImageModel)
	require.NoError(t, err)
	assert.Nil(t, quote)
}
