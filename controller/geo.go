package controller

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

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
		country := common.LookupCountryByIP(ip)
		if country == "" {
			return
		}
		if err := model.DB.Model(&model.User{}).Where("id = ?", userId).
			Update("country", country).Error; err != nil {
			common.SysLog(fmt.Sprintf("updateUserCountry failed user_id=%d: %v", userId, err))
		}
	}()
}
