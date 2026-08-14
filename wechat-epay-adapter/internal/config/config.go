package config

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
)

const VerifyModePublicKey = "public_key"

type Config struct {
	DatabaseType                string
	DatabaseDSN                 string
	ListenAddr                  string
	PublicBaseURL               string
	EpayPartnerID               string
	EpayKey                     string
	NewAPINotifyURL             string
	ReturnURLAllowlist          string
	MaxOrderAmountYuan          string
	WechatAppID                 string
	WechatMerchantID            string
	WechatCertSerial            string
	WechatPrivateKey            string
	WechatAPIV3Key              string
	WechatNotifyURL             string
	WechatVerifyMode            string
	WechatPublicKeyID           string
	WechatPublicKeyFile         string
	WechatPreviousPublicKeyID   string
	WechatPreviousPublicKeyFile string
	AdminAPIToken               string
	MetricsAPIToken             string
	TrustedProxyCIDRs           []string
	NotificationWorkers         int
	LogLevel                    string
}

func Load() (Config, error) {
	workers, err := optionalPositiveInt("NOTIFICATION_WORKERS", 2)
	if err != nil {
		return Config{}, err
	}

	config := Config{
		DatabaseType:                strings.ToLower(required("DATABASE_TYPE")),
		DatabaseDSN:                 required("DATABASE_DSN"),
		ListenAddr:                  optional("HTTP_LISTEN_ADDR", ":8080"),
		PublicBaseURL:               required("PUBLIC_BASE_URL"),
		EpayPartnerID:               required("EPAY_PARTNER_ID"),
		EpayKey:                     required("EPAY_KEY"),
		NewAPINotifyURL:             required("NEW_API_NOTIFY_URL"),
		ReturnURLAllowlist:          required("RETURN_URL_ALLOWLIST"),
		MaxOrderAmountYuan:          required("MAX_ORDER_AMOUNT_YUAN"),
		WechatAppID:                 required("WECHAT_APP_ID"),
		WechatMerchantID:            required("WECHAT_MCH_ID"),
		WechatCertSerial:            required("WECHAT_MCH_CERT_SERIAL"),
		WechatPrivateKey:            required("WECHAT_MCH_PRIVATE_KEY_FILE"),
		WechatAPIV3Key:              required("WECHAT_API_V3_KEY"),
		WechatNotifyURL:             required("WECHAT_NOTIFY_URL"),
		WechatVerifyMode:            required("WECHAT_VERIFY_MODE"),
		WechatPublicKeyID:           required("WECHAT_PUBLIC_KEY_ID"),
		WechatPublicKeyFile:         required("WECHAT_PUBLIC_KEY_FILE"),
		WechatPreviousPublicKeyID:   optional("WECHAT_PREVIOUS_PUBLIC_KEY_ID", ""),
		WechatPreviousPublicKeyFile: optional("WECHAT_PREVIOUS_PUBLIC_KEY_FILE", ""),
		AdminAPIToken:               required("ADMIN_API_TOKEN"),
		MetricsAPIToken:             required("METRICS_API_TOKEN"),
		TrustedProxyCIDRs:           optionalCSV("TRUSTED_PROXY_CIDRS"),
		NotificationWorkers:         workers,
		LogLevel:                    optional("LOG_LEVEL", "info"),
	}
	if err := config.Validate(); err != nil {
		return Config{}, err
	}
	return config, nil
}

func (c Config) Validate() error {
	for name, value := range map[string]string{
		"DATABASE_DSN":           c.DatabaseDSN,
		"EPAY_PARTNER_ID":        c.EpayPartnerID,
		"EPAY_KEY":               c.EpayKey,
		"RETURN_URL_ALLOWLIST":   c.ReturnURLAllowlist,
		"WECHAT_APP_ID":          c.WechatAppID,
		"WECHAT_MCH_ID":          c.WechatMerchantID,
		"WECHAT_MCH_CERT_SERIAL": c.WechatCertSerial,
		"WECHAT_PUBLIC_KEY_ID":   c.WechatPublicKeyID,
	} {
		if value == "" {
			return fmt.Errorf("%s is required", name)
		}
	}
	if c.DatabaseType != "sqlite" && c.DatabaseType != "mysql" && c.DatabaseType != "postgres" {
		return fmt.Errorf("DATABASE_TYPE must be sqlite, mysql, or postgres")
	}
	for name, value := range map[string]string{
		"PUBLIC_BASE_URL":    c.PublicBaseURL,
		"NEW_API_NOTIFY_URL": c.NewAPINotifyURL,
		"WECHAT_NOTIFY_URL":  c.WechatNotifyURL,
	} {
		if err := requireHTTPSURL(name, value); err != nil {
			return err
		}
	}
	amount, ok := new(big.Rat).SetString(c.MaxOrderAmountYuan)
	if !ok || amount.Sign() <= 0 {
		return errors.New("MAX_ORDER_AMOUNT_YUAN must be a positive decimal")
	}
	if c.WechatVerifyMode != VerifyModePublicKey {
		return fmt.Errorf("WECHAT_VERIFY_MODE must be %q", VerifyModePublicKey)
	}
	if len(c.WechatAPIV3Key) != 32 {
		return errors.New("WECHAT_API_V3_KEY must be 32 bytes")
	}
	if len(c.AdminAPIToken) < 32 || len(c.MetricsAPIToken) < 32 {
		return errors.New("admin and metrics API tokens must each contain at least 32 bytes")
	}
	for _, cidr := range c.TrustedProxyCIDRs {
		if _, _, err := net.ParseCIDR(cidr); err != nil {
			return fmt.Errorf("TRUSTED_PROXY_CIDRS contains invalid CIDR: %s", cidr)
		}
	}
	if err := validatePrivateKeyFile(c.WechatPrivateKey); err != nil {
		return fmt.Errorf("WECHAT_MCH_PRIVATE_KEY_FILE: %w", err)
	}
	if err := validatePublicKeyFile(c.WechatPublicKeyFile); err != nil {
		return fmt.Errorf("WECHAT_PUBLIC_KEY_FILE: %w", err)
	}
	if (c.WechatPreviousPublicKeyID == "") != (c.WechatPreviousPublicKeyFile == "") {
		return errors.New("WECHAT_PREVIOUS_PUBLIC_KEY_ID and WECHAT_PREVIOUS_PUBLIC_KEY_FILE must be configured together")
	}
	if c.WechatPreviousPublicKeyID != "" {
		if c.WechatPreviousPublicKeyID == c.WechatPublicKeyID {
			return errors.New("WECHAT_PREVIOUS_PUBLIC_KEY_ID must differ from WECHAT_PUBLIC_KEY_ID")
		}
		if err := validatePublicKeyFile(c.WechatPreviousPublicKeyFile); err != nil {
			return fmt.Errorf("WECHAT_PREVIOUS_PUBLIC_KEY_FILE: %w", err)
		}
	}
	return nil
}

func required(name string) string {
	return strings.TrimSpace(os.Getenv(name))
}

func optional(name, fallback string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	return value
}

func optionalCSV(name string) []string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return nil
	}
	return strings.Split(value, ",")
}

func optionalPositiveInt(name string, fallback int) (int, error) {
	value := optional(name, strconv.Itoa(fallback))
	result, err := strconv.Atoi(value)
	if err != nil || result < 1 || result > 32 {
		return 0, fmt.Errorf("%s must be an integer between 1 and 32", name)
	}
	return result, nil
}

func requireHTTPSURL(name, value string) error {
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil {
		return fmt.Errorf("%s must be an absolute HTTPS URL", name)
	}
	return nil
}

func validatePrivateKeyFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return errors.New("must contain PEM data")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if _, ok := key.(*rsa.PrivateKey); ok {
			return nil
		}
		return errors.New("must contain an RSA private key")
	}
	if _, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return nil
	}
	return errors.New("must contain an RSA private key")
}

func validatePublicKeyFile(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	block, _ := pem.Decode(data)
	if block == nil {
		return errors.New("must contain PEM data")
	}
	publicKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return errors.New("must contain an RSA public key")
	}
	if _, ok := publicKey.(*rsa.PublicKey); !ok {
		return errors.New("must contain an RSA public key")
	}
	return nil
}
