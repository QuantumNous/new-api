package service

import (
	"errors"
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
	if strings.TrimSpace(c.RealPersonAssets.TOSBucket) == "" {
		return errors.New("byteplus real-person tos_bucket is required")
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
	if endpoint == "" {
		return false
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return false
	}
	if parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		return false
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return false
	}
	return parsed.Path == "" || parsed.Path == "/"
}

func looksLikeJSON(s string) bool {
	return strings.HasPrefix(s, "{")
}
