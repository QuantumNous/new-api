package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	costreport "github.com/QuantumNous/new-api/service/cost_report"
	"github.com/gin-gonic/gin"
)

func costReportService() *costreport.Service {
	return costreport.NewService(model.DB, model.LOG_DB)
}

func actorID(c *gin.Context) int {
	if id, ok := c.Get("id"); ok {
		if v, ok := id.(int); ok {
			return v
		}
	}
	return 0
}

func CostReportListTemplates(c *gin.Context) {
	page, pageSize := parsePage(c)
	details, total, err := costReportService().ListTemplates(c.Request.Context(), (page-1)*pageSize, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": details, "total": total, "page": page, "page_size": pageSize})
}

func CostReportEnsureDefaultTemplate(c *gin.Context) {
	detail, err := costReportService().EnsureDefaultTemplate(c.Request.Context(), actorID(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func CostReportGetTemplate(c *gin.Context) {
	id, err := parseIDParam(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	detail, err := costReportService().GetTemplate(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func CostReportSaveTemplate(c *gin.Context) {
	var input costreport.TemplateSaveInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		common.ApiError(c, err)
		return
	}
	if idParam := c.Param("id"); idParam != "" {
		id, err := strconv.Atoi(idParam)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		input.Id = id
	}
	input.ActorID = actorID(c)
	detail, err := costReportService().SaveTemplate(c.Request.Context(), input)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func CostReportListTemplateVersions(c *gin.Context) {
	id, err := parseIDParam(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	versions, err := costReportService().ListTemplateVersions(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": versions})
}

type costReportValidateRequest struct {
	Config costreport.CostReportTemplateConfig `json:"config"`
}

func CostReportValidateTemplate(c *gin.Context) {
	var req costReportValidateRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := costreport.ValidateTemplateConfig(req.Config); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"valid": true})
}

func CostReportPreview(c *gin.Context) {
	var req costreport.PreviewRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	resp, err := costReportService().Preview(c.Request.Context(), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, resp)
}

func CostReportSaveRun(c *gin.Context) {
	var req costreport.PreviewRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Config != nil {
		common.ApiErrorMsg(c, "saving a run requires a persisted template version; preview unsaved config separately")
		return
	}
	req.IncludeManual = true
	preview, err := costReportService().Preview(c.Request.Context(), req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := costReportService().SaveRunFromPreview(c.Request.Context(), preview, actorID(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"run": result.Run, "row_count": len(result.Rows), "warnings": preview.Warnings})
}

func CostReportListRuns(c *gin.Context) {
	page, pageSize := parsePage(c)
	templateID, _ := strconv.Atoi(c.Query("template_id"))
	periodKey := c.Query("period_key")
	runs, total, err := costReportService().ListRuns(c.Request.Context(), templateID, periodKey, (page-1)*pageSize, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": runs, "total": total, "page": page, "page_size": pageSize})
}

func CostReportGetRun(c *gin.Context) {
	id, err := parseIDParam(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	detail, err := costReportService().GetRunDetail(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, detail)
}

func CostReportExportRun(c *gin.Context) {
	id, err := parseIDParam(c, "id")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	data, filename, err := costReportService().ExportRunXLSX(c.Request.Context(), id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", url.PathEscape(filename)))
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data)
}

func CostReportReadManualCells(c *gin.Context) {
	templateID, _ := strconv.Atoi(c.Query("template_id"))
	periodKey := c.Query("period_key")
	rowKeys := splitQueryList(c.Query("row_keys"))
	if rowKey := c.Query("row_key"); rowKey != "" {
		rowKeys = append(rowKeys, rowKey)
	}
	manuals, err := costReportService().ReadManualCells(c.Request.Context(), templateID, periodKey, rowKeys)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, manuals)
}

func CostReportUpsertManualCell(c *gin.Context) {
	var input costreport.ManualCellInput
	if err := common.DecodeJson(c.Request.Body, &input); err != nil {
		common.ApiError(c, err)
		return
	}
	input.UpdatedBy = actorID(c)
	cell, err := costReportService().UpsertManualCell(c.Request.Context(), input)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, cell)
}

type costReportClassificationPreviewRequest struct {
	Config   costreport.CostReportTemplateConfig `json:"config"`
	Log      model.Log                           `json:"log"`
	Channel  *model.Channel                      `json:"channel,omitempty"`
	User     *model.User                         `json:"user,omitempty"`
	LogOther map[string]interface{}              `json:"log_other,omitempty"`
}

func CostReportClassificationPreview(c *gin.Context) {
	var req costReportClassificationPreviewRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := costreport.ValidateTemplateConfig(req.Config); err != nil {
		common.ApiError(c, err)
		return
	}
	result := costreport.Classify(req.Config, costreport.ClassificationInput{
		Log:      &req.Log,
		Channel:  req.Channel,
		User:     req.User,
		LogOther: req.LogOther,
	})
	common.ApiSuccess(c, result)
}

func parseIDParam(c *gin.Context, name string) (int, error) {
	id, err := strconv.Atoi(c.Param(name))
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return id, nil
}

func parsePage(c *gin.Context) (int, int) {
	page, _ := strconv.Atoi(c.Query("p"))
	if page <= 0 {
		page, _ = strconv.Atoi(c.Query("page"))
	}
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize <= 0 {
		pageSize, _ = strconv.Atoi(c.Query("size"))
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	return page, pageSize
}

func splitQueryList(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}
