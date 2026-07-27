package controller

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func ownedDocumentAsset(c *gin.Context) *model.PlaygroundAsset {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "invalid asset id")
		return nil
	}
	asset, err := model.GetPlaygroundAsset(id, userId)
	if err != nil {
		common.ApiErrorMsg(c, "asset not found")
		return nil
	}
	if asset.Kind != "document" {
		common.ApiErrorMsg(c, "asset is not a document")
		return nil
	}
	return asset
}

func playgroundParseDTO(assetId int, parse *model.PlaygroundDocumentParse) gin.H {
	dto := gin.H{
		"status":     parse.Status,
		"parser":     parse.Parser,
		"page_count": parse.PageCount,
	}
	switch parse.Status {
	case model.PlaygroundParseStatusDone:
		dto["text"] = parse.Text
	case model.PlaygroundParseStatusFailed:
		dto["error"] = parse.ErrorMessage
	case model.PlaygroundParseStatusNeedsOCR:
		pageURLs := make([]string, 0, parse.OcrPageCount)
		for page := 1; page <= parse.OcrPageCount; page++ {
			pageURLs = append(pageURLs, fmt.Sprintf("/api/playground/assets/%d/parse/pages/%d", assetId, page))
		}
		dto["ocr"] = gin.H{
			"model":           parse.OcrModel,
			"prompt":          service.PlaygroundParseOCRPrompt,
			"page_count":      parse.OcrPageCount,
			"page_urls":       pageURLs,
			"execution_token": parse.ExecutionToken,
		}
	}
	return dto
}

// StartPlaygroundAssetParse runs (or resumes) the server-side document parse
// for an owned asset. Native extraction is synchronous; scanned PDFs return a
// needs_ocr contract that the client executes through the normal /pg relay.
func StartPlaygroundAssetParse(c *gin.Context) {
	asset := ownedDocumentAsset(c)
	if asset == nil {
		return
	}
	var body struct {
		Group string `json:"group"`
	}
	_ = c.ShouldBindJSON(&body)
	userGroup, err := model.GetUserGroup(c.GetInt("id"), false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	group := strings.TrimSpace(body.Group)
	if group == "" {
		group = userGroup
	} else if !service.GroupInUserUsableGroups(userGroup, group) {
		common.ApiErrorMsg(c, "group is not available to this user")
		return
	}
	abilityGroups := []string{group}
	if group == "auto" {
		abilityGroups = service.GetUserAutoGroup(userGroup)
	}

	parse, err := service.RunPlaygroundDocumentParse(c.Request.Context(), asset, abilityGroups)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, playgroundParseDTO(asset.Id, parse))
}

// GetPlaygroundAssetParse returns the current parse state (used on reload to
// hydrate attachment text without re-parsing).
func GetPlaygroundAssetParse(c *gin.Context) {
	asset := ownedDocumentAsset(c)
	if asset == nil {
		return
	}
	if asset.ContentHash == "" {
		common.ApiErrorMsg(c, "document was uploaded before parsing support; please re-attach the file")
		return
	}
	parse, err := model.GetPlaygroundDocumentParseByHash(asset.ContentHash)
	if err != nil {
		common.ApiErrorMsg(c, "document has not been parsed yet")
		return
	}
	common.ApiSuccess(c, playgroundParseDTO(asset.Id, parse))
}

// ImportPlaygroundAssetParse stores the client-side OCR transcription. The
// execution token proves the caller received the OCR contract.
func ImportPlaygroundAssetParse(c *gin.Context) {
	asset := ownedDocumentAsset(c)
	if asset == nil {
		return
	}
	var body struct {
		ExecutionToken string `json:"execution_token"`
		Text           string `json:"text"`
		Error          string `json:"error"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiError(c, err)
		return
	}
	if asset.ContentHash == "" {
		common.ApiErrorMsg(c, "document has no parse contract")
		return
	}
	parse, err := model.GetPlaygroundDocumentParseByHash(asset.ContentHash)
	if err != nil {
		common.ApiErrorMsg(c, "document has no parse contract")
		return
	}
	if parse.Status != model.PlaygroundParseStatusNeedsOCR || body.ExecutionToken == "" || parse.ExecutionToken != body.ExecutionToken {
		// A concurrent import may have already completed this parse.
		if parse.Status == model.PlaygroundParseStatusDone || parse.Status == model.PlaygroundParseStatusFailed {
			common.ApiSuccess(c, playgroundParseDTO(asset.Id, parse))
			return
		}
		common.ApiErrorMsg(c, "invalid execution token")
		return
	}
	updated, err := service.CompletePlaygroundDocumentParse(parse, body.Text, strings.TrimSpace(body.Error))
	if err != nil {
		// CAS lost against a concurrent import; report the settled state.
		if settled, e := model.GetPlaygroundDocumentParseByHash(asset.ContentHash); e == nil {
			common.ApiSuccess(c, playgroundParseDTO(asset.Id, settled))
			return
		}
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, playgroundParseDTO(asset.Id, updated))
}

// GetPlaygroundAssetParsePage streams one rendered OCR page image to the
// owner (session auth, same delivery constraints as asset content).
func GetPlaygroundAssetParsePage(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.Status(http.StatusBadRequest)
		return
	}
	page, err := strconv.Atoi(c.Param("page"))
	if err != nil || page <= 0 {
		c.Status(http.StatusBadRequest)
		return
	}
	asset, err := model.GetPlaygroundAsset(id, userId)
	if err != nil || asset.Kind != "document" || asset.ContentHash == "" {
		c.Status(http.StatusNotFound)
		return
	}
	parse, err := model.GetPlaygroundDocumentParseByHash(asset.ContentHash)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	body, err := service.OpenPlaygroundParsePage(c.Request.Context(), parse, page)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	defer body.Close()
	c.Header("Content-Type", "image/jpeg")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "private, max-age=300")
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, body)
}
