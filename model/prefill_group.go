package model

import (
	"database/sql/driver"
	"encoding/json"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// PrefillGroup is used to store reusable "group" information, such as model groups, label groups, endpoint groups, etc.
// The Name field remains unique and is used for display in the front-end drop-down box.
// The Type field is used to distinguish the category of the group. Optional values include: model, tag, and endpoint.
// The Items field uses a JSON array to save a collection of strings of the corresponding type, example:
// ["gpt-4o", "gpt-3.5-turbo"]
// The design follows 3NF, avoids redundancy, and provides flexible expansion capabilities.

// JSONValue is implemented based on json.RawMessage and supports reading from the database's []byte and string types.
type JSONValue json.RawMessage

// Value implements the driver.Valuer interface for database writing
// Must return string instead of []byte: under PG simple protocol []byte is encoded by bytea,
// Writing to a json column triggers SQLSTATE 22P02.
func (j JSONValue) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return string(j), nil
}

// Scan implements the sql.Scanner interface and is compatible with the types returned by different drivers.
func (j *JSONValue) Scan(value any) error {
	switch v := value.(type) {
	case nil:
		*j = nil
		return nil
	case []byte:
		// Copy the underlying bytes to avoid retaining the underlying buffer
		b := make([]byte, len(v))
		copy(b, v)
		*j = JSONValue(b)
		return nil
	case string:
		*j = JSONValue([]byte(v))
		return nil
	default:
		// Other types try to serialize to JSON
		b, err := json.Marshal(v)
		if err != nil {
			return err
		}
		*j = JSONValue(b)
		return nil
	}
}

// MarshalJSON ensures consistent behavior with json.RawMessage when encoding externally
func (j JSONValue) MarshalJSON() ([]byte, error) {
	if j == nil {
		return []byte("null"), nil
	}
	return j, nil
}

// UnmarshalJSON ensures consistent behavior with json.RawMessage when decoding externally
func (j *JSONValue) UnmarshalJSON(data []byte) error {
	if data == nil {
		*j = nil
		return nil
	}
	b := make([]byte, len(data))
	copy(b, data)
	*j = JSONValue(b)
	return nil
}

type PrefillGroup struct {
	Id          int            `json:"id"`
	Name        string         `json:"name" gorm:"size:64;not null;uniqueIndex:uk_prefill_name,where:deleted_at IS NULL"`
	Type        string         `json:"type" gorm:"size:32;index;not null"`
	Items       JSONValue      `json:"items" gorm:"type:json"`
	Description string         `json:"description,omitempty" gorm:"type:varchar(255)"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime int64          `json:"updated_time" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

// Insert new group
func (g *PrefillGroup) Insert() error {
	now := common.GetTimestamp()
	g.CreatedTime = now
	g.UpdatedTime = now
	return DB.Create(g).Error
}

// IsPrefillGroupNameDuplicated checks whether the group name is duplicated (excluding its own ID)
func IsPrefillGroupNameDuplicated(id int, name string) (bool, error) {
	if name == "" {
		return false, nil
	}
	var cnt int64
	err := DB.Model(&PrefillGroup{}).Where("name = ? AND id <> ?", name, id).Count(&cnt).Error
	return cnt > 0, err
}

// Update update group
func (g *PrefillGroup) Update() error {
	g.UpdatedTime = common.GetTimestamp()
	return DB.Save(g).Error
}

// DeleteByID deletes a group based on ID
func DeletePrefillGroupByID(id int) error {
	return DB.Delete(&PrefillGroup{}, id).Error
}

// GetAllPrefillGroups Gets all groups, which can be filtered by type (returns all if empty)
func GetAllPrefillGroups(groupType string) ([]*PrefillGroup, error) {
	var groups []*PrefillGroup
	query := DB.Model(&PrefillGroup{})
	if groupType != "" {
		query = query.Where("type = ?", groupType)
	}
	if err := query.Order("updated_time DESC").Find(&groups).Error; err != nil {
		return nil, err
	}
	return groups, nil
}
