package controller

import (
	"embed"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/jung-kurt/gofpdf/v2"
)

// DejaVuSans covers the Vietnamese glyphs (đ, ₫) used in the report.
//
//go:embed assets/fonts/DejaVuSans.ttf assets/fonts/DejaVuSans-Bold.ttf
var reportFonts embed.FS

const (
	reportFontRegular = "dejavu"
	reportFontBold    = "dejavu-bold"
)

type mezonTopUpReportItem struct {
	TransactionId int64  `json:"transaction_id"`
	TxHash        string `json:"tx_hash"`
	UserId        int    `json:"user_id"`
	UserName      string `json:"user_name"`
	UserEmail     string `json:"user_email"`
	Amount        int64  `json:"amount"`
	CompleteTime  int64  `json:"complete_time"`
}

// ExportMezonTopUpReport returns successful Mezon đồng top-ups for a calendar
// month. Admin only. Query params: year, month. Default response is JSON;
// pass format=pdf for a downloadable PDF statement.
func ExportMezonTopUpReport(c *gin.Context) {
	year, err1 := strconv.Atoi(c.Query("year"))
	month, err2 := strconv.Atoi(c.Query("month"))
	if err1 != nil || err2 != nil || year < 2020 || year > 2100 || month < 1 || month > 12 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "invalid year/month"})
		return
	}

	loc := time.Local
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, loc)
	end := start.AddDate(0, 1, 0)

	rows, err := model.GetMezonTopUpReport(start.Unix(), end.Unix())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]mezonTopUpReportItem, 0, len(rows))
	var total int64
	for _, row := range rows {
		name := row.DisplayName
		if name == "" {
			name = row.Username
		}
		items = append(items, mezonTopUpReportItem{
			TransactionId: row.Id,
			TxHash:        strings.TrimPrefix(row.TradeNo, "mezon:"),
			UserId:        row.UserId,
			UserName:      name,
			UserEmail:     row.Email,
			Amount:        row.Dong,
			CompleteTime:  row.CompleteTime,
		})
		total += row.Dong
	}

	if c.Query("format") != "pdf" {
		common.ApiSuccess(c, gin.H{
			"year":              year,
			"month":             month,
			"items":             items,
			"transaction_count": len(items),
			"total_amount":      total,
		})
		return
	}

	pdf := gofpdf.New("L", "mm", "A4", "")
	regular, err := reportFonts.ReadFile("assets/fonts/DejaVuSans.ttf")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	bold, err := reportFonts.ReadFile("assets/fonts/DejaVuSans-Bold.ttf")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pdf.AddUTF8FontFromBytes(reportFontRegular, "", regular)
	pdf.AddUTF8FontFromBytes(reportFontBold, "", bold)

	pdf.SetTitle(fmt.Sprintf("Mezon Dong Top-up Report %d-%02d", year, month), true)
	pdf.AddPage()

	// Header
	pdf.SetFont(reportFontBold, "", 16)
	pdf.Cell(0, 10, "Mezon Đồng Top-up Report")
	pdf.Ln(8)
	pdf.SetFont(reportFontRegular, "", 11)
	pdf.Cell(0, 7, fmt.Sprintf("Period: %d-%02d", year, month))
	pdf.Ln(7)
	pdf.Cell(0, 7, fmt.Sprintf("Generated: %s", time.Now().In(loc).Format("2006-01-02 15:04")))
	pdf.Ln(12)

	// Table header
	headers := []string{"Transaction ID", "Tx Hash", "Mezon User", "Email", "Amount (đồng)", "Time"}
	widths := []float64{20, 105, 35, 62, 30, 25}
	pdf.SetFont(reportFontBold, "", 9)
	pdf.SetFillColor(238, 238, 250)
	for i, h := range headers {
		pdf.CellFormat(widths[i], 8, h, "1", 0, "L", true, 0, "")
	}
	pdf.Ln(-1)

	// Rows
	pdf.SetFont(reportFontRegular, "", 8)
	for _, item := range items {
		ts := time.Unix(item.CompleteTime, 0).In(loc).Format("01-02 15:04")
		cells := []string{
			strconv.FormatInt(item.TransactionId, 10),
			item.TxHash,
			truncate(pdf, item.UserName, widths[2]),
			truncate(pdf, item.UserEmail, widths[3]),
			formatDong(item.Amount),
			ts,
		}
		// New page when near the bottom margin
		if pdf.GetY() > 185 {
			pdf.AddPage()
			pdf.SetFont(reportFontBold, "", 9)
			for j, h := range headers {
				pdf.CellFormat(widths[j], 8, h, "1", 0, "L", true, 0, "")
			}
			pdf.Ln(-1)
			pdf.SetFont(reportFontRegular, "", 8)
		}
		for j, cell := range cells {
			align := "L"
			if j == 0 || j == 4 {
				align = "R"
			}
			pdf.CellFormat(widths[j], 7, cell, "1", 0, align, false, 0, "")
		}
		pdf.Ln(-1)
	}

	// Total row
	pdf.SetFont(reportFontBold, "", 10)
	pdf.Ln(4)
	pdf.Cell(0, 8, fmt.Sprintf("Total: %s đồng  (%d transactions)", formatDong(total), len(items)))

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="mezon-topup-%d-%02d.pdf"`, year, month))
	if err := pdf.Output(c.Writer); err != nil {
		common.SysError("mezon report pdf output error: " + err.Error())
	}
}

// formatDong renders an integer đồng amount with thousands separators.
func formatDong(v int64) string {
	s := strconv.FormatInt(v, 10)
	neg := strings.HasPrefix(s, "-")
	if neg {
		s = s[1:]
	}
	var b strings.Builder
	for i, ch := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(ch)
	}
	if neg {
		return "-" + b.String()
	}
	return b.String()
}

// truncate shortens a string to fit the column width at the current font size.
func truncate(pdf *gofpdf.Fpdf, s string, maxWidth float64) string {
	if pdf.GetStringWidth(s) <= maxWidth-2 {
		return s
	}
	runes := []rune(s)
	for len(runes) > 0 && pdf.GetStringWidth(string(runes)+"…") > maxWidth-2 {
		runes = runes[:len(runes)-1]
	}
	return string(runes) + "…"
}
