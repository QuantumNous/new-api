package service

import (
	"errors"
	"net"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type BytePlusRealPersonAssetsConfig struct {
	Enabled             bool   `json:"enabled"`
	TOSBucket           string `json:"tos_bucket"`
	TOSRegion           string `json:"tos_region"`
	TOSInternalEndpoint string `json:"tos_internal_endpoint"`
}

type BytePlusCredentials struct {
	APIKey           string                         `json:"api_key"`
	AccessKeyID      string                         `json:"access_key_id"`
	SecretAccessKey  string                         `json:"secret_access_key"`
	ProjectName      string                         `json:"project_name"`
	RealPersonAssets BytePlusRealPersonAssetsConfig `json:"real_person_assets"`
}

func ParseBytePlusCredentials(raw string) (BytePlusCredentials, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return BytePlusCredentials{}, errors.New("byteplus api key is required")
	}
	if !looksLikeJSON(trimmed) {
		return BytePlusCredentials{APIKey: trimmed}, nil
	}

	var creds BytePlusCredentials
	if err := common.Unmarshal([]byte(trimmed), &creds); err != nil {
		return BytePlusCredentials{}, errors.New("invalid byteplus credential json")
	}
	creds.APIKey = strings.TrimSpace(creds.APIKey)
	creds.AccessKeyID = strings.TrimSpace(creds.AccessKeyID)
	creds.SecretAccessKey = strings.TrimSpace(creds.SecretAccessKey)
	creds.ProjectName = strings.TrimSpace(creds.ProjectName)
	creds.RealPersonAssets.TOSBucket = strings.TrimSpace(creds.RealPersonAssets.TOSBucket)
	creds.RealPersonAssets.TOSRegion = strings.TrimSpace(creds.RealPersonAssets.TOSRegion)
	creds.RealPersonAssets.TOSInternalEndpoint = strings.TrimSpace(creds.RealPersonAssets.TOSInternalEndpoint)
	if err := creds.ValidateVideo(); err != nil {
		return BytePlusCredentials{}, err
	}
	return creds, nil
}

func (c BytePlusCredentials) ValidateVideo() error {
	if c.APIKey == "" {
		return errors.New("byteplus api_key is required")
	}
	return nil
}

func (c BytePlusCredentials) ValidateAssets() error {
	if err := c.ValidateVideo(); err != nil {
		return err
	}
	if c.AccessKeyID == "" {
		return errors.New("byteplus access_key_id is required")
	}
	if c.SecretAccessKey == "" {
		return errors.New("byteplus secret_access_key is required")
	}
	if c.ProjectName == "" {
		return errors.New("byteplus project_name is required")
	}
	return nil
}

func (c BytePlusCredentials) ValidateRealPersonAssets() error {
	if err := c.ValidateAssets(); err != nil {
		return err
	}
	if !c.RealPersonAssets.Enabled {
		return errors.New("byteplus real-person assets are disabled")
	}
	return nil
}

func (c BytePlusCredentials) ValidateRealPersonAssetStorage() error {
	if err := c.ValidateRealPersonAssets(); err != nil {
		return err
	}
	if strings.TrimSpace(c.RealPersonAssets.TOSBucket) == "" {
		return errors.New("byteplus real-person tos_bucket is required")
	}
	if !isValidBytePlusTOSBucket(c.RealPersonAssets.TOSBucket) {
		return errors.New("byteplus real-person tos_bucket is invalid")
	}
	if strings.TrimSpace(c.RealPersonAssets.TOSRegion) != bytePlusAssetRegion {
		return errors.New("byteplus real-person tos_region must match ModelArk region")
	}
	if !isValidBytePlusRealPersonEndpoint(strings.TrimSpace(c.RealPersonAssets.TOSInternalEndpoint)) {
		return errors.New("byteplus real-person tos_internal_endpoint is invalid")
	}
	return nil
}

func isValidBytePlusRealPersonEndpoint(endpoint string) bool {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return false
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return false
	}
	if !strings.EqualFold(parsed.Scheme, "https") || parsed.Host == "" || parsed.Hostname() == "" || parsed.User != nil || parsed.Opaque != "" {
		return false
	}
	if parsed.RawQuery != "" || parsed.ForceQuery || parsed.Fragment != "" || parsed.RawPath != "" {
		return false
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return false
	}
	if port := parsed.Port(); port != "" && port != "443" {
		return false
	}
	hostname := strings.ToLower(parsed.Hostname())
	if net.ParseIP(hostname) != nil {
		return false
	}
	switch hostname {
	case "tos-ap-southeast-1.bytepluses.com",
		"tos-ap-southeast-1.ibytepluses.com":
		return true
	default:
		return false
	}
}

func isValidBytePlusTOSBucket(bucket string) bool {
	bucket = strings.TrimSpace(bucket)
	if len(bucket) < 3 || len(bucket) > 63 {
		return false
	}
	if bucket[0] == '-' || bucket[len(bucket)-1] == '-' {
		return false
	}
	for i := 0; i < len(bucket); i++ {
		ch := bucket[i]
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-' {
			continue
		}
		return false
	}
	return true
}

func looksLikeJSON(s string) bool {
	return strings.HasPrefix(s, "{")
}
