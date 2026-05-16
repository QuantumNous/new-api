package service

import (
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"
)

// SupplierBillRow is one parsed line from the supplier's xlsx (parallel 科技
// today, others later). One xlsx row = one (model, hour bucket, region,
// token kind) combination.
type SupplierBillRow struct {
	Model         string
	BucketStart   int64  // unix sec, "账单开始时间"
	BucketEnd     int64  // unix sec, "账单结束时间" — this is the hour_bucket key
	Region        string // 北京一区 / 上海一区 / ... (sum-collapsed at compare time)
	TokenKind     string // input/output/cache_write/cache_read/count/unknown
	Tokens        int64
	AmountCNY     float64 // 费用(元) + 服务费(元)
	Settled       bool
	RawTokenLabel string // e.g. "缓存存储" — used when TokenKind == "unknown"
}

// ParseError describes one xlsx row that couldn't be parsed. The whole file
// parses on a best-effort basis; up to ReconcileParseErrorCap errors are
// retained, the rest are counted only.
type ParseError struct {
	Row    int
	Reason string
}

// Cap on the number of detailed parse errors returned to the UI.
const ReconcileParseErrorCap = 50

// Cap on total rows in one upload to prevent runaway memory.
const ReconcileMaxRows = 100000

var (
	// 配置描述: "<类别>:<带千分位数字><tokens|个>" — colon may be Chinese full-width.
	configDescPattern = regexp.MustCompile(`^([^:：]+)[:：]\s*([\d,]+)\s*(tokens|个)$`)

	// 表头别名 → 内部列名。多语种 / 未来表头变体在此扩展。
	headerAliases = map[string]string{
		"模型":     "model",
		"配置描述":   "config",
		"站点":     "region",
		"账单开始时间": "bucket_start",
		"账单结束时间": "bucket_end",
		"费用(元)":  "amount",
		"服务费(元)": "service_fee",
		"结算状态":   "settled",
	}

	// 配置描述前缀 → 我方字段。新增前缀在此追加。
	// 并行实测使用的 label 含义（按 5-15 完整样本核对）：
	//   - 输入：常规 prompt tokens（不含命中缓存的部分）
	//   - 输出：completion tokens
	//   - 缓存存储：cache write（按存储时长计费）
	//   - 缓存输入：cache read 命中（实际是供应商的官方叫法，最常见）
	//   - 缓存读取 / 缓存命中：cache read 的别名（不同供应商口径，保留以防其他渠道使用）
	tokenKindMap = map[string]string{
		"输入":   "input",
		"输出":   "output",
		"缓存存储": "cache_write",
		"缓存输入": "cache_read",
		"缓存读取": "cache_read",
		"缓存命中": "cache_read",
		"个":    "count",
	}
)

// ParseParallelBill reads the supplier xlsx from r and returns the parsed
// rows + per-row parse errors (best-effort). An error return means the file
// itself was unreadable; partial-row issues go into the errors slice instead.
func ParseParallelBill(r io.Reader) ([]SupplierBillRow, []ParseError, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, nil, fmt.Errorf("打开 xlsx 失败: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, nil, fmt.Errorf("xlsx 不含任何工作表")
	}
	sheet := sheets[0]

	rows, err := f.GetRows(sheet)
	if err != nil {
		return nil, nil, fmt.Errorf("读取工作表 %q 失败: %w", sheet, err)
	}
	if len(rows) == 0 {
		return nil, nil, fmt.Errorf("工作表 %q 为空", sheet)
	}

	// First row: header — build column-name → index map.
	headerRow := rows[0]
	colIdx := map[string]int{}
	for i, cell := range headerRow {
		name := strings.TrimSpace(cell)
		if internal, ok := headerAliases[name]; ok {
			colIdx[internal] = i
		}
	}
	required := []string{"model", "config", "bucket_start", "bucket_end", "amount"}
	for _, key := range required {
		if _, ok := colIdx[key]; !ok {
			return nil, nil, fmt.Errorf("xlsx 缺少必填列（请确认账单格式未变）：%s", reverseAlias(key))
		}
	}

	dataRows := rows[1:]
	if len(dataRows) > ReconcileMaxRows {
		return nil, nil, fmt.Errorf("xlsx 行数 %d 超出上限 %d，请按月切分后再上传", len(dataRows), ReconcileMaxRows)
	}

	out := make([]SupplierBillRow, 0, len(dataRows))
	errs := make([]ParseError, 0)
	errsTruncated := 0

	for i, row := range dataRows {
		rowNum := i + 2 // 1-based + header
		parsed, perr := parseOneRow(row, colIdx)
		if perr != nil {
			if len(errs) < ReconcileParseErrorCap {
				errs = append(errs, ParseError{Row: rowNum, Reason: perr.Error()})
			} else {
				errsTruncated++
			}
			continue
		}
		out = append(out, parsed)
		// Surface unknown token labels as warnings: the row's amount still
		// counts toward the supplier total, but its token quantity is
		// dropped at compare time, so the admin needs to know that the
		// supplier added a label we don't recognise (e.g. 新功能:1234tokens).
		if parsed.TokenKind == "unknown" {
			if len(errs) < ReconcileParseErrorCap {
				errs = append(errs, ParseError{
					Row:    rowNum,
					Reason: fmt.Sprintf("未识别 token 类别 %q（金额已计入对账，tokens 未分类）", parsed.RawTokenLabel),
				})
			} else {
				errsTruncated++
			}
		}
	}

	if errsTruncated > 0 {
		errs = append(errs, ParseError{
			Row:    0,
			Reason: fmt.Sprintf("另有 %d 行解析失败未展示", errsTruncated),
		})
	}

	return out, errs, nil
}

func reverseAlias(internal string) string {
	for k, v := range headerAliases {
		if v == internal {
			return k
		}
	}
	return internal
}

func parseOneRow(row []string, colIdx map[string]int) (SupplierBillRow, error) {
	get := func(key string) string {
		i, ok := colIdx[key]
		if !ok || i >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[i])
	}

	model := get("model")
	if model == "" {
		return SupplierBillRow{}, fmt.Errorf("模型列为空")
	}

	configDesc := get("config")
	kind, tokens, rawLabel, err := parseConfigDesc(configDesc)
	if err != nil {
		return SupplierBillRow{}, fmt.Errorf("配置描述无法解析: %q (%v)", configDesc, err)
	}

	bucketStart, err := parseBillTime(get("bucket_start"))
	if err != nil {
		return SupplierBillRow{}, fmt.Errorf("账单开始时间无法解析: %v", err)
	}
	bucketEnd, err := parseBillTime(get("bucket_end"))
	if err != nil {
		return SupplierBillRow{}, fmt.Errorf("账单结束时间无法解析: %v", err)
	}

	amount, err := parseFloat(get("amount"))
	if err != nil {
		return SupplierBillRow{}, fmt.Errorf("费用列无法解析: %v", err)
	}
	if fee, ferr := parseFloat(get("service_fee")); ferr == nil {
		amount += fee
	}

	return SupplierBillRow{
		Model:         model,
		BucketStart:   bucketStart,
		BucketEnd:     bucketEnd,
		Region:        get("region"),
		TokenKind:     kind,
		Tokens:        tokens,
		AmountCNY:     amount,
		Settled:       get("settled") == "已结算",
		RawTokenLabel: rawLabel,
	}, nil
}

func parseConfigDesc(s string) (kind string, tokens int64, rawLabel string, err error) {
	if s == "" {
		return "", 0, "", fmt.Errorf("空")
	}
	m := configDescPattern.FindStringSubmatch(s)
	if m == nil {
		return "", 0, "", fmt.Errorf("格式不符合 `<类别>:<数字><tokens|个>`")
	}
	label := strings.TrimSpace(m[1])
	numStr := strings.ReplaceAll(m[2], ",", "")
	unit := m[3]
	n, perr := strconv.ParseInt(numStr, 10, 64)
	if perr != nil {
		return "", 0, "", fmt.Errorf("数字 %q 无效", m[2])
	}
	// Unit is the authoritative classification signal: anything counted in
	// "个" is per-item billing regardless of the label (供应商可能写"图像:3个"、
	// "视频:3个" 等 label 变体)。label 仅当 unit 是 tokens 时作为细分依据。
	if unit == "个" {
		kind = "count"
	} else if k, ok := tokenKindMap[label]; ok {
		kind = k
	} else {
		kind = "unknown"
	}
	return kind, n, label, nil
}

// parseBillTime accepts the two forms excelize hands back: a formatted
// "2006-01-02 15:04:05" string, or an Excel serial number string. Returns
// unix seconds in the supplier's timezone (Asia/Shanghai).
func parseBillTime(s string) (int64, error) {
	if s == "" {
		return 0, fmt.Errorf("空")
	}
	// Try the common formatted forms first.
	for _, layout := range []string{
		"2006-01-02 15:04:05",
		"2006/01/02 15:04:05",
		"2006-01-02 15:04",
	} {
		if t, err := time.ParseInLocation(layout, s, shanghaiLoc); err == nil {
			return t.Unix(), nil
		}
	}
	// Fall back to Excel serial (rare path; excelize usually formats first).
	if serial, err := strconv.ParseFloat(s, 64); err == nil {
		t, err := excelize.ExcelDateToTime(serial, false)
		if err == nil {
			// excelize returns the local-zoneless time; reinterpret in Shanghai.
			t = time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, shanghaiLoc)
			return t.Unix(), nil
		}
	}
	return 0, fmt.Errorf("无法解析时间 %q", s)
}

func parseFloat(s string) (float64, error) {
	if s == "" {
		return 0, nil
	}
	return strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
}
