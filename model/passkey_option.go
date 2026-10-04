package model

import (
	"crypto/hmac"
	"encoding/base64"
	"errors"
	"maps"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	passkeyRPIDOption        = "passkey.rp_id"
	passkeyLegacyRPIDsOption = "passkey.legacy_rp_ids"
	passkeyOriginsOption     = "passkey.origins"
	passkeyRemovalTokenTTL   = 5 * time.Minute
)

var (
	passkeyOptionMutex           sync.Mutex
	ErrPasskeyDomainDedicatedAPI = errors.New("Passkey 域名设置必须使用专用接口")
	errPasskeyDomainPreview      = errors.New("Passkey domain preview")
)

type PasskeyDomainChange struct {
	Affected     int64    `json:"affected"`
	Unknown      int64    `json:"unknown"`
	Removed      []string `json:"removed"`
	Confirmation string   `json:"confirmation,omitempty"`
}

type PasskeyDomainRemovalError struct{ Change *PasskeyDomainChange }

func (e *PasskeyDomainRemovalError) Error() string { return "删除 Passkey 域名需要确认" }

func IsPasskeyDomainOption(key string) bool {
	return key == passkeyRPIDOption || key == passkeyLegacyRPIDsOption || key == passkeyOriginsOption
}

func UpdatePasskeyDomainOptions(values map[string]string, preview bool, confirmation string) (*PasskeyDomainChange, error) {
	if len(values) == 0 {
		return nil, system_setting.ErrPasskeyRPIDInvalid
	}
	for key := range values {
		if !IsPasskeyDomainOption(key) {
			return nil, system_setting.ErrPasskeyRPIDInvalid
		}
	}
	passkeyOptionMutex.Lock()
	defer passkeyOptionMutex.Unlock()
	var change *PasskeyDomainChange
	var saved map[string]string
	err := DB.Transaction(func(tx *gorm.DB) error {
		old, err := lockPasskeyDomainSettings(tx)
		if err != nil {
			return err
		}
		next := maps.Clone(old)
		maps.Copy(next, values)
		if err = normalizePasskeyDomainValues(next); err != nil {
			return err
		}
		oldIDs := passkeySettingsFromValues(old).RelyingPartyIDs()
		newIDs := passkeySettingsFromValues(next).RelyingPartyIDs()
		change = &PasskeyDomainChange{Removed: []string{}}
		for _, id := range oldIDs {
			if !slices.Contains(newIDs, id) {
				change.Removed = append(change.Removed, id)
			}
		}
		slices.Sort(change.Removed)
		if len(change.Removed) > 0 {
			if err = tx.Model(&PasskeyCredential{}).Where("rp_id IN ?", change.Removed).Count(&change.Affected).Error; err != nil {
				return err
			}
			if err = tx.Model(&PasskeyCredential{}).Where("rp_id IS NULL OR rp_id = ''").Count(&change.Unknown).Error; err != nil {
				return err
			}
		}
		if change.Affected > 0 || change.Unknown > 0 {
			change.Confirmation = makePasskeyRemovalConfirmation(old, next, change, time.Now().Add(passkeyRemovalTokenTTL))
			if !preview && !validPasskeyRemovalConfirmation(confirmation, old, next, change) {
				return &PasskeyDomainRemovalError{Change: change}
			}
		}
		if preview {
			return errPasskeyDomainPreview
		}
		saved = map[string]string{}
		for _, key := range []string{passkeyRPIDOption, passkeyLegacyRPIDsOption, passkeyOriginsOption} {
			if err = saveOptionTx(tx, key, next[key]); err != nil {
				return err
			}
			saved[key] = next[key]
		}
		return nil
	})
	if errors.Is(err, errPasskeyDomainPreview) {
		return change, nil
	}
	if err != nil {
		return change, err
	}
	return change, refreshPasskeyOptions(saved)
}

// All credential writes take these locks before credential locks.
func lockPasskeyDomainSettings(tx *gorm.DB) (map[string]string, error) {
	keys := []string{"ServerAddress", passkeyRPIDOption, passkeyLegacyRPIDsOption, passkeyOriginsOption}
	common.OptionMapRWMutex.RLock()
	defaults := map[string]string{"ServerAddress": system_setting.ServerAddress}
	for _, key := range keys {
		if value, ok := common.OptionMap[key]; ok {
			defaults[key] = value
		}
	}
	common.OptionMapRWMutex.RUnlock()
	for _, key := range keys {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&Option{Key: key, Value: defaults[key]}).Error; err != nil {
			return nil, err
		}
	}
	var options []Option
	if err := lockForUpdate(tx).Where(&Option{Key: "ServerAddress"}).First(&Option{}).Error; err != nil {
		return nil, err
	}
	if err := lockForUpdate(tx).Where("key IN ?", keys).Order("key").Find(&options).Error; err != nil {
		return nil, err
	}
	values := map[string]string{}
	for _, option := range options {
		values[option.Key] = option.Value
	}
	return values, nil
}

func passkeySettingsFromValues(values map[string]string) system_setting.PasskeySettings {
	return (system_setting.PasskeySettings{RPID: values[passkeyRPIDOption], LegacyRPIDs: values[passkeyLegacyRPIDsOption], Origins: values[passkeyOriginsOption]}).WithDefaults(values["ServerAddress"])
}

func validatePasskeyRPIDWithTx(tx *gorm.DB, rpID string) error {
	values, err := lockPasskeyDomainSettings(tx)
	if err != nil {
		return err
	}
	settings := passkeySettingsFromValues(values)
	if slices.Contains(settings.RelyingPartyIDs(), rpID) {
		return nil
	}
	// Preserve request-derived installations that have never configured domains.
	if settings.EffectiveRPID() == "" && settings.Origins == "" && settings.LegacyRPIDs == "" {
		if _, err := system_setting.NormalizePasskeyRPID(rpID); err == nil {
			return nil
		}
	}
	return system_setting.ErrPasskeyRPIDUnavailable
}

func normalizePasskeyDomainValues(values map[string]string) error {
	origins := []string{}
	for _, raw := range strings.FieldsFunc(values[passkeyOriginsOption], func(r rune) bool { return r == ',' || r == '\n' || r == '\r' }) {
		origin := strings.TrimSpace(raw)
		if origin == "" {
			continue
		}
		parsed, err := url.Parse(origin)
		if err != nil || parsed.Hostname() == "" || parsed.User != nil || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
			return system_setting.ErrPasskeyRPIDInvalid
		}
		if !slices.Contains(origins, origin) {
			origins = append(origins, origin)
		}
	}
	values[passkeyOriginsOption] = strings.Join(origins, ",")
	settings := passkeySettingsFromValues(values)
	if id := strings.TrimSpace(values[passkeyRPIDOption]); id != "" {
		normalized, err := system_setting.NormalizePasskeyRPID(id, settings.Origins)
		if err != nil {
			return err
		}
		values[passkeyRPIDOption] = normalized
	} else {
		values[passkeyRPIDOption] = ""
		if id = settings.EffectiveRPID(); id != "" {
			if _, err := system_setting.NormalizePasskeyRPID(id, settings.Origins); err != nil {
				return err
			}
		}
	}
	legacy, err := system_setting.ParsePasskeyRPIDs(values[passkeyLegacyRPIDsOption], settings.Origins)
	if err != nil {
		return err
	}
	values[passkeyLegacyRPIDsOption] = strings.Join(legacy, "\n")
	return nil
}

// Changing the general address must not silently remove an implicit RP ID.
func preservePasskeyDefaultsTx(tx *gorm.DB) (map[string]string, error) {
	values, err := lockPasskeyDomainSettings(tx)
	if err != nil {
		return nil, err
	}
	var count int64
	if err = tx.Model(&PasskeyCredential{}).Count(&count).Error; err != nil {
		return nil, err
	}
	saved := map[string]string{}
	if count == 0 {
		return saved, nil
	}
	settings := passkeySettingsFromValues(values)
	if strings.TrimSpace(values[passkeyRPIDOption]) == "" && settings.EffectiveRPID() != "" {
		saved[passkeyRPIDOption] = settings.EffectiveRPID()
	}
	if values[passkeyOriginsOption] == "" || values[passkeyOriginsOption] == "[]" {
		saved[passkeyOriginsOption] = settings.Origins
	}
	for key, value := range saved {
		if err = saveOptionTx(tx, key, value); err != nil {
			return nil, err
		}
	}
	return saved, nil
}

func refreshPasskeyOptions(values map[string]string) error {
	common.OptionMapRWMutex.Lock()
	defer common.OptionMapRWMutex.Unlock()
	for key, value := range values {
		if err := updateOptionMapLocked(key, value); err != nil {
			return err
		}
	}
	return nil
}

type passkeyRemovalTokenPayload struct {
	OldValues map[string]string `json:"old"`
	NewValues map[string]string `json:"new"`
	Removed   []string          `json:"removed"`
	Affected  int64             `json:"affected"`
	Unknown   int64             `json:"unknown"`
	ExpiresAt int64             `json:"expires"`
}

func makePasskeyRemovalConfirmation(old, next map[string]string, change *PasskeyDomainChange, expires time.Time) string {
	payload := passkeyRemovalTokenPayload{old, next, change.Removed, change.Affected, change.Unknown, expires.Unix()}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return ""
	}
	body := base64.RawURLEncoding.EncodeToString(encoded)
	return body + "." + common.GenerateHMAC("passkey-domain-removal-v1:"+body)
}

func validPasskeyRemovalConfirmation(token string, old, next map[string]string, change *PasskeyDomainChange) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || !hmac.Equal([]byte(parts[1]), []byte(common.GenerateHMAC("passkey-domain-removal-v1:"+parts[0]))) {
		return false
	}
	encoded, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return false
	}
	var payload passkeyRemovalTokenPayload
	if common.Unmarshal(encoded, &payload) != nil || time.Now().Unix() >= payload.ExpiresAt {
		return false
	}
	return maps.Equal(payload.OldValues, old) && maps.Equal(payload.NewValues, next) && slices.Equal(payload.Removed, change.Removed) && payload.Affected == change.Affected && payload.Unknown == change.Unknown
}
