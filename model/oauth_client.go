package model

import (
	"encoding/json"
	"one-api/common"
	"strings"
	"time"

	"gorm.io/gorm"
)

// OAuthClient OAuth2 客户端模型
type OAuthClient struct {
	ID           string         `json:"id" gorm:"type:varchar(64);primaryKey"`
	Secret       string         `json:"secret" gorm:"type:varchar(128);not null"`
	Name         string         `json:"name" gorm:"type:varchar(255);not null"`
	Domain       string         `json:"domain" gorm:"type:varchar(255)"` // 允许的重定向域名
	RedirectURIs string         `json:"redirect_uris" gorm:"type:text"`  // JSON array of redirect URIs
	GrantTypes   string         `json:"grant_types" gorm:"type:varchar(255);default:'client_credentials'"`
	Scopes       string         `json:"scopes" gorm:"type:varchar(255);default:'api:read'"`
	RequirePKCE  bool           `json:"require_pkce" gorm:"default:true"`
	Status       int            `json:"status" gorm:"type:int;default:1"`    // 1: enabled, 2: disabled
	CreatedBy    int            `json:"created_by" gorm:"type:int;not null"` // 创建者用户ID
	CreatedTime  int64          `json:"created_time" gorm:"bigint"`
	LastUsedTime int64          `json:"last_used_time" gorm:"bigint;default:0"`
	TokenCount   int            `json:"token_count" gorm:"type:int;default:0"` // 已签发的token数量
	Description  string         `json:"description" gorm:"type:text"`
	ClientType   string         `json:"client_type" gorm:"type:varchar(32);default:'confidential'"` // confidential, public
	DeletedAt    gorm.DeletedAt `gorm:"index"`
}

// GetRedirectURIs 获取重定向URI列表
func (c *OAuthClient) GetRedirectURIs() []string {
	if c.RedirectURIs == "" {
		return []string{}
	}
	var uris []string
	err := json.Unmarshal([]byte(c.RedirectURIs), &uris)
	if err != nil {
		common.SysLog("failed to unmarshal redirect URIs: " + err.Error())
		return []string{}
	}
	return uris
}

// SetRedirectURIs 设置重定向URI列表
func (c *OAuthClient) SetRedirectURIs(uris []string) {
	data, err := json.Marshal(uris)
	if err != nil {
		common.SysLog("failed to marshal redirect URIs: " + err.Error())
		return
	}
	c.RedirectURIs = string(data)
}

// GetGrantTypes 获取允许的授权类型列表
func (c *OAuthClient) GetGrantTypes() []string {
	if c.GrantTypes == "" {
		return []string{"client_credentials"}
	}
	return strings.Split(c.GrantTypes, ",")
}

// SetGrantTypes 设置允许的授权类型列表
func (c *OAuthClient) SetGrantTypes(types []string) {
	c.GrantTypes = strings.Join(types, ",")
}

// GetScopes 获取允许的scope列表
func (c *OAuthClient) GetScopes() []string {
	if c.Scopes == "" {
		return []string{"api:read"}
	}
	return strings.Split(c.Scopes, ",")
}

// SetScopes 设置允许的scope列表
func (c *OAuthClient) SetScopes(scopes []string) {
	c.Scopes = strings.Join(scopes, ",")
}

// ValidateRedirectURI 验证重定向URI是否有效
func (c *OAuthClient) ValidateRedirectURI(uri string) bool {
	allowedURIs := c.GetRedirectURIs()
	for _, allowedURI := range allowedURIs {
		if allowedURI == uri {
			return true
		}
	}
	return false
}

// ValidateGrantType 验证授权类型是否被允许
func (c *OAuthClient) ValidateGrantType(grantType string) bool {
	allowedTypes := c.GetGrantTypes()
	for _, allowedType := range allowedTypes {
		if allowedType == grantType {
			return true
		}
	}
	return false
}

// ValidateScope 验证scope是否被允许
func (c *OAuthClient) ValidateScope(scope string) bool {
	allowedScopes := c.GetScopes()
	requestedScopes := strings.Split(scope, " ")

	for _, requestedScope := range requestedScopes {
		requestedScope = strings.TrimSpace(requestedScope)
		if requestedScope == "" {
			continue
		}
		found := false
		for _, allowedScope := range allowedScopes {
			if allowedScope == requestedScope {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

// BeforeCreate GORM hook - 在创建前设置时间
func (c *OAuthClient) BeforeCreate(tx *gorm.DB) (err error) {
	c.CreatedTime = time.Now().Unix()
	return
}

// UpdateLastUsedTime 更新最后使用时间
func (c *OAuthClient) UpdateLastUsedTime() error {
	c.LastUsedTime = time.Now().Unix()
	c.TokenCount++
	return DB.Model(c).Select("last_used_time", "token_count").Updates(c).Error
}

// GetOAuthClientByID 根据ID获取OAuth客户端
func GetOAuthClientByID(id string) (*OAuthClient, error) {
	var client OAuthClient
	err := DB.Where("id = ? AND status = ?", id, common.UserStatusEnabled).First(&client).Error
	return &client, err
}

// GetAllOAuthClients 获取所有OAuth客户端
func GetAllOAuthClients(startIdx int, num int) ([]*OAuthClient, error) {
	var clients []*OAuthClient
	err := DB.Order("created_time desc").Limit(num).Offset(startIdx).Find(&clients).Error
	return clients, err
}

// SearchOAuthClients 搜索OAuth客户端
func SearchOAuthClients(keyword string) ([]*OAuthClient, error) {
	var clients []*OAuthClient
	err := DB.Where("name LIKE ? OR id LIKE ? OR description LIKE ?",
		"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%").Find(&clients).Error
	return clients, err
}

// CreateOAuthClient 创建OAuth客户端
func CreateOAuthClient(client *OAuthClient) error {
	return DB.Create(client).Error
}

// UpdateOAuthClient 更新OAuth客户端
func UpdateOAuthClient(client *OAuthClient) error {
	return DB.Save(client).Error
}

// DeleteOAuthClient 删除OAuth客户端
func DeleteOAuthClient(id string) error {
	return DB.Where("id = ?", id).Delete(&OAuthClient{}).Error
}

// CountOAuthClients 统计OAuth客户端数量
func CountOAuthClients() (int64, error) {
	var count int64
	err := DB.Model(&OAuthClient{}).Count(&count).Error
	return count, err
}
