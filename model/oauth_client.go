package model

import (
	"errors"

	"gorm.io/gorm"
)

// OAuthClientType represents the type of OAuth client
type OAuthClientType string

const (
	OAuthClientTypePublic       OAuthClientType = "public"
	OAuthClientTypeConfidential OAuthClientType = "confidential"
)

// OAuthClient stores OAuth client ownership and metadata
// This allows tracking which user created which client and what scopes are allowed
type OAuthClient struct {
	Id            int             `json:"id" gorm:"primaryKey"`
	HydraClientID string          `json:"hydra_client_id" gorm:"type:varchar(255);uniqueIndex;not null"` // client_id in Hydra
	UserID        int             `json:"user_id" gorm:"index;not null"`                                 // creator user ID
	ClientName    string          `json:"client_name" gorm:"type:varchar(255)"`
	ClientType    OAuthClientType `json:"client_type" gorm:"type:varchar(50);default:'confidential'"`
	AllowedScopes string          `json:"allowed_scopes" gorm:"type:text"` // comma-separated allowed scopes
	RedirectURIs  string          `json:"redirect_uris" gorm:"type:text"`  // comma-separated redirect URIs
	CreatedAt     int64           `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     int64           `json:"updated_at" gorm:"autoUpdateTime"`
	DeletedAt     gorm.DeletedAt  `json:"deleted_at" gorm:"index"`
}

func (OAuthClient) TableName() string {
	return "oauth_clients"
}

// CreateOAuthClient creates a new OAuth client record
func CreateOAuthClient(client *OAuthClient) error {
	return DB.Create(client).Error
}

// GetOAuthClientByHydraID retrieves an OAuth client by its Hydra client ID
func GetOAuthClientByHydraID(hydraClientID string) (*OAuthClient, error) {
	var client OAuthClient
	err := DB.Where("hydra_client_id = ?", hydraClientID).First(&client).Error
	if err != nil {
		return nil, err
	}
	return &client, nil
}

// GetOAuthClientsByUserID retrieves all OAuth clients created by a user
func GetOAuthClientsByUserID(userID int) ([]*OAuthClient, error) {
	var clients []*OAuthClient
	err := DB.Where("user_id = ?", userID).Order("id desc").Find(&clients).Error
	return clients, err
}

// GetAllOAuthClients retrieves all OAuth clients (admin use)
func GetAllOAuthClients(startIdx, num int) ([]*OAuthClient, error) {
	var clients []*OAuthClient
	err := DB.Order("id desc").Limit(num).Offset(startIdx).Find(&clients).Error
	return clients, err
}

// DeleteOAuthClientByHydraID deletes an OAuth client by its Hydra client ID
func DeleteOAuthClientByHydraID(hydraClientID string) error {
	result := DB.Where("hydra_client_id = ?", hydraClientID).Delete(&OAuthClient{})
	if result.RowsAffected == 0 {
		return errors.New("client not found")
	}
	return result.Error
}

// DeleteOAuthClientByHydraIDAndUserID deletes an OAuth client only if it belongs to the user
func DeleteOAuthClientByHydraIDAndUserID(hydraClientID string, userID int) error {
	result := DB.Where("hydra_client_id = ? AND user_id = ?", hydraClientID, userID).Delete(&OAuthClient{})
	if result.RowsAffected == 0 {
		return errors.New("client not found or not owned by user")
	}
	return result.Error
}

// IsOAuthClientOwner checks if a user owns an OAuth client
func IsOAuthClientOwner(hydraClientID string, userID int) (bool, error) {
	var count int64
	err := DB.Model(&OAuthClient{}).Where("hydra_client_id = ? AND user_id = ?", hydraClientID, userID).Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// UpdateOAuthClientByHydraID updates an OAuth client by its Hydra client ID
func UpdateOAuthClientByHydraID(hydraClientID, clientName, allowedScopes, redirectURIs string) error {
	result := DB.Model(&OAuthClient{}).Where("hydra_client_id = ?", hydraClientID).Updates(map[string]interface{}{
		"client_name":    clientName,
		"allowed_scopes": allowedScopes,
		"redirect_uris":  redirectURIs,
	})
	if result.RowsAffected == 0 {
		return errors.New("client not found")
	}
	return result.Error
}
