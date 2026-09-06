package controller

import (
	"bytes"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDrawingTemplatesPersistAndBelongToTheirOwner(t *testing.T) {
	r, _ := setupDrawingTests(t)
	require.NoError(t, model.DB.AutoMigrate(&model.DrawingTemplate{}))
	r.GET("/templates", ListDrawingTemplates)
	r.POST("/templates", SaveDrawingTemplate)
	r.PUT("/templates/:id", SaveDrawingTemplate)
	r.DELETE("/templates/:id", DeleteDrawingTemplate)
	request := func(method, path, body string, second bool) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if second {
			req.Header.Set("X-Test-User", "second")
		}
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)
		return res
	}
	res := request("POST", "/templates", `{"name":"Product template","prompt":"Product: [name]\nRequirements: [details]"}`, false)
	require.Equal(t, 200, res.Code, res.Body.String())
	assert.NotContains(t, res.Body.String(), "user_id")
	var saved model.DrawingTemplate
	require.NoError(t, common.Unmarshal(res.Body.Bytes(), &saved))
	assert.Equal(t, "Product: [name]\nRequirements: [details]", saved.Prompt)
	assert.JSONEq(t, "[]", request("GET", "/templates", "", true).Body.String())
	assert.Equal(t, 404, request("PUT", "/templates/"+saved.ID, `{"name":"Other","prompt":"Other"}`, true).Code)
	assert.Equal(t, 404, request("DELETE", "/templates/"+saved.ID, "", true).Code)
	res = request("PUT", "/templates/"+saved.ID, `{"name":"Updated template","prompt":"Updated reusable prompt"}`, false)
	require.Equal(t, 200, res.Code)
	// Expiring generated images must never expire reusable templates.
	require.NoError(t, service.CleanupDrawings(service.DrawingNow()+86401))
	res = request("GET", "/templates", "", false)
	require.Equal(t, 200, res.Code)
	assert.Contains(t, res.Header().Get("Cache-Control"), "no-store")
	var listed []model.DrawingTemplate
	require.NoError(t, common.Unmarshal(res.Body.Bytes(), &listed))
	require.Len(t, listed, 1)
	assert.Equal(t, saved.ID, listed[0].ID)
	assert.Equal(t, "Updated reusable prompt", listed[0].Prompt)
	assert.Equal(t, 200, request("DELETE", "/templates/"+saved.ID, "", false).Code)
	assert.JSONEq(t, "[]", request("GET", "/templates", "", false).Body.String())
}

func TestDrawingTemplateLimits(t *testing.T) {
	_, _ = setupDrawingTests(t)
	require.NoError(t, model.DB.AutoMigrate(&model.DrawingTemplate{}))
	_, err := model.SaveDrawingTemplate(81001, "", "", "x")
	assert.ErrorIs(t, err, model.ErrInvalidDrawingTemplate)
	_, err = model.SaveDrawingTemplate(81001, "", strings.Repeat("图", 81), "x")
	assert.ErrorIs(t, err, model.ErrInvalidDrawingTemplate)
	_, err = model.SaveDrawingTemplate(81001, "", "Name", string(bytes.Repeat([]byte("x"), 16001)))
	assert.ErrorIs(t, err, model.ErrInvalidDrawingTemplate)
	for i := 0; i < 20; i++ {
		_, err = model.SaveDrawingTemplate(81001, "", "Name", "Prompt")
		require.NoError(t, err)
	}
	_, err = model.SaveDrawingTemplate(81001, "", "Name", "Prompt")
	assert.ErrorIs(t, err, model.ErrDrawingTemplateLimit)
	_, err = model.SaveDrawingTemplate(81002, "", "Name", "Prompt")
	assert.NoError(t, err)
}
