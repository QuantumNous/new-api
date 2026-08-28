package model

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/url"
	"time"
)

// OAuthClient represents an external application registered to use new-api as an OAuth Provider
type OAuthClient struct {
	Id           int       `json:"id" gorm:"primaryKey"`
	ClientId     string    `json:"client_id" gorm:"type:varchar(64);uniqueIndex;not null"`
	ClientSecret string    `json:"-" gorm:"type:varchar(256)"` // Never returned in API responses
	Name         string    `json:"name" gorm:"type:varchar(128);not null"`
	RedirectUri  string    `json:"redirect_uri" gorm:"type:varchar(512);not null"`
	Scopes       string    `json:"scopes" gorm:"type:varchar(256);default:'openid profile email'"`
	OwnerId      int       `json:"owner_id" gorm:"not null"`
	Enabled      bool      `json:"enabled" gorm:"default:true"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (OAuthClient) TableName() string {
	return "oauth_clients"
}

// GenerateClientId generates a secure random client ID with a prefix
func GenerateClientId() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "cli_" + base64.RawURLEncoding.EncodeToString(bytes), nil
}

// GenerateClientSecret generates a secure random client secret
func GenerateClientSecret() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// CreateOAuthClient creates a new OAuth client with generated credentials
func CreateOAuthClient(client *OAuthClient) error {
	if client.Name == "" {
		return errors.New("client name is required")
	}
	if client.RedirectUri == "" {
		return errors.New("redirect URI is required")
	}
	if _, err := url.Parse(client.RedirectUri); err != nil {
		return errors.New("invalid redirect URI")
	}
	if client.Scopes == "" {
		client.Scopes = "openid profile email"
	}

	clientId, err := GenerateClientId()
	if err != nil {
		return err
	}
	clientSecret, err := GenerateClientSecret()
	if err != nil {
		return err
	}
	client.ClientId = clientId
	client.ClientSecret = clientSecret
	client.Enabled = true

	return DB.Create(client).Error
}

// GetOAuthClientById returns an OAuth client by ID
func GetOAuthClientById(id int) (*OAuthClient, error) {
	var client OAuthClient
	if err := DB.First(&client, id).Error; err != nil {
		return nil, err
	}
	return &client, nil
}

// GetOAuthClientByClientId returns an OAuth client by its client_id
func GetOAuthClientByClientId(clientId string) (*OAuthClient, error) {
	var client OAuthClient
	if err := DB.Where("client_id = ?", clientId).First(&client).Error; err != nil {
		return nil, err
	}
	return &client, nil
}

// GetOAuthClientsByOwnerId returns all OAuth clients owned by a user
func GetOAuthClientsByOwnerId(ownerId int) ([]*OAuthClient, error) {
	var clients []*OAuthClient
	err := DB.Where("owner_id = ?", ownerId).Order("created_at desc").Find(&clients).Error
	return clients, err
}

// UpdateOAuthClient updates an existing OAuth client
func UpdateOAuthClient(client *OAuthClient) error {
	if client.Name == "" {
		return errors.New("client name is required")
	}
	if client.RedirectUri == "" {
		return errors.New("redirect URI is required")
	}
	if _, err := url.Parse(client.RedirectUri); err != nil {
		return errors.New("invalid redirect URI")
	}
	return DB.Save(client).Error
}

// DeleteOAuthClient deletes an OAuth client by ID
func DeleteOAuthClient(id int) error {
	return DB.Delete(&OAuthClient{}, id).Error
}
