package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/gin-gonic/gin"
)

func TestApplyPlaygroundGroupOverrideSupportsImageGenerationReusableBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := `{"model":"gpt-image-1","group":"vip","prompt":"a clean product photo","size":"1024x1024","quality":"auto","n":1,"response_format":"url"}`
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")

	usingGroup, err := applyPlaygroundGroupOverride(c, "default")
	if err != nil {
		t.Fatalf("applyPlaygroundGroupOverride returned error: %v", err)
	}
	if usingGroup != "vip" {
		t.Fatalf("usingGroup = %q, want vip", usingGroup)
	}
	if got := common.GetContextKeyString(c, constant.ContextKeyUsingGroup); got != "vip" {
		t.Fatalf("ContextKeyUsingGroup = %q, want vip", got)
	}
	if got := common.GetContextKeyString(c, constant.ContextKeyTokenGroup); got != "vip" {
		t.Fatalf("ContextKeyTokenGroup = %q, want vip", got)
	}

	request, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
	if err != nil {
		t.Fatalf("GetAndValidOpenAIImageRequest after group override returned error: %v", err)
	}
	if request.Model != "gpt-image-1" {
		t.Fatalf("request.Model = %q, want gpt-image-1", request.Model)
	}
	if request.Prompt != "a clean product photo" {
		t.Fatalf("request.Prompt = %q, want original prompt", request.Prompt)
	}
	if request.ResponseFormat != "url" {
		t.Fatalf("request.ResponseFormat = %q, want url", request.ResponseFormat)
	}
	if request.N == nil || *request.N != 1 {
		t.Fatalf("request.N = %v, want 1", request.N)
	}

	var raw dto.PlayGroundRequest
	if err := common.UnmarshalBodyReusable(c, &raw); err != nil {
		t.Fatalf("UnmarshalBodyReusable after image validation returned error: %v", err)
	}
	if raw.Group != "vip" || raw.Model != "gpt-image-1" {
		t.Fatalf("re-read playground request = %+v, want group/model preserved", raw)
	}
}

func TestApplyPlaygroundGroupOverrideRejectsUnavailableGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)

	body := `{"model":"gpt-image-1","group":"missing","prompt":"a clean product photo"}`
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/images/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	_, err := applyPlaygroundGroupOverride(c, "default")
	if err != errPlaygroundGroupAccessDenied {
		t.Fatalf("applyPlaygroundGroupOverride error = %v, want errPlaygroundGroupAccessDenied", err)
	}
}
