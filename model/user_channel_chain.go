package model

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	MaxUserChannelChains           = 10
	MaxChannelsPerUserChannelChain = 10
)

var ErrChannelChainLimit = errors.New("channel chain limit reached")

type UserChannelChain struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"index"`
	ChainId   string `json:"chain_id" gorm:"type:varchar(32);uniqueIndex"`
	Name      string `json:"name" gorm:"type:varchar(64)"`
	Channels  string `json:"-" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

// ParseUserChannelChain extracts a chain id from a token group such as chain:OUwA5H5q.
func ParseUserChannelChain(group string) (string, bool) {
	if !strings.HasPrefix(group, "chain:") || len(group) <= len("chain:") {
		return "", false
	}
	return strings.TrimPrefix(group, "chain:"), true
}

func (chain *UserChannelChain) GetChannelList() []int {
	if chain.Channels == "" {
		return nil
	}
	var ids []int
	if err := common.UnmarshalJsonStr(chain.Channels, &ids); err != nil {
		common.SysError(fmt.Sprintf("failed to parse channel chain %s: %v", chain.ChainId, err))
		return nil
	}
	return ids
}

func (chain *UserChannelChain) SetChannelList(ids []int) error {
	if len(ids) == 0 {
		chain.Channels = ""
		return nil
	}
	data, err := common.Marshal(ids)
	if err != nil {
		return err
	}
	chain.Channels = string(data)
	return nil
}

func CountUserChannelChains(userId int) (int64, error) {
	var count int64
	err := DB.Model(&UserChannelChain{}).Where("user_id = ?", userId).Count(&count).Error
	return count, err
}

func GetUserChannelChains(userId int) ([]UserChannelChain, error) {
	chains := make([]UserChannelChain, 0)
	err := DB.Where("user_id = ?", userId).Order("id asc").Find(&chains).Error
	return chains, err
}

func GetUserChannelChain(userId int, chainId string) (*UserChannelChain, error) {
	chain := UserChannelChain{}
	err := DB.Where("user_id = ? and chain_id = ?", userId, chainId).First(&chain).Error
	return &chain, err
}

func CreateUserChannelChain(userId int, name string, channelIds []int) (*UserChannelChain, error) {
	count, err := CountUserChannelChains(userId)
	if err != nil {
		return nil, err
	}
	if count >= MaxUserChannelChains {
		return nil, ErrChannelChainLimit
	}

	chain := &UserChannelChain{
		UserId: userId,
		Name:   name,
	}
	for i := 0; i < 10; i++ {
		chainId := common.GetRandomString(8)
		var exists int64
		if err := DB.Model(&UserChannelChain{}).Where("chain_id = ?", chainId).Count(&exists).Error; err != nil {
			return nil, err
		}
		if exists == 0 {
			chain.ChainId = chainId
			break
		}
	}
	if chain.ChainId == "" {
		return nil, errors.New("failed to generate channel chain id")
	}
	if err := chain.SetChannelList(channelIds); err != nil {
		return nil, err
	}
	if err := DB.Create(chain).Error; err != nil {
		return nil, err
	}
	return chain, nil
}

func UpdateUserChannelChain(userId int, chainId string, name string, channelIds []int) error {
	chain := UserChannelChain{}
	if err := DB.Where("user_id = ? and chain_id = ?", userId, chainId).First(&chain).Error; err != nil {
		return err
	}
	chain.Name = name
	if err := chain.SetChannelList(channelIds); err != nil {
		return err
	}
	return DB.Save(&chain).Error
}

// DeleteUserChannelChain removes a chain and resets bound tokens to the user group.
func DeleteUserChannelChain(userId int, chainId string) (int, error) {
	chainGroup := "chain:" + chainId
	var tokens []Token
	if err := DB.Where("user_id = ? and "+commonGroupCol+" = ?", userId, chainGroup).Find(&tokens).Error; err != nil {
		return 0, err
	}
	user, err := GetUserById(userId, false)
	if err != nil {
		return 0, err
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? and chain_id = ?", userId, chainId).Delete(&UserChannelChain{}).Error; err != nil {
			return err
		}
		for _, token := range tokens {
			updates := map[string]interface{}{
				"group":             user.Group,
				"cross_group_retry": false,
				"auto_groups":       "",
			}
			if err := tx.Model(&Token{}).Where("id = ?", token.Id).
				Select("group", "cross_group_retry", "auto_groups").Updates(updates).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	if common.RedisEnabled {
		for _, token := range tokens {
			_ = cacheDeleteToken(token.Key)
		}
	}
	return len(tokens), nil
}

func CountUserTokensByChannelChain(userId int, chainId string) (int64, error) {
	var count int64
	group := "chain:" + chainId
	err := DB.Model(&Token{}).Where("user_id = ? and "+commonGroupCol+" = ?", userId, group).Count(&count).Error
	return count, err
}
