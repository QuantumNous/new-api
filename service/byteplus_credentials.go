package service

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type BytePlusCredentials struct {
	APIKey          string `json:"api_key"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	ProjectName     string `json:"project_name"`
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

func looksLikeJSON(s string) bool {
	return strings.HasPrefix(s, "{")
}
