package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ChannelBalanceConfig is stored separately from relay credentials and is never
// serialized as part of a channel response.
type ChannelBalanceConfig struct {
	Enabled     bool   `json:"enabled"`
	BaseURL     string `json:"base_url"`
	UserID      int    `json:"user_id"`
	AccessToken string `json:"access_token"`
}

func (channel *Channel) GetBalanceConfig() (ChannelBalanceConfig, error) {
	var config ChannelBalanceConfig
	if channel.BalanceConfig == "" {
		return config, nil
	}
	if err := common.UnmarshalJsonStr(channel.BalanceConfig, &config); err != nil {
		return config, errors.New("invalid account balance configuration")
	}
	return config, nil
}

func SaveChannelBalanceConfig(id int, config ChannelBalanceConfig) error {
	// GORM error logs must not contain SQL parameters carrying account tokens.
	return DB.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)}).Transaction(func(tx *gorm.DB) error {
		var channel Channel
		if err := lockForUpdate(tx).First(&channel, id).Error; err != nil {
			return err
		}
		previous, err := channel.GetBalanceConfig()
		if err != nil {
			return err
		}
		if config.Enabled && config.AccessToken == "" {
			if config.BaseURL != previous.BaseURL || config.UserID != previous.UserID {
				return errors.New("enter an account access token when changing the upstream site or user")
			}
			config.AccessToken = previous.AccessToken
		}
		if config.Enabled && strings.TrimSpace(config.AccessToken) == "" {
			return errors.New("account access token is required")
		}
		// Disabling deletes the stored account credential.
		if !config.Enabled {
			config = ChannelBalanceConfig{}
		}
		encoded, err := common.Marshal(config)
		if err != nil {
			return err
		}
		return tx.Model(&Channel{}).Where("id = ?", id).Updates(map[string]any{
			"balance_config": string(encoded), "balance": 0,
			"balance_currency": "", "balance_updated_time": 0,
		}).Error
	})
}

// StoreAccountBalance does not mutate cached channel pointers. A configuration
// change while the query was running makes its response obsolete.
func (channel *Channel) StoreAccountBalance(balance float64, currency string) error {
	result := DB.Model(&Channel{}).Where("id = ? AND balance_config = ?", channel.Id, channel.BalanceConfig).
		Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)}).
		Updates(map[string]any{"balance": balance, "balance_currency": currency, "balance_updated_time": common.GetTimestamp()})
	if result.Error != nil {
		return errors.New("failed to store account balance")
	}
	if result.RowsAffected == 0 {
		// MySQL can report zero affected rows for an identical balance queried
		// twice in the same second. Distinguish that from a changed configuration.
		var count int64
		err := DB.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)}).
			Model(&Channel{}).Where("id = ? AND balance_config = ?", channel.Id, channel.BalanceConfig).Count(&count).Error
		if err != nil || count != 1 {
			return errors.New("account balance settings changed; query again")
		}
	}
	return nil
}
