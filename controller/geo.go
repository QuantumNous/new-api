package controller

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// lookupCountryByIP calls ip-api.com and returns a 2-letter country code.
// Returns "" on private IPs, timeouts, or any error — non-critical.
func lookupCountryByIP(ip string) string {
	parsed := net.ParseIP(ip)
	if parsed == nil || parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsLinkLocalUnicast() {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		fmt.Sprintf("http://ip-api.com/json/%s?fields=countryCode", ip), nil)
	if err != nil {
		return ""
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 256))
	if err != nil {
		return ""
	}
	var result struct {
		CountryCode string `json:"countryCode"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return ""
	}
	return result.CountryCode
}

// TouchUserCountry refreshes users.country from a client IP (async, non-blocking).
func TouchUserCountry(userId int, ip string) {
	if userId == 0 || ip == "" {
		return
	}
	updateUserCountryAsync(userId, ip)
}

// updateUserCountryAsync looks up the country for ip and updates the user record.
// Runs in a background goroutine — never blocks the request.
func updateUserCountryAsync(userId int, ip string) {
	go func() {
		country := lookupCountryByIP(ip)
		if country == "" {
			return
		}
		if err := model.DB.Model(&model.User{}).Where("id = ?", userId).
			Update("country", country).Error; err != nil {
			common.SysLog(fmt.Sprintf("updateUserCountry failed user_id=%d: %v", userId, err))
		}
	}()
}
