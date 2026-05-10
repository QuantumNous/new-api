package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// AdminListReconcileHourly handles GET /api/reconcile/admin/list.
// Paginated viewer for the reconcile_hourly table — used by the admin
// reconcile management page to inspect aggregated rows by channel + date
// range. The export endpoint serves the unpaged xlsx download separately.
func AdminListReconcileHourly(c *gin.Context) {
	var req dto.ListReconcileHourlyRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if req.Page <= 0 {
		req.Page = 1
	}
	if req.PageSize <= 0 {
		req.PageSize = 20
	}
	rows, total, err := model.ListReconcileHourlyPaged(
		req.ChannelId, req.From, req.To, req.ModelName, req.Page, req.PageSize,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	// "金额合计" Tag at the top of the admin reconcile page — sums across all
	// matching rows for the current filter, not just the current page. The user
	// can pick "本月"/"上月" via the date range picker if they want to compare.
	filtered, err := model.ReconcileHourlyStat(req.ChannelId, req.From, req.To, req.ModelName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
		"total":   total,
		"stat": gin.H{
			"filtered_amount_cny": filtered,
		},
	})
}

// AdminExportReconcileMonth handles GET /api/reconcile/admin/export.
// The reconcile module's only user-facing function: download our aggregated
// monthly bill (organised by hour × model × token_type, mirroring the supplier
// invoice format) so the admin can manually compare it against the supplier's
// own bill in Excel. The system itself never sees the supplier numbers.
func AdminExportReconcileMonth(c *gin.Context) {
	var req dto.ExportReconcileRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if req.Format == "" {
		req.Format = "xlsx"
	}

	channel, err := model.GetChannelById(req.ChannelId, false)
	if err != nil || channel == nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "渠道不存在"})
		return
	}

	adminId := c.GetInt("id")
	channelName := channel.Name

	if req.Format == "csv" {
		data, rowCount, err := service.ExportMonthCSV(req.ChannelId, req.Month, req.ModelName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
			return
		}
		filename := fmt.Sprintf("reconcile_%s_%s.csv", channelName, req.Month)
		model.RecordLog(adminId, model.LogTypeManage,
			fmt.Sprintf("导出对账账单 [reconcile_export] (channel_id=%d, month=%s, rows=%d)", req.ChannelId, req.Month, rowCount))
		c.Header("Content-Disposition", buildAttachmentDisposition(filename))
		c.Data(http.StatusOK, "text/csv; charset=utf-8", data)
		return
	}

	data, rowCount, err := service.ExportMonthXLSX(req.ChannelId, channelName, req.Month, req.ModelName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": err.Error()})
		return
	}
	filename := fmt.Sprintf("reconcile_%s_%s.xlsx", channelName, req.Month)
	model.RecordLog(adminId, model.LogTypeManage,
		fmt.Sprintf("导出对账账单 [reconcile_export] (channel_id=%d, month=%s, rows=%d)", req.ChannelId, req.Month, rowCount))
	c.Header("Content-Disposition", buildAttachmentDisposition(filename))
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data)
}

// buildAttachmentDisposition produces an RFC 5987 compliant Content-Disposition
// header that handles non-ASCII filenames (e.g. Chinese channel names) on every
// browser. The plain filename= field is sanitised as an ASCII fallback for
// legacy clients; filename*= carries the UTF-8 percent-encoded original.
func buildAttachmentDisposition(filename string) string {
	asciiFallback := strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7F || r == '"' || r == '\\' {
			return '_'
		}
		if r > 0x7F {
			return '_'
		}
		return r
	}, filename)
	return fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`,
		asciiFallback, url.PathEscape(filename))
}
