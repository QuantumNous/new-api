package service

// File name kept as `reconcile_supplier_parser.go` for git-history continuity;
// it now only contains the export functions. The earlier xlsx/csv supplier
// bill parser was removed once the design switched to "manual comparison" —
// the system no longer ingests supplier bills, the admin downloads our
// aggregated bill and compares it against the supplier's PDF/xlsx in Excel.

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/xuri/excelize/v2"
)

// shanghaiLoc is reused from reconcile_aggregator.go.

// tokenTypeCN maps the internal token_type enum to the Chinese label used in
// supplier bills, so the exported file matches the supplier's column format.
var tokenTypeCN = map[string]string{
	"input":          "输入",
	"cached_input":   "缓存输入",
	"cached_storage": "缓存存储",
	"output":         "输出",
	"count":          "个",
}

func formatConfigDesc(tokenType string, tokens int64) string {
	cn := tokenTypeCN[tokenType]
	if cn == "" {
		cn = tokenType
	}
	suffix := "tokens"
	if tokenType == "count" {
		suffix = "个"
	}
	return fmt.Sprintf("%s:%d%s", cn, tokens, suffix)
}

// parseMonthRange parses a "YYYY-MM" string into [from, to] unix-second
// boundaries that match the cross-month attribution rule documented in the
// aggregator (hour_bucket carries the bill end-of-hour timestamp, so a
// request at 2026-04-30 23:30 belongs to the May export).
func parseMonthRange(month string) (int64, int64, error) {
	loc := shanghaiLoc
	monthTime, err := time.ParseInLocation("2006-01", month, loc)
	if err != nil {
		return 0, 0, fmt.Errorf("month format must be YYYY-MM")
	}
	from := monthTime.Unix()
	to := monthTime.AddDate(0, 1, 0).Unix() - 1
	return from, to, nil
}

// ExportMonthXLSX builds an xlsx file listing every aggregated row for the
// given channel and month, in the supplier-bill column layout. The admin
// downloads this and lines it up against the supplier's own bill in Excel.
func ExportMonthXLSX(channelId int, channelName, month, modelFilter string) ([]byte, int, error) {
	from, to, err := parseMonthRange(month)
	if err != nil {
		return nil, 0, err
	}
	rows, err := model.ListReconcileHourlyForExport(channelId, from, to, modelFilter)
	if err != nil {
		return nil, 0, err
	}

	loc := shanghaiLoc
	f := excelize.NewFile()
	sheet := "Sheet1"
	headers := []string{
		"账单开始时间", "账单结束时间", "模型", "配置描述",
		"我方tokens", "我方金额(¥)", "请求数", "备注",
	}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheet, cell, h)
	}

	for rowIdx, r := range rows {
		y := rowIdx + 2
		startT := time.Unix(r.HourBucket-3600, 0).In(loc)
		endT := time.Unix(r.HourBucket, 0).In(loc)
		vals := []interface{}{
			startT.Format("2006-01-02 15:04:05"),
			endT.Format("2006-01-02 15:04:05"),
			r.ModelName,
			formatConfigDesc(r.TokenType, r.Tokens),
			r.Tokens,
			r.AmountCny,
			r.RequestCount,
			r.Note,
		}
		for colIdx, v := range vals {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, y)
			f.SetCellValue(sheet, cell, v)
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, 0, err
	}
	return buf.Bytes(), len(rows), nil
}

// ExportMonthCSV is the CSV equivalent — same columns, UTF-8 BOM for Excel.
func ExportMonthCSV(channelId int, month, modelFilter string) ([]byte, int, error) {
	from, to, err := parseMonthRange(month)
	if err != nil {
		return nil, 0, err
	}
	rows, err := model.ListReconcileHourlyForExport(channelId, from, to, modelFilter)
	if err != nil {
		return nil, 0, err
	}

	loc := shanghaiLoc
	var buf bytes.Buffer
	buf.Write([]byte{0xEF, 0xBB, 0xBF}) // UTF-8 BOM for Excel compatibility
	w := csv.NewWriter(&buf)
	w.Write([]string{
		"账单开始时间", "账单结束时间", "模型", "配置描述",
		"我方tokens", "我方金额(¥)", "请求数", "备注",
	})
	for _, r := range rows {
		startT := time.Unix(r.HourBucket-3600, 0).In(loc)
		endT := time.Unix(r.HourBucket, 0).In(loc)
		w.Write([]string{
			startT.Format("2006-01-02 15:04:05"),
			endT.Format("2006-01-02 15:04:05"),
			r.ModelName,
			formatConfigDesc(r.TokenType, r.Tokens),
			strconv.FormatInt(r.Tokens, 10),
			strconv.FormatFloat(r.AmountCny, 'f', 6, 64),
			strconv.Itoa(r.RequestCount),
			r.Note,
		})
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return nil, 0, err
	}
	return buf.Bytes(), len(rows), nil
}
