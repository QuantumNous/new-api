package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// uploadOverheadBytes — multipart boundaries + ancillary form fields
// (channel_ids, supplier, granularity) add at most a few KB on top of the
// xlsx payload. 1 MB is generous and means the ContentLength / MaxBytesReader
// gate fires only on genuinely oversized uploads, not legitimate ones.
const uploadOverheadBytes int64 = 1 * 1024 * 1024

// AdminReconcileUpload handles POST /api/reconcile/admin/upload.
// multipart/form-data fields:
//
//	file         — supplier xlsx (≤ ReconcileUploadMaxFileBytes)
//	channel_ids  — repeated/CSV form value, ints (admin's channel selection)
//	supplier     — optional, today only "parallel" is recognised
//	granularity  — optional, "hour" (default) / "day"
//
// See docs/reconciliation-upload-design.md.
func AdminReconcileUpload(c *gin.Context) {
	// Reject obviously oversized bodies before parsing anything. Gin's
	// default multipart handling would otherwise spill the entire body to
	// memory/disk before our Size check runs, defeating the limit. We
	// check Content-Length cheaply, then wrap the body in MaxBytesReader
	// as a defence against truncated/lying Content-Length headers.
	maxBody := common.ReconcileUploadMaxFileBytes + uploadOverheadBytes
	if c.Request.ContentLength > maxBody {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"success": false,
			"message": fmt.Sprintf("请求体超出上限 %d 字节", maxBody),
		})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBody)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		// MaxBytesReader surfaces as "http: request body too large" here.
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "缺少文件或文件过大: " + err.Error()})
		return
	}
	if fileHeader.Size > common.ReconcileUploadMaxFileBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"success": false,
			"message": fmt.Sprintf("文件超出上限 %d 字节", common.ReconcileUploadMaxFileBytes),
		})
		return
	}

	channelIDs, err := parseChannelIDsForm(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if len(channelIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请至少选择一个渠道"})
		return
	}

	supplier := strings.TrimSpace(c.PostForm("supplier"))
	if supplier == "" {
		supplier = "parallel"
	}
	if supplier != "parallel" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "暂不支持供应商: " + supplier,
		})
		return
	}

	granularity := strings.TrimSpace(c.PostForm("granularity"))

	f, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "打开上传文件失败: " + err.Error()})
		return
	}
	defer f.Close()

	rows, parseErrs, err := service.ParseParallelBill(f)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "账单解析失败: " + err.Error()})
		return
	}

	result, err := service.Compare(channelIDs, rows, parseErrs, granularity)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	// Audit. Use LogTypeManage so it shows up alongside other admin actions.
	auditMsg := fmt.Sprintf(
		"对账上传 [reconcile_upload] (channels=%s, rows=%d, supplier_total=¥%.2f, delta=¥%.6f, verdict=%s)",
		joinInts(channelIDs), result.Summary.RowsCount,
		result.Summary.SupplierTotal.AmountCNY,
		result.Summary.Delta.AmountCNY,
		result.DriftAnalysis.Verdict,
	)
	userID := c.GetInt("id")
	if userID > 0 {
		model.RecordLog(userID, model.LogTypeManage, auditMsg)
	} else {
		common.SysLog(auditMsg)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

// parseChannelIDsForm accepts both repeated form fields (channel_ids=1&channel_ids=2)
// and a CSV-style single value (channel_ids=1,2,7). Mirrors parseChannelIdsQuery
// in controller/log.go.
func parseChannelIDsForm(c *gin.Context) ([]int, error) {
	values := c.Request.PostForm["channel_ids"]
	if len(values) == 0 {
		if err := c.Request.ParseMultipartForm(common.ReconcileUploadMaxFileBytes + 1024); err == nil {
			values = c.Request.MultipartForm.Value["channel_ids"]
		}
	}
	out := make([]int, 0, len(values))
	for _, v := range values {
		for _, part := range strings.Split(v, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			id, err := strconv.Atoi(part)
			if err != nil {
				return nil, fmt.Errorf("channel_ids 含非整数: %q", part)
			}
			if id > 0 {
				out = append(out, id)
			}
		}
	}
	// De-duplicate, preserve order.
	seen := map[int]struct{}{}
	dedup := make([]int, 0, len(out))
	for _, id := range out {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		dedup = append(dedup, id)
	}
	_ = dto.ReconcileUploadRequest{} // keep dto import even when binding directly above
	return dedup, nil
}

func joinInts(xs []int) string {
	parts := make([]string, len(xs))
	for i, x := range xs {
		parts[i] = strconv.Itoa(x)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
