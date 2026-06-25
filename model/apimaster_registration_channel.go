package model

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

var registrationChannelCodePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{1,63}$`)

type RegistrationChannel struct {
	Id              string    `json:"id"`
	Code            string    `json:"code"`
	Name            string    `json:"name"`
	Description     string    `json:"description"`
	LandingPath     string    `json:"landing_path"`
	Enabled         bool      `json:"enabled"`
	CreatedBy       string    `json:"created_by"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	RegisteredCount int       `json:"registered_count"`
	// Paid-conversion stats joined from new-api top_ups (per channel).
	TopupAmount int64 `json:"topup_amount"` // sum of successful top_ups (USD integer)
	PayingCount int   `json:"paying_count"` // distinct users in this channel who topped up
}

type RegistrationChannelInput struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	LandingPath string `json:"landing_path"`
	Enabled     *bool  `json:"enabled"`
}

func NormalizeRegistrationChannelCode(code string) string {
	return strings.ToLower(strings.TrimSpace(code))
}

func ValidateRegistrationChannelCode(code string) error {
	if !registrationChannelCodePattern.MatchString(code) {
		return errors.New("渠道码只能包含小写字母、数字、下划线和短横线，长度 2-64 位")
	}
	return nil
}

func EnsureApimasterRegistrationChannelSchema() error {
	if APIMASTER_PG_DB == nil {
		return errors.New("APIMASTER_PG_DSN 未配置")
	}

	statements := []string{
		`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,
		`CREATE TABLE IF NOT EXISTS registration_channels (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			code text NOT NULL UNIQUE,
			name text NOT NULL,
			description text,
			landing_path text NOT NULL DEFAULT '/register',
			enabled boolean NOT NULL DEFAULT true,
			created_by text,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_channel_code text`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_source_url text`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_utm jsonb`,
		`CREATE INDEX IF NOT EXISTS idx_users_registration_channel_code ON users (registration_channel_code)`,
		`CREATE INDEX IF NOT EXISTS idx_registration_channels_enabled ON registration_channels (enabled)`,
	}
	for _, statement := range statements {
		if err := APIMASTER_PG_DB.Exec(statement).Error; err != nil {
			return err
		}
	}
	return nil
}

func ListRegistrationChannels() ([]RegistrationChannel, error) {
	if err := EnsureApimasterRegistrationChannelSchema(); err != nil {
		return nil, err
	}

	// Show every source users actually arrived with (ch / referral / utm / referrer
	// domain / direct), plus any deliberately-named channel even with 0 regs. Rows
	// with an empty id are auto-discovered sources (no managed channel row).
	var channels []RegistrationChannel
	err := APIMASTER_PG_DB.Raw(`
		SELECT
			COALESCE(c.id::text, '') AS id,
			codes.code AS code,
			COALESCE(c.name, codes.code) AS name,
			COALESCE(c.description, '') AS description,
			COALESCE(c.landing_path, '') AS landing_path,
			COALESCE(c.enabled, true) AS enabled,
			COALESCE(c.created_by, '') AS created_by,
			COALESCE(c.created_at, now()) AS created_at,
			COALESCE(c.updated_at, now()) AS updated_at,
			COALESCE(reg.registered_count, 0) AS registered_count
		FROM (
			SELECT code FROM registration_channels
			UNION
			SELECT DISTINCT registration_channel_code
			FROM users
			WHERE registration_channel_code IS NOT NULL AND registration_channel_code <> ''
		) codes
		LEFT JOIN registration_channels c ON c.code = codes.code
		LEFT JOIN (
			SELECT registration_channel_code AS code, COUNT(*)::int AS registered_count
			FROM users
			WHERE registration_channel_code IS NOT NULL AND registration_channel_code <> ''
			GROUP BY registration_channel_code
		) reg ON reg.code = codes.code
		ORDER BY registered_count DESC, codes.code ASC
	`).Scan(&channels).Error
	if err != nil {
		return nil, err
	}

	// Merge paid-conversion stats (top_ups joined by channel). Best-effort: a
	// failure here must not break the channel list, so just log and continue.
	if stats, statErr := getChannelTopupStats(); statErr != nil {
		common.SysLog("failed to load channel topup stats: " + statErr.Error())
	} else {
		for i := range channels {
			if s := stats[channels[i].Code]; s != nil {
				channels[i].TopupAmount = s.amount
				channels[i].PayingCount = s.paying
			}
		}
	}
	return channels, nil
}

type RegistrationChannelStat struct {
	Channel         string `json:"channel"`
	RegisteredCount int    `json:"registered_count"`
	PayingCount     int    `json:"paying_count"`
	TopupAmount     int64  `json:"topup_amount"`
}

// channelDisplayExpr maps a user's raw source to its display key:
// referral -> inviter email, direct -> "direct" (frontend renders 自然流量),
// otherwise the managed channel name (if any) or the raw code.
const channelDisplayExpr = `CASE
		WHEN u.registration_channel_code = 'referral' THEN COALESCE(NULLIF(inv.email, ''), 'referral')
		WHEN u.registration_channel_code = 'direct' THEN 'direct'
		ELSE COALESCE(NULLIF(c.name, ''), u.registration_channel_code)
	END`

// ListRegistrationChannelStats aggregates registrations + paid topups per
// acquisition source over the last `days` days (registrations by created_at,
// topups by top_up.create_time, both within the window).
func ListRegistrationChannelStats(days int) ([]RegistrationChannelStat, error) {
	if err := EnsureApimasterRegistrationChannelSchema(); err != nil {
		return nil, err
	}
	if days <= 0 {
		days = 1
	}

	// 1) registrations in range, grouped by display channel.
	type regRow struct {
		Channel         string
		RegisteredCount int
	}
	var regRows []regRow
	if err := APIMASTER_PG_DB.Raw(`
		SELECT `+channelDisplayExpr+` AS channel, COUNT(*)::int AS registered_count
		FROM users u
		LEFT JOIN registration_channels c ON c.code = u.registration_channel_code
		LEFT JOIN users inv ON inv.id = u.referred_by
		WHERE u.registration_channel_code IS NOT NULL AND u.registration_channel_code <> ''
		  AND u.created_at >= now() - (? * interval '1 day')
		GROUP BY 1
	`, days).Scan(&regRows).Error; err != nil {
		return nil, err
	}

	// 2) username -> display channel for every channeled user (topup join key).
	type userChan struct {
		Username string
		Channel  string
	}
	var userChans []userChan
	if err := APIMASTER_PG_DB.Raw(`
		SELECT LEFT(REPLACE(u.id::text, '-', ''), 20) AS username, `+channelDisplayExpr+` AS channel
		FROM users u
		LEFT JOIN registration_channels c ON c.code = u.registration_channel_code
		LEFT JOIN users inv ON inv.id = u.referred_by
		WHERE u.registration_channel_code IS NOT NULL AND u.registration_channel_code <> ''
	`).Scan(&userChans).Error; err != nil {
		return nil, err
	}
	channelByUser := make(map[string]string, len(userChans))
	for _, uc := range userChans {
		channelByUser[uc.Username] = uc.Channel
	}

	// 3) successful topups in range (new-api DB), per username.
	cutoff := common.GetTimestamp() - int64(days)*86400
	type topupRow struct {
		Username string
		Amount   int64
	}
	var topups []topupRow
	if err := DB.Raw(`
		SELECT u.username AS username, COALESCE(SUM(t.amount), 0) AS amount
		FROM top_ups t JOIN users u ON u.id = t.user_id
		WHERE t.status = 'success' AND t.create_time >= ?
		GROUP BY u.username
	`, cutoff).Scan(&topups).Error; err != nil {
		return nil, err
	}

	type agg struct {
		reg    int
		paying int
		amount int64
	}
	byChannel := map[string]*agg{}
	get := func(ch string) *agg {
		a := byChannel[ch]
		if a == nil {
			a = &agg{}
			byChannel[ch] = a
		}
		return a
	}
	for _, r := range regRows {
		get(r.Channel).reg += r.RegisteredCount
	}
	for _, tp := range topups {
		ch, ok := channelByUser[tp.Username]
		if !ok || tp.Amount <= 0 {
			continue
		}
		a := get(ch)
		a.amount += tp.Amount
		a.paying++
	}

	out := make([]RegistrationChannelStat, 0, len(byChannel))
	for ch, a := range byChannel {
		out = append(out, RegistrationChannelStat{
			Channel:         ch,
			RegisteredCount: a.reg,
			PayingCount:     a.paying,
			TopupAmount:     a.amount,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].RegisteredCount != out[j].RegisteredCount {
			return out[i].RegisteredCount > out[j].RegisteredCount
		}
		return out[i].TopupAmount > out[j].TopupAmount
	})
	return out, nil
}

type channelTopupStat struct {
	amount int64
	paying int
}

// getChannelTopupStats aggregates successful top_ups per registration channel.
// top_ups live in new-api's own DB while channel attribution lives in apimaster
// PG, so the join is done in Go via the derived username key (apimaster user
// uuid with hyphens stripped, first 20 chars == new-api username).
func getChannelTopupStats() (map[string]*channelTopupStat, error) {
	if APIMASTER_PG_DB == nil {
		return map[string]*channelTopupStat{}, nil
	}

	// 1) new-api username -> summed successful top_up amount (only payers appear).
	type topupRow struct {
		Username string
		Amount   int64
	}
	var topups []topupRow
	if err := DB.Raw(`
		SELECT u.username AS username, COALESCE(SUM(t.amount), 0) AS amount
		FROM top_ups t
		JOIN users u ON u.id = t.user_id
		WHERE t.status = 'success'
		GROUP BY u.username
	`).Scan(&topups).Error; err != nil {
		return nil, err
	}
	if len(topups) == 0 {
		return map[string]*channelTopupStat{}, nil
	}
	amountByUser := make(map[string]int64, len(topups))
	for _, t := range topups {
		amountByUser[t.Username] = t.Amount
	}

	// 2) derived username -> channel code (apimaster PG).
	type userChannelRow struct {
		Username string
		Code     string
	}
	var userChannels []userChannelRow
	if err := APIMASTER_PG_DB.Raw(`
		SELECT LEFT(REPLACE(u.id::text, '-', ''), 20) AS username, u.registration_channel_code AS code
		FROM users u
		WHERE u.registration_channel_code IS NOT NULL AND u.registration_channel_code <> ''
	`).Scan(&userChannels).Error; err != nil {
		return nil, err
	}

	// 3) aggregate per channel code.
	stats := map[string]*channelTopupStat{}
	for _, uc := range userChannels {
		amount, ok := amountByUser[uc.Username]
		if !ok || amount <= 0 {
			continue
		}
		s := stats[uc.Code]
		if s == nil {
			s = &channelTopupStat{}
			stats[uc.Code] = s
		}
		s.amount += amount
		s.paying++
	}
	return stats, nil
}

func UpsertRegistrationChannel(input RegistrationChannelInput, createdBy string) (*RegistrationChannel, error) {
	if err := EnsureApimasterRegistrationChannelSchema(); err != nil {
		return nil, err
	}

	code := NormalizeRegistrationChannelCode(input.Code)
	if err := ValidateRegistrationChannelCode(code); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("渠道名称不能为空")
	}
	if len(name) > 100 {
		return nil, errors.New("渠道名称不能超过 100 个字符")
	}
	description := strings.TrimSpace(input.Description)
	if len(description) > 500 {
		return nil, errors.New("渠道说明不能超过 500 个字符")
	}
	landingPath := strings.TrimSpace(input.LandingPath)
	if landingPath == "" {
		landingPath = "/register"
	}
	if !strings.HasPrefix(landingPath, "/") {
		return nil, errors.New("落地路径必须以 / 开头")
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}

	var channel RegistrationChannel
	err := APIMASTER_PG_DB.Raw(`
		INSERT INTO registration_channels (code, name, description, landing_path, enabled, created_by)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT (code) DO UPDATE SET
			name = EXCLUDED.name,
			description = EXCLUDED.description,
			landing_path = EXCLUDED.landing_path,
			enabled = EXCLUDED.enabled,
			updated_at = now()
		RETURNING id::text AS id, code, name, COALESCE(description, '') AS description, landing_path, enabled,
			COALESCE(created_by, '') AS created_by, created_at, updated_at, 0::int AS registered_count
	`, code, name, description, landingPath, enabled, createdBy).Scan(&channel).Error
	if err != nil {
		return nil, err
	}
	return &channel, nil
}

func SetRegistrationChannelEnabled(code string, enabled bool) error {
	if err := EnsureApimasterRegistrationChannelSchema(); err != nil {
		return err
	}
	normalized := NormalizeRegistrationChannelCode(code)
	if err := ValidateRegistrationChannelCode(normalized); err != nil {
		return err
	}
	res := APIMASTER_PG_DB.Exec(
		`UPDATE registration_channels SET enabled = ?, updated_at = now() WHERE code = ?`,
		enabled,
		normalized,
	)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("渠道码 %s 不存在", normalized)
	}
	return nil
}

func EnrichUsersRegistrationChannels(users []*User) {
	if APIMASTER_PG_DB == nil || len(users) == 0 {
		return
	}
	usernames := make([]string, 0, len(users))
	for _, user := range users {
		if user != nil && user.Username != "" {
			usernames = append(usernames, user.Username)
		}
	}
	if len(usernames) == 0 {
		return
	}

	type attribution struct {
		Username        string
		ChannelCode     string
		ChannelName     string
		SourceUrl       string
		RegistrationUtm string
		InviterEmail    string
		Provider        string
	}
	var rows []attribution
	err := APIMASTER_PG_DB.Raw(`
		SELECT
			LEFT(REPLACE(u.id::text, '-', ''), 20) AS username,
			COALESCE(u.registration_channel_code, '') AS channel_code,
			COALESCE(c.name, '') AS channel_name,
			COALESCE(u.registration_source_url, '') AS source_url,
			COALESCE(u.registration_utm::text, '') AS registration_utm,
			COALESCE(inv.email, '') AS inviter_email,
			COALESCE(u.provider, '') AS provider
		FROM users u
		LEFT JOIN registration_channels c ON c.code = u.registration_channel_code
		LEFT JOIN users inv ON inv.id = u.referred_by
		WHERE LEFT(REPLACE(u.id::text, '-', ''), 20) IN ?
	`, usernames).Scan(&rows).Error
	if err != nil {
		common.SysLog("failed to enrich user registration channels: " + err.Error())
		return
	}

	byUsername := map[string]attribution{}
	for _, row := range rows {
		byUsername[row.Username] = row
	}
	for _, user := range users {
		if user == nil {
			continue
		}
		row, ok := byUsername[user.Username]
		if !ok {
			continue
		}
		user.RegistrationChannelCode = row.ChannelCode
		user.RegistrationChannelName = row.ChannelName
		user.RegistrationSourceURL = row.SourceUrl
		user.RegistrationUTM = row.RegistrationUtm
		user.RegistrationInviterEmail = row.InviterEmail
		user.RegistrationProvider = row.Provider
	}
}
