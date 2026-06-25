package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	codexInviteReferralKey      = "codex_referral_persistent_invite"
	codexInviteDefaultUserAgent = "Codex Desktop/0.0.0 (Linux; x86_64)"
	codexInviteMaxEmails        = 5
	codexInviteDedupeTTL        = 5 * time.Minute
)

const maxCodexInviteResponseBytes int64 = 1 << 20

var codexInviteEmailPattern = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
var codexInviteTrustedHostsForTest []string

var defaultCodexInviteTrustedHosts = []string{
	"chatgpt.com",
	"chat.openai.com",
	"api.openai.com",
}

// NormalizeCodexInviteEmails accepts email input from the API/UI, supports
// common separators, deduplicates case-insensitively, and preserves first casing.
func NormalizeCodexInviteEmails(emails []string) ([]string, error) {
	result := make([]string, 0, len(emails))
	seen := make(map[string]struct{}, len(emails))
	for _, raw := range emails {
		for _, part := range strings.FieldsFunc(raw, func(r rune) bool {
			return r == ',' || r == ';' || r == '\n' || r == '\r' || r == '\t' || r == ' '
		}) {
			email := strings.TrimSpace(part)
			if email == "" {
				continue
			}
			key := strings.ToLower(email)
			if _, ok := seen[key]; ok {
				continue
			}
			if !codexInviteEmailPattern.MatchString(email) {
				return nil, fmt.Errorf("invalid email: %s", email)
			}
			seen[key] = struct{}{}
			result = append(result, email)
			if len(result) > codexInviteMaxEmails {
				return nil, fmt.Errorf("at most %d invite emails are allowed", codexInviteMaxEmails)
			}
		}
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("emails are required")
	}
	return result, nil
}

func FetchCodexInviteStatus(ctx context.Context, client *http.Client, baseURL string, accessToken string, accountID string) (statusCode int, body []byte, err error) {
	eligibilityStatus, eligibilityBody, err := fetchCodexInviteJSON(ctx, client, baseURL, accessToken, accountID, "/backend-api/referrals/invite/eligibility", map[string]string{"referral_key": codexInviteReferralKey})
	if err != nil || isCodexInviteAuthFailure(eligibilityStatus) {
		return eligibilityStatus, eligibilityBody, err
	}
	rulesStatus, rulesBody, err := fetchCodexInviteJSON(ctx, client, baseURL, accessToken, accountID, "/backend-api/wham/referrals/eligibility_rules", map[string]string{"referral_key": codexInviteReferralKey})
	if err != nil || isCodexInviteAuthFailure(rulesStatus) {
		return rulesStatus, rulesBody, err
	}

	var eligibility any
	var rules any
	statusErrors := make(map[string]any)
	if eligibilityStatus >= http.StatusOK && eligibilityStatus < http.StatusMultipleChoices {
		if err := common.Unmarshal(eligibilityBody, &eligibility); err != nil {
			statusErrors["invite_eligibility"] = "decode codex invite eligibility: " + err.Error()
		}
	} else {
		statusErrors["invite_eligibility"] = fmt.Sprintf("upstream status: %d", eligibilityStatus)
	}
	if rulesStatus >= http.StatusOK && rulesStatus < http.StatusMultipleChoices {
		if err := common.Unmarshal(rulesBody, &rules); err != nil {
			statusErrors["eligibility_rules"] = "decode codex invite eligibility rules: " + err.Error()
		}
	} else {
		statusErrors["eligibility_rules"] = fmt.Sprintf("upstream status: %d", rulesStatus)
	}

	payloadData := map[string]any{
		"referral_key":       codexInviteReferralKey,
		"invite_eligibility": eligibility,
		"eligibility_rules":  rules,
	}
	if len(statusErrors) > 0 {
		payloadData["status_errors"] = statusErrors
	}
	payload, err := common.Marshal(payloadData)
	if err != nil {
		return 0, nil, err
	}
	if len(statusErrors) > 0 {
		return http.StatusBadGateway, payload, nil
	}
	return http.StatusOK, payload, nil
}

func SendCodexInvite(ctx context.Context, client *http.Client, baseURL string, accessToken string, accountID string, emails []string) (statusCode int, body []byte, err error) {
	normalized, err := NormalizeCodexInviteEmails(emails)
	if err != nil {
		return 0, nil, err
	}
	if _, err := buildCodexInviteURL(baseURL, "/backend-api/wham/referrals/invite", nil); err != nil {
		return 0, nil, err
	}
	payload, err := common.Marshal(map[string]any{
		"referral_key": codexInviteReferralKey,
		"emails":       normalized,
	})
	if err != nil {
		return 0, nil, err
	}
	dedupeKey, dedupeAcquired, err := acquireCodexInviteDedupe(ctx, baseURL, accessToken, accountID, normalized)
	if err != nil {
		return 0, nil, err
	}
	if !dedupeAcquired {
		body, err := common.Marshal(map[string]any{
			"duplicate": true,
			"message":   "duplicate codex invite request",
		})
		if err != nil {
			return 0, nil, err
		}
		return http.StatusConflict, body, nil
	}

	statusCode, body, err = postCodexInviteJSON(ctx, client, baseURL, accessToken, accountID, "/backend-api/wham/referrals/invite", payload)
	if isCodexInviteAuthFailure(statusCode) {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		releaseCodexInviteDedupe(releaseCtx, dedupeKey)
	}
	return statusCode, body, err
}

func isCodexInviteAuthFailure(statusCode int) bool {
	return statusCode == http.StatusUnauthorized || statusCode == http.StatusForbidden
}

func acquireCodexInviteDedupe(ctx context.Context, baseURL string, accessToken string, accountID string, emails []string) (string, bool, error) {
	if !common.RedisEnabled || common.RDB == nil {
		return "", false, fmt.Errorf("codex invite dedupe is unavailable")
	}
	dedupeEmails := make([]string, 0, len(emails))
	for _, email := range emails {
		dedupeEmails = append(dedupeEmails, strings.ToLower(strings.TrimSpace(email)))
	}
	sort.Strings(dedupeEmails)
	tokenSum := sha256.Sum256([]byte(strings.TrimSpace(accessToken)))
	raw, err := common.Marshal(map[string]any{
		"account_id":          strings.TrimSpace(accountID),
		"access_token_sha256": hex.EncodeToString(tokenSum[:]),
		"base_url":            strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		"emails":              dedupeEmails,
	})
	if err != nil {
		return "", false, err
	}
	sum := sha256.Sum256(raw)
	key := "codex_invite_dedupe:" + hex.EncodeToString(sum[:])
	ok, err := common.RDB.SetNX(ctx, key, "1", codexInviteDedupeTTL).Result()
	if err != nil {
		common.SysError("acquire codex invite dedupe: " + err.Error())
		return "", false, fmt.Errorf("acquire codex invite dedupe: %w", err)
	}
	return key, ok, nil
}

func releaseCodexInviteDedupe(ctx context.Context, key string) {
	if key == "" || !common.RedisEnabled || common.RDB == nil {
		return
	}
	if err := common.RDB.Del(ctx, key).Err(); err != nil {
		common.SysError("release codex invite dedupe: " + err.Error())
	}
}

func CodexInviteRequiresRecipientConsent(body []byte) (bool, error) {
	var payload struct {
		InviteEligibility map[string]any `json:"invite_eligibility"`
	}
	if err := common.Unmarshal(body, &payload); err != nil {
		return false, err
	}
	value, ok := payload.InviteEligibility["requires_explicit_confirmation"]
	if !ok {
		return false, nil
	}
	requires, ok := value.(bool)
	if !ok {
		return false, fmt.Errorf("invalid codex invite confirmation requirement")
	}
	return requires, nil
}

func buildCodexInviteURL(baseURL, path string, query map[string]string) (string, error) {
	bu := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if bu == "" {
		return "", fmt.Errorf("empty baseURL")
	}
	u, err := url.Parse(bu + path)
	if err != nil {
		return "", err
	}
	if err := validateTrustedCodexInviteURL(u); err != nil {
		return "", err
	}
	values := u.Query()
	for key, value := range query {
		values.Set(key, value)
	}
	u.RawQuery = values.Encode()
	return u.String(), nil
}

func validateTrustedCodexInviteURL(u *url.URL) error {
	if u == nil {
		return fmt.Errorf("empty codex invite URL")
	}
	if u.Scheme != "https" {
		return fmt.Errorf("untrusted codex invite URL scheme")
	}
	if u.User != nil {
		return fmt.Errorf("untrusted codex invite URL userinfo")
	}
	host := strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))
	if host == "" {
		return fmt.Errorf("empty codex invite URL host")
	}
	if ip := net.ParseIP(host); ip != nil && isPrivateCodexInviteIP(ip) && !isTrustedCodexInviteHostForTest(host) {
		return fmt.Errorf("untrusted codex invite URL host")
	}
	if !isTrustedCodexInviteHost(host) {
		return fmt.Errorf("untrusted codex invite URL host")
	}
	return nil
}

func isPrivateCodexInviteIP(ip net.IP) bool {
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

func isTrustedCodexInviteHost(host string) bool {
	for _, trusted := range codexInviteTrustedHosts() {
		trusted = strings.ToLower(strings.TrimSpace(trusted))
		trusted = strings.TrimSuffix(trusted, ".")
		if trusted == "" {
			continue
		}
		if host == trusted || strings.HasSuffix(host, "."+trusted) {
			return true
		}
	}
	return false
}

func isTrustedCodexInviteHostForTest(host string) bool {
	for _, trusted := range codexInviteTrustedHostsForTest {
		if host == strings.ToLower(strings.TrimSpace(trusted)) {
			return true
		}
	}
	return false
}

func codexInviteTrustedHosts() []string {
	hosts := make([]string, 0, len(defaultCodexInviteTrustedHosts)+len(codexInviteTrustedHostsForTest)+4)
	hosts = append(hosts, defaultCodexInviteTrustedHosts...)
	hosts = append(hosts, codexInviteTrustedHostsForTest...)
	for _, host := range strings.Split(os.Getenv("CODEX_INVITE_TRUSTED_HOSTS"), ",") {
		if strings.TrimSpace(host) != "" {
			hosts = append(hosts, host)
		}
	}
	return hosts
}

func applyCodexInviteHeaders(req *http.Request, accessToken, accountID string) error {
	at := strings.TrimSpace(accessToken)
	aid := strings.TrimSpace(accountID)
	if at == "" {
		return fmt.Errorf("empty accessToken")
	}
	if aid == "" {
		return fmt.Errorf("empty accountID")
	}
	req.Header.Set("Authorization", "Bearer "+at)
	req.Header.Set("chatgpt-account-id", aid)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("OAI-Language", "zh-CN")
	req.Header.Set("originator", "Codex Desktop")
	req.Header.Set("User-Agent", codexInviteDefaultUserAgent)
	req.Header.Set("X-OpenAI-Attach-Auth", "1")
	req.Header.Set("X-OpenAI-Attach-Integrity-State", "1")
	return nil
}

func readCodexInviteResponse(resp *http.Response) (int, []byte, error) {
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxCodexInviteResponseBytes+1))
	if err != nil {
		return resp.StatusCode, nil, err
	}
	if int64(len(body)) > maxCodexInviteResponseBytes {
		return resp.StatusCode, nil, fmt.Errorf("codex invite response body too large")
	}
	return resp.StatusCode, body, nil
}

func fetchCodexInviteJSON(ctx context.Context, client *http.Client, baseURL, accessToken, accountID, path string, query map[string]string) (int, []byte, error) {
	if client == nil {
		return 0, nil, fmt.Errorf("nil http client")
	}
	requestURL, err := buildCodexInviteURL(baseURL, path, query)
	if err != nil {
		return 0, nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return 0, nil, err
	}
	if err := applyCodexInviteHeaders(req, accessToken, accountID); err != nil {
		return 0, nil, err
	}
	resp, err := doCodexInviteRequest(client, req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	return readCodexInviteResponse(resp)
}

func postCodexInviteJSON(ctx context.Context, client *http.Client, baseURL, accessToken, accountID, path string, payload []byte) (int, []byte, error) {
	if client == nil {
		return 0, nil, fmt.Errorf("nil http client")
	}
	requestURL, err := buildCodexInviteURL(baseURL, path, nil)
	if err != nil {
		return 0, nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(payload))
	if err != nil {
		return 0, nil, err
	}
	if err := applyCodexInviteHeaders(req, accessToken, accountID); err != nil {
		return 0, nil, err
	}
	resp, err := doCodexInviteRequest(client, req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	return readCodexInviteResponse(resp)
}

func doCodexInviteRequest(client *http.Client, req *http.Request) (*http.Response, error) {
	localClient := *client
	previousCheckRedirect := client.CheckRedirect
	localClient.CheckRedirect = func(redirectReq *http.Request, via []*http.Request) error {
		if err := validateTrustedCodexInviteURL(redirectReq.URL); err != nil {
			return err
		}
		if previousCheckRedirect != nil {
			return previousCheckRedirect(redirectReq, via)
		}
		if len(via) >= 10 {
			return fmt.Errorf("stopped after 10 redirects")
		}
		return nil
	}
	return localClient.Do(req)
}
