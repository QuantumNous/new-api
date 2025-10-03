package model

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"one-api/common"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"gorm.io/gorm"
)

var (
	ErrPasskeyNotFound         = errors.New("passkey credential not found")
	ErrFriendlyPasskeyNotFound = errors.New("Passkey 验证失败，请重试或联系管理员")
)

type PasskeyCredential struct {
	ID              int            `json:"id" gorm:"primaryKey"`
	UserID          int            `json:"user_id" gorm:"uniqueIndex;not null"`
	CredentialID    string         `json:"credential_id" gorm:"type:varchar(512);uniqueIndex;not null"` // base64 encoded
	PublicKey       string         `json:"public_key" gorm:"type:text;not null"`                        // base64 encoded
	AttestationType string         `json:"attestation_type" gorm:"type:varchar(255)"`
	AAGUID          string         `json:"aaguid" gorm:"type:varchar(512)"` // base64 encoded
	SignCount       uint32         `json:"sign_count" gorm:"default:0"`
	CloneWarning    bool           `json:"clone_warning"`
	UserPresent     bool           `json:"user_present"`
	UserVerified    bool           `json:"user_verified"`
	BackupEligible  bool           `json:"backup_eligible"`
	BackupState     bool           `json:"backup_state"`
	Transports      string         `json:"transports" gorm:"type:text"`
	Attachment      string         `json:"attachment" gorm:"type:varchar(32)"`
	LastUsedAt      *time.Time     `json:"last_used_at"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
}

func (p *PasskeyCredential) TransportList() []protocol.AuthenticatorTransport {
	if p == nil || strings.TrimSpace(p.Transports) == "" {
		return nil
	}
	var transports []string
	if err := json.Unmarshal([]byte(p.Transports), &transports); err != nil {
		return nil
	}
	result := make([]protocol.AuthenticatorTransport, 0, len(transports))
	for _, transport := range transports {
		result = append(result, protocol.AuthenticatorTransport(transport))
	}
	return result
}

func (p *PasskeyCredential) SetTransports(list []protocol.AuthenticatorTransport) {
	if len(list) == 0 {
		p.Transports = ""
		return
	}
	stringList := make([]string, len(list))
	for i, transport := range list {
		stringList[i] = string(transport)
	}
	encoded, err := json.Marshal(stringList)
	if err != nil {
		return
	}
	p.Transports = string(encoded)
}

func (p *PasskeyCredential) ToWebAuthnCredential() webauthn.Credential {
	flags := webauthn.CredentialFlags{
		UserPresent:    p.UserPresent,
		UserVerified:   p.UserVerified,
		BackupEligible: p.BackupEligible,
		BackupState:    p.BackupState,
	}

	credID, _ := base64.StdEncoding.DecodeString(p.CredentialID)
	pubKey, _ := base64.StdEncoding.DecodeString(p.PublicKey)
	aaguid, _ := base64.StdEncoding.DecodeString(p.AAGUID)

	return webauthn.Credential{
		ID:              credID,
		PublicKey:       pubKey,
		AttestationType: p.AttestationType,
		Transport:       p.TransportList(),
		Flags:           flags,
		Authenticator: webauthn.Authenticator{
			AAGUID:       aaguid,
			SignCount:    p.SignCount,
			CloneWarning: p.CloneWarning,
			Attachment:   protocol.AuthenticatorAttachment(p.Attachment),
		},
	}
}

func NewPasskeyCredentialFromWebAuthn(userID int, credential *webauthn.Credential) *PasskeyCredential {
	if credential == nil {
		return nil
	}
	passkey := &PasskeyCredential{
		UserID:          userID,
		CredentialID:    base64.StdEncoding.EncodeToString(credential.ID),
		PublicKey:       base64.StdEncoding.EncodeToString(credential.PublicKey),
		AttestationType: credential.AttestationType,
		AAGUID:          base64.StdEncoding.EncodeToString(credential.Authenticator.AAGUID),
		SignCount:       credential.Authenticator.SignCount,
		CloneWarning:    credential.Authenticator.CloneWarning,
		UserPresent:     credential.Flags.UserPresent,
		UserVerified:    credential.Flags.UserVerified,
		BackupEligible:  credential.Flags.BackupEligible,
		BackupState:     credential.Flags.BackupState,
		Attachment:      string(credential.Authenticator.Attachment),
	}
	passkey.SetTransports(credential.Transport)
	return passkey
}

func (p *PasskeyCredential) ApplyValidatedCredential(credential *webauthn.Credential) {
	if credential == nil || p == nil {
		return
	}
	p.CredentialID = base64.StdEncoding.EncodeToString(credential.ID)
	p.PublicKey = base64.StdEncoding.EncodeToString(credential.PublicKey)
	p.AttestationType = credential.AttestationType
	p.AAGUID = base64.StdEncoding.EncodeToString(credential.Authenticator.AAGUID)
	p.SignCount = credential.Authenticator.SignCount
	p.CloneWarning = credential.Authenticator.CloneWarning
	p.UserPresent = credential.Flags.UserPresent
	p.UserVerified = credential.Flags.UserVerified
	p.BackupEligible = credential.Flags.BackupEligible
	p.BackupState = credential.Flags.BackupState
	p.Attachment = string(credential.Authenticator.Attachment)
	p.SetTransports(credential.Transport)
}

func GetPasskeyByUserID(userID int) (*PasskeyCredential, error) {
	if userID == 0 {
		common.SysLog("GetPasskeyByUserID: empty user ID")
		return nil, ErrFriendlyPasskeyNotFound
	}
	var credential PasskeyCredential
	if err := DB.Where("user_id = ?", userID).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 未找到记录是正常情况（用户未绑定），返回 ErrPasskeyNotFound 而不记录日志
			return nil, ErrPasskeyNotFound
		}
		// 只有真正的数据库错误才记录日志
		common.SysLog(fmt.Sprintf("GetPasskeyByUserID: database error for user %d: %v", userID, err))
		return nil, ErrFriendlyPasskeyNotFound
	}
	return &credential, nil
}

func GetPasskeyByCredentialID(credentialID []byte) (*PasskeyCredential, error) {
	if len(credentialID) == 0 {
		common.SysLog("GetPasskeyByCredentialID: empty credential ID")
		return nil, ErrFriendlyPasskeyNotFound
	}

	credIDStr := base64.StdEncoding.EncodeToString(credentialID)
	var credential PasskeyCredential
	if err := DB.Where("credential_id = ?", credIDStr).First(&credential).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.SysLog(fmt.Sprintf("GetPasskeyByCredentialID: passkey not found for credential ID length %d", len(credentialID)))
			return nil, ErrFriendlyPasskeyNotFound
		}
		common.SysLog(fmt.Sprintf("GetPasskeyByCredentialID: database error for credential ID: %v", err))
		return nil, ErrFriendlyPasskeyNotFound
	}

	return &credential, nil
}

func UpsertPasskeyCredential(credential *PasskeyCredential) error {
	if credential == nil {
		common.SysLog("UpsertPasskeyCredential: nil credential provided")
		return fmt.Errorf("Passkey 保存失败，请重试")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		// 使用Unscoped()进行硬删除，避免唯一索引冲突
		if err := tx.Unscoped().Where("user_id = ?", credential.UserID).Delete(&PasskeyCredential{}).Error; err != nil {
			common.SysLog(fmt.Sprintf("UpsertPasskeyCredential: failed to delete existing credential for user %d: %v", credential.UserID, err))
			return fmt.Errorf("Passkey 保存失败，请重试")
		}
		if err := tx.Create(credential).Error; err != nil {
			common.SysLog(fmt.Sprintf("UpsertPasskeyCredential: failed to create credential for user %d: %v", credential.UserID, err))
			return fmt.Errorf("Passkey 保存失败，请重试")
		}
		return nil
	})
}

func DeletePasskeyByUserID(userID int) error {
	if userID == 0 {
		common.SysLog("DeletePasskeyByUserID: empty user ID")
		return fmt.Errorf("删除失败，请重试")
	}
	// 使用Unscoped()进行硬删除，避免唯一索引冲突
	if err := DB.Unscoped().Where("user_id = ?", userID).Delete(&PasskeyCredential{}).Error; err != nil {
		common.SysLog(fmt.Sprintf("DeletePasskeyByUserID: failed to delete passkey for user %d: %v", userID, err))
		return fmt.Errorf("删除失败，请重试")
	}
	return nil
}
