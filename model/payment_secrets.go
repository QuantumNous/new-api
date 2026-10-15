package model

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/pkg/paymentsecret"
	"github.com/smartwalle/ncrypto"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Configuration revisions are immutable. Only the dedicated migration can update
// stored ciphertext. Ordinary model fields never map plaintext into SQL.
func (c *AlipayConfig) BeforeCreate(_ *gorm.DB) error {
	c.PrivateKeyCiphertext = ""
	_, err := paymentsecret.Load()
	return err
}
func (c *WechatPayConfig) BeforeCreate(_ *gorm.DB) error {
	c.PrivateKeyCiphertext, c.APIv3KeyCiphertext = "", ""
	_, err := paymentsecret.Load()
	return err
}
func (c *AlipayConfig) BeforeUpdate(_ *gorm.DB) error {
	return errors.New("payment configuration revisions are immutable")
}
func (c *WechatPayConfig) BeforeUpdate(_ *gorm.DB) error {
	return errors.New("payment configuration revisions are immutable")
}

func (c *AlipayConfig) AfterCreate(tx *gorm.DB) error {
	ring, err := paymentsecret.Load()
	if err != nil {
		return err
	}
	c.PrivateKeyCiphertext, err = ring.Seal(c.PrivateKey, fmt.Sprintf("alipay/%d/private_key", c.ID))
	if err != nil {
		return err
	}
	return tx.Session(&gorm.Session{NewDB: true, SkipHooks: true, Logger: logger.Discard}).Model(c).Where("id = ?", c.ID).Update("private_key", c.PrivateKeyCiphertext).Error
}
func (c *WechatPayConfig) AfterCreate(tx *gorm.DB) error {
	ring, err := paymentsecret.Load()
	if err != nil {
		return err
	}
	c.PrivateKeyCiphertext, err = ring.Seal(c.PrivateKey, fmt.Sprintf("wechatpay/%d/private_key", c.ID))
	if err != nil {
		return err
	}
	c.APIv3KeyCiphertext, err = ring.Seal(c.APIv3Key, fmt.Sprintf("wechatpay/%d/apiv3_key", c.ID))
	if err != nil {
		return err
	}
	return tx.Session(&gorm.Session{NewDB: true, SkipHooks: true, Logger: logger.Discard}).Model(c).Where("id = ?", c.ID).Updates(map[string]any{"private_key": c.PrivateKeyCiphertext, "apiv3_key": c.APIv3KeyCiphertext}).Error
}
func (c *AlipayConfig) AfterFind(_ *gorm.DB) error {
	ring, err := paymentsecret.Load()
	if err != nil {
		return err
	}
	c.PrivateKey, err = ring.Open(c.PrivateKeyCiphertext, fmt.Sprintf("alipay/%d/private_key", c.ID))
	return err
}
func (c *WechatPayConfig) AfterFind(_ *gorm.DB) error {
	ring, err := paymentsecret.Load()
	if err != nil {
		return err
	}
	c.PrivateKey, err = ring.Open(c.PrivateKeyCiphertext, fmt.Sprintf("wechatpay/%d/private_key", c.ID))
	if err != nil {
		return err
	}
	c.APIv3Key, err = ring.Open(c.APIv3KeyCiphertext, fmt.Sprintf("wechatpay/%d/apiv3_key", c.ID))
	return err
}

// InitializePaymentSecrets runs before routes and background workers. Set
// PAYMENT_SECRET_MIGRATE=1 ONLY for an offline migration/rotation, after taking a
// protected backup and stopping old-version writers. Reads never accept plaintext.
func InitializePaymentSecrets(db *gorm.DB) error {
	migrate := os.Getenv("PAYMENT_SECRET_MIGRATE") == "1"
	var ring *paymentsecret.Keyring
	var err error
	if os.Getenv("PAYMENT_SECRET_KEY_FILE") != "" || migrate {
		ring, err = paymentsecret.Load()
		if err != nil {
			return err
		}
	}
	for _, target := range []struct {
		provider string
		fields   []string
	}{
		{"alipay", []string{"private_key"}},
		{"wechatpay", []string{"private_key", "apiv3_key"}},
	} {
		// Respect the configured GORM naming strategy rather than assuming table names.
		stmt := &gorm.Statement{DB: db}
		if target.provider == "alipay" {
			err = stmt.Parse(&AlipayConfig{})
		} else {
			err = stmt.Parse(&WechatPayConfig{})
		}
		if err != nil {
			return errors.New("payment configuration schema unavailable")
		}
		table := stmt.Schema.Table
		var lastID int
		for {
			var rows []struct{ ID int }
			if err := db.Table(table).Select("id").Where("id > ?", lastID).Order("id").Limit(100).Find(&rows).Error; err != nil {
				return errors.New("cannot inspect payment credentials")
			}
			if len(rows) == 0 {
				break
			}
			if ring == nil {
				return errors.New("PAYMENT_SECRET_KEY_FILE is required for existing payment configurations")
			}
			for _, row := range rows {
				err := db.Session(&gorm.Session{Logger: logger.Discard}).Transaction(func(tx *gorm.DB) error {
					var stored struct {
						ID         int
						PrivateKey string
						APIv3Key   string
					}
					if err := lockForUpdate(tx.Table(table)).Select(append([]string{"id"}, target.fields...)).Where("id = ?", row.ID).Take(&stored).Error; err != nil {
						return errors.New("cannot read payment credentials")
					}
					values := map[string]string{"private_key": stored.PrivateKey, "apiv3_key": stored.APIv3Key}
					updates := map[string]any{}
					for _, field := range target.fields {
						value := values[field]
						if value == "" {
							continue
						}
						binding := fmt.Sprintf("%s/%d/%s", target.provider, row.ID, field)
						plain := value
						if strings.HasPrefix(value, paymentsecret.Prefix) {
							plain, err = ring.Open(value, binding)
							if err != nil {
								return err
							}
							if !migrate || strings.HasPrefix(value, paymentsecret.Prefix+ring.ActiveKeyID+":") {
								continue
							}
						} else {
							if !migrate {
								return errors.New("plaintext payment credentials require explicit offline migration")
							}
							// Unknown/corrupt envelopes must never be reclassified as legacy secrets.
							if field == "private_key" {
								key, keyErr := ncrypto.DecodePrivateKey([]byte(value)).PKCS1().RSAPrivateKey()
								if keyErr != nil {
									key, keyErr = ncrypto.DecodePrivateKey([]byte(value)).PKCS8().RSAPrivateKey()
								}
								if keyErr != nil || key == nil {
									return errors.New("unrecognized legacy payment private key")
								}
							} else if len(value) != 32 {
								return errors.New("unrecognized legacy payment API key")
							}
						}
						encrypted, err := ring.Seal(plain, binding)
						if err != nil {
							return err
						}
						checked, err := ring.Open(encrypted, binding)
						if err != nil || checked != plain {
							return errors.New("payment credential migration verification failed")
						}
						updates[field] = encrypted
					}
					if len(updates) == 0 {
						return nil
					}
					if err := tx.Table(table).Where("id = ?", row.ID).Updates(updates).Error; err != nil {
						return errors.New("cannot migrate payment credentials")
					}
					return nil
				})
				if err != nil {
					return fmt.Errorf("%s configuration %d: %w", target.provider, row.ID, err)
				}
				lastID = row.ID
			}
		}
	}
	return nil
}

// PaymentSecretStatus contains only non-secret operational metadata.
type PaymentSecretStatus struct {
	KeyFileStatus    string `json:"key_file_status"`
	ActiveKeyID      string `json:"active_key_id,omitempty"`
	MigrationEnabled bool   `json:"migration_enabled"`
	Alipay           string `json:"alipay"`
	WechatPay        string `json:"wechatpay"`
	WebMoney         string `json:"webmoney"`
	Antom            string `json:"antom"`
	AntomSessions    string `json:"antom_sessions"`
}

// InspectPaymentSecrets is read-only, including when migration mode is enabled.
// Check historical revisions too, as pending orders can still reference them.
func InspectPaymentSecrets(db *gorm.DB) PaymentSecretStatus {
	status := PaymentSecretStatus{KeyFileStatus: "unconfigured", MigrationEnabled: os.Getenv("PAYMENT_SECRET_MIGRATE") == "1", Alipay: "unknown", WechatPay: "unknown", WebMoney: "unknown", Antom: "unknown", AntomSessions: "unknown"}
	if os.Getenv("PAYMENT_SECRET_KEY_FILE") == "" {
		return status
	}
	ring, err := paymentsecret.Load()
	if err != nil {
		status.KeyFileStatus = "error"
		return status
	}
	status.KeyFileStatus, status.ActiveKeyID = "ready", ring.ActiveKeyID
	for _, target := range []struct {
		provider string
		model    any
		fields   []string
		result   *string
	}{
		{"alipay", &AlipayConfig{}, []string{"id", "private_key"}, &status.Alipay},
		{"wechatpay", &WechatPayConfig{}, []string{"id", "private_key", "apiv3_key"}, &status.WechatPay},
		{"webmoney", &WebMoneyConfig{}, []string{"id", "ciphertext"}, &status.WebMoney},
		{"antom", &AntomConfig{}, []string{"id", "ciphertext"}, &status.Antom},
		{"antom/order", &AntomOrder{}, []string{"id", "session_ciphertext"}, &status.AntomSessions},
	} {
		*target.result = "empty"
		lastID := 0
		for {
			var rows []struct {
				ID                int
				PrivateKey        string
				APIv3Key          string
				Ciphertext        string
				SessionCiphertext string
			}
			err := db.Session(&gorm.Session{Logger: logger.Discard}).Model(target.model).Select(target.fields).Where("id > ?", lastID).Order("id").Limit(100).Find(&rows).Error
			if err != nil {
				*target.result = "error"
				break
			}
			if len(rows) == 0 {
				break
			}
			for _, row := range rows {
				for field, value := range map[string]string{"private_key": row.PrivateKey, "apiv3_key": row.APIv3Key, "secret": row.Ciphertext, "session": row.SessionCiphertext} {
					if value == "" {
						continue
					}
					if _, err := ring.Open(value, fmt.Sprintf("%s/%d/%s", target.provider, row.ID, field)); err != nil {
						*target.result = "error"
						break
					}
					*target.result = "verified"
				}
				if *target.result == "error" {
					break
				}
				lastID = row.ID
			}
			if *target.result == "error" {
				break
			}
		}
	}
	return status
}
