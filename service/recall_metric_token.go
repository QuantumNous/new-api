package service

import (
	"context"
	"crypto/hmac"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const (
	recallMetricTokenVersion = 2
	recallMetricTokenTTL     = 15 * time.Minute
)

var ErrRecallMetricStaleSnapshot = errors.New("recall metric snapshot is stale")
var errRecallMetricExportByteLimit = errors.New("recall metric export byte limit exceeded")

type recallMetricTokenClaims struct {
	Version                int                   `json:"v"`
	Kind                   string                `json:"kind"`
	CampaignID             int64                 `json:"campaign_id"`
	Metric                 model.RecallMetricKey `json:"metric"`
	AsOf                   int64                 `json:"as_of"`
	RecipientMaxID         int64                 `json:"recipient_max_id"`
	FactEventMaxID         int64                 `json:"fact_event_max_id"`
	MessageStateEventMaxID int64                 `json:"message_state_event_max_id"`
	ExclusionMaxID         int64                 `json:"exclusion_max_id"`
	CampaignRunEventMaxID  int64                 `json:"campaign_run_event_max_id"`
	TopUpMaxID             int64                 `json:"top_up_max_id"`
	SubscriptionOrderMaxID int64                 `json:"subscription_order_max_id"`
	FilterHash             string                `json:"filter_hash"`
	RowGrain               string                `json:"row_grain"`
	ExpiresAt              int64                 `json:"expires_at"`
	CursorSortTime         int64                 `json:"cursor_sort_time,omitempty"`
	CursorRowID            int64                 `json:"cursor_row_id,omitempty"`
}

type RecallMetricPage struct {
	Items                   []model.RecallMetricRow    `json:"items"`
	Total                   int64                      `json:"total"`
	AmountMinorByCurrency   map[string]int64           `json:"-"`
	Amounts                 []RecallMetricAmount       `json:"amounts"`
	Snapshot                model.RecallMetricSnapshot `json:"-"`
	SnapshotToken           string                     `json:"snapshot"`
	NextCursor              string                     `json:"next_cursor,omitempty"`
	LegacyUnidentifiedCount int64                      `json:"legacy_unidentified_count"`
	DrilldownComplete       bool                       `json:"drilldown_complete"`
}

type RecallMetricAmount struct {
	Currency    string `json:"currency"`
	AmountMinor int64  `json:"amount_minor"`
	UserCount   int64  `json:"user_count"`
}

type RecallMetricExportLimits struct {
	MaxRows   int64
	MaxBytes  int64
	BatchSize int
}

type RecallMetricExportResult struct {
	Rows      int64
	Bytes     int64
	Truncated bool
}

var DefaultRecallMetricExportLimits = RecallMetricExportLimits{MaxRows: 50_000, MaxBytes: 10 * 1024 * 1024, BatchSize: 500}

var RecallMetricExportLogHook func(campaignID int64, metric model.RecallMetricKey, filterHash string, rowCount int64, truncated bool)

func QueryRecallMetric(ctx context.Context, query model.RecallMetricQuery, now time.Time) (RecallMetricPage, error) {
	entry, ok := model.RecallMetricEntry(query.Metric)
	if !ok {
		return RecallMetricPage{}, fmt.Errorf("%w: unsupported metric", model.ErrRecallMetricBadRequest)
	}
	result, err := model.QueryRecallMetricRows(ctx, query)
	if err != nil {
		return RecallMetricPage{}, err
	}
	query.Snapshot = result.Snapshot
	snapshotToken, err := SignRecallMetricSnapshotToken(query, entry.RowGrain, now.Add(recallMetricTokenTTL))
	if err != nil {
		return RecallMetricPage{}, err
	}
	next := ""
	if result.NextCursor.SortTime != 0 || result.NextCursor.RowID != 0 {
		query.Cursor = result.NextCursor
		next, err = SignRecallMetricCursorToken(query, entry.RowGrain, now.Add(recallMetricTokenTTL))
		if err != nil {
			return RecallMetricPage{}, err
		}
	}
	return RecallMetricPage{
		Items:                   result.Rows,
		Total:                   result.Total,
		AmountMinorByCurrency:   result.AmountMinorByCurrency,
		Amounts:                 recallMetricAmountsFromResult(result.AmountMinorByCurrency, result.AmountUserCountByCurrency),
		Snapshot:                result.Snapshot,
		SnapshotToken:           snapshotToken,
		NextCursor:              next,
		LegacyUnidentifiedCount: result.LegacyUnidentifiedCount,
		DrilldownComplete:       result.DrilldownComplete,
	}, nil
}

func SignRecallMetricSnapshotToken(query model.RecallMetricQuery, rowGrain string, expiresAt time.Time) (string, error) {
	return signRecallMetricToken(query, rowGrain, "snapshot", expiresAt, model.RecallMetricCursor{})
}

func SignRecallMetricCursorToken(query model.RecallMetricQuery, rowGrain string, expiresAt time.Time) (string, error) {
	return signRecallMetricToken(query, rowGrain, "cursor", expiresAt, query.Cursor)
}

func VerifyRecallMetricSnapshotToken(token string, query model.RecallMetricQuery, rowGrain string, now time.Time) (model.RecallMetricSnapshot, error) {
	claims, err := verifyRecallMetricToken(token, query, rowGrain, "snapshot", now)
	if err != nil {
		return model.RecallMetricSnapshot{}, err
	}
	return snapshotFromRecallMetricClaims(claims), nil
}

func VerifyRecallMetricCursorToken(token string, query model.RecallMetricQuery, rowGrain string, now time.Time) (model.RecallMetricCursor, error) {
	claims, err := verifyRecallMetricToken(token, query, rowGrain, "cursor", now)
	if err != nil {
		return model.RecallMetricCursor{}, err
	}
	if query.Snapshot.AsOf == 0 || snapshotFromRecallMetricClaims(claims) != query.Snapshot {
		return model.RecallMetricCursor{}, ErrRecallMetricStaleSnapshot
	}
	return model.RecallMetricCursor{SortTime: claims.CursorSortTime, RowID: claims.CursorRowID}, nil
}

func ExportRecallMetricCSV(ctx context.Context, writer io.Writer, query model.RecallMetricQuery, now time.Time) error {
	_, err := ExportRecallMetricCSVWithLimits(ctx, writer, query, now, DefaultRecallMetricExportLimits)
	return err
}

func ExportRecallMetricCSVWithLimits(ctx context.Context, writer io.Writer, query model.RecallMetricQuery, now time.Time, limits RecallMetricExportLimits) (RecallMetricExportResult, error) {
	if limits.MaxRows <= 0 {
		limits.MaxRows = DefaultRecallMetricExportLimits.MaxRows
	}
	if limits.MaxBytes <= 0 {
		limits.MaxBytes = DefaultRecallMetricExportLimits.MaxBytes
	}
	if limits.BatchSize <= 0 || limits.BatchSize > 500 {
		limits.BatchSize = DefaultRecallMetricExportLimits.BatchSize
	}
	if query.Limit <= 0 || query.Limit > 500 {
		query.Limit = limits.BatchSize
	}
	query.Limit = min(query.Limit, limits.BatchSize)
	const byteLimitMarker = "truncated=true reason=byte_limit"
	countingMaxBytes := limits.MaxBytes
	if countingMaxBytes > int64(len("# "+byteLimitMarker+"\n")) {
		countingMaxBytes -= int64(len("# " + byteLimitMarker + "\n"))
	}
	counting := &recallMetricCountingWriter{Writer: writer, maxBytes: countingMaxBytes}
	result := RecallMetricExportResult{}
	filterHash, _ := model.RecallMetricFilterHash(query)
	defer func() {
		if RecallMetricExportLogHook != nil {
			RecallMetricExportLogHook(query.CampaignID, query.Metric, filterHash, result.Rows, result.Truncated)
		}
	}()
	query.Cursor = model.RecallMetricCursor{}
	if query.Snapshot.AsOf == 0 {
		snapshotResult, err := model.StreamRecallMetricRows(ctx, query, limits.BatchSize, nil)
		if err != nil {
			return result, err
		}
		query.Snapshot = snapshotResult.Snapshot
	}
	headerWritten := false
	writeHeader := func() error {
		if headerWritten {
			return nil
		}
		if err := writeRecallMetricCSVRow(counting, []string{"campaign_id", "metric_key", "snapshot_as_of", "recipient_max_id", "row_id", "user_id", "recipient_id", "message_id", "email", "occurred_at", "stage_no", "state", "conversion_kind", "trade_no", "payment_category", "currency", "amount_minor", "failure_code"}); err != nil {
			return err
		}
		headerWritten = true
		return nil
	}
	_, err := model.StreamRecallMetricRows(ctx, query, limits.BatchSize, func(row model.RecallMetricRow) (bool, error) {
		if result.Rows >= limits.MaxRows {
			result.Truncated = true
			if err := writeHeader(); err != nil {
				return false, err
			}
			if err := writeRecallMetricCSVComment(counting, "truncated=true reason=row_limit"); err != nil {
				return false, err
			}
			result.Bytes = counting.bytes
			return false, nil
		}
		if err := writeHeader(); err != nil {
			return false, err
		}
		values := []string{
			strconv.FormatInt(query.CampaignID, 10),
			string(query.Metric),
			strconv.FormatInt(query.Snapshot.AsOf, 10),
			strconv.FormatInt(query.Snapshot.RecipientMaxID, 10),
			strconv.FormatInt(row.RowID, 10),
			strconv.Itoa(row.UserID),
			strconv.FormatInt(row.RecipientID, 10),
			strconv.FormatInt(row.MessageID, 10),
			row.Email,
			strconv.FormatInt(row.OccurredAt, 10),
			strconv.Itoa(row.StageNo),
			row.State,
			row.ConversionKind,
			row.TradeNo,
			row.PaymentCategory,
			row.Currency,
			strconv.FormatInt(row.AmountMinor, 10),
			row.FailureCode,
		}
		if err := writeRecallMetricCSVRow(counting, values); err != nil {
			if errors.Is(err, errRecallMetricExportByteLimit) {
				result.Truncated = true
				counting.maxBytes = limits.MaxBytes
				markerErr := writeRecallMetricCSVComment(counting, byteLimitMarker)
				if markerErr != nil {
					return false, markerErr
				}
				result.Bytes = counting.bytes
				return false, nil
			}
			return false, err
		}
		result.Rows++
		return true, nil
	})
	if err != nil {
		return result, err
	}
	if !headerWritten {
		if err := writeHeader(); err != nil {
			return result, err
		}
	}
	result.Bytes = counting.bytes
	return result, nil
}

func signRecallMetricToken(query model.RecallMetricQuery, rowGrain string, kind string, expiresAt time.Time, cursor model.RecallMetricCursor) (string, error) {
	filterHash, err := model.RecallMetricFilterHash(query)
	if err != nil {
		return "", err
	}
	if query.Snapshot.AsOf <= 0 || query.Snapshot.RecipientMaxID < 0 || query.Snapshot.FactEventMaxID < 0 || query.Snapshot.MessageStateEventMaxID < 0 || query.Snapshot.ExclusionMaxID < 0 || query.Snapshot.CampaignRunEventMaxID < 0 || query.Snapshot.TopUpMaxID < 0 || query.Snapshot.SubscriptionOrderMaxID < 0 {
		return "", ErrRecallMetricStaleSnapshot
	}
	claims := recallMetricTokenClaims{
		Version:                recallMetricTokenVersion,
		Kind:                   kind,
		CampaignID:             query.CampaignID,
		Metric:                 query.Metric,
		AsOf:                   query.Snapshot.AsOf,
		RecipientMaxID:         query.Snapshot.RecipientMaxID,
		FactEventMaxID:         query.Snapshot.FactEventMaxID,
		MessageStateEventMaxID: query.Snapshot.MessageStateEventMaxID,
		ExclusionMaxID:         query.Snapshot.ExclusionMaxID,
		CampaignRunEventMaxID:  query.Snapshot.CampaignRunEventMaxID,
		TopUpMaxID:             query.Snapshot.TopUpMaxID,
		SubscriptionOrderMaxID: query.Snapshot.SubscriptionOrderMaxID,
		FilterHash:             filterHash,
		RowGrain:               strings.TrimSpace(rowGrain),
		ExpiresAt:              expiresAt.Unix(),
		CursorSortTime:         cursor.SortTime,
		CursorRowID:            cursor.RowID,
	}
	payload, err := common.Marshal(claims)
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(payload)
	return encoded + "." + common.GenerateHMAC(encoded), nil
}

func verifyRecallMetricToken(token string, query model.RecallMetricQuery, rowGrain string, kind string, now time.Time) (recallMetricTokenClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return recallMetricTokenClaims{}, ErrRecallMetricStaleSnapshot
	}
	expected := common.GenerateHMAC(parts[0])
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return recallMetricTokenClaims{}, ErrRecallMetricStaleSnapshot
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return recallMetricTokenClaims{}, ErrRecallMetricStaleSnapshot
	}
	var claims recallMetricTokenClaims
	if err := common.Unmarshal(payload, &claims); err != nil {
		return recallMetricTokenClaims{}, ErrRecallMetricStaleSnapshot
	}
	filterHash, err := model.RecallMetricFilterHash(query)
	if err != nil {
		return recallMetricTokenClaims{}, err
	}
	if claims.Version != recallMetricTokenVersion ||
		claims.Kind != kind ||
		claims.CampaignID != query.CampaignID ||
		claims.Metric != query.Metric ||
		claims.FilterHash != filterHash ||
		claims.RowGrain != strings.TrimSpace(rowGrain) ||
		claims.AsOf <= 0 ||
		claims.ExpiresAt <= 0 ||
		now.Unix() >= claims.ExpiresAt ||
		claims.AsOf > now.Unix()+300 ||
		claims.RecipientMaxID < 0 ||
		claims.FactEventMaxID < 0 ||
		claims.MessageStateEventMaxID < 0 ||
		claims.ExclusionMaxID < 0 ||
		claims.CampaignRunEventMaxID < 0 ||
		claims.TopUpMaxID < 0 ||
		claims.SubscriptionOrderMaxID < 0 {
		return recallMetricTokenClaims{}, ErrRecallMetricStaleSnapshot
	}
	return claims, nil
}

func snapshotFromRecallMetricClaims(claims recallMetricTokenClaims) model.RecallMetricSnapshot {
	return model.RecallMetricSnapshot{
		AsOf:                   claims.AsOf,
		RecipientMaxID:         claims.RecipientMaxID,
		FactEventMaxID:         claims.FactEventMaxID,
		MessageStateEventMaxID: claims.MessageStateEventMaxID,
		ExclusionMaxID:         claims.ExclusionMaxID,
		CampaignRunEventMaxID:  claims.CampaignRunEventMaxID,
		TopUpMaxID:             claims.TopUpMaxID,
		SubscriptionOrderMaxID: claims.SubscriptionOrderMaxID,
	}
}

func writeRecallMetricCSVRow(writer io.Writer, values []string) error {
	var b strings.Builder
	for i, value := range values {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(csvEscapeRecallMetricCell(value))
	}
	b.WriteByte('\n')
	_, err := io.WriteString(writer, b.String())
	return err
}

func writeRecallMetricCSVComment(writer io.Writer, value string) error {
	_, err := io.WriteString(writer, "# "+value+"\n")
	return err
}

type recallMetricCountingWriter struct {
	io.Writer
	maxBytes int64
	bytes    int64
}

func (writer *recallMetricCountingWriter) Write(p []byte) (int, error) {
	if writer.maxBytes > 0 && writer.bytes+int64(len(p)) > writer.maxBytes {
		return 0, errRecallMetricExportByteLimit
	}
	n, err := writer.Writer.Write(p)
	writer.bytes += int64(n)
	return n, err
}

func recallMetricAmountsFromResult(amountMinor map[string]int64, userCounts map[string]int64) []RecallMetricAmount {
	currencies := make([]string, 0, len(amountMinor))
	for currency := range amountMinor {
		currencies = append(currencies, currency)
	}
	sort.Strings(currencies)
	amounts := make([]RecallMetricAmount, 0, len(currencies))
	for _, currency := range currencies {
		amounts = append(amounts, RecallMetricAmount{Currency: currency, AmountMinor: amountMinor[currency], UserCount: userCounts[currency]})
	}
	return amounts
}

func csvEscapeRecallMetricCell(value string) string {
	value = formulaSafeRecallMetricCell(value)
	needsQuote := strings.ContainsAny(value, "\",\r\n")
	if !needsQuote {
		return value
	}
	return `"` + strings.ReplaceAll(value, `"`, `""`) + `"`
}

func formulaSafeRecallMetricCell(value string) string {
	trimmed := strings.TrimLeft(value, " \t\r\n")
	if trimmed == "" {
		return value
	}
	switch trimmed[0] {
	case '=', '+', '-', '@':
		return "'" + value
	default:
		return value
	}
}

func mustRecallMetricRowGrain(key model.RecallMetricKey) string {
	entry, ok := model.RecallMetricEntry(key)
	if !ok {
		return ""
	}
	return entry.RowGrain
}
