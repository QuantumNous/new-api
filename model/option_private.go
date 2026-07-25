package model

import (
	"gorm.io/gorm"
)

// Private options are persisted in the same table as regular options but are
// never mirrored into common.OptionMap, so they stay out of the admin option
// API and out of every in-memory settings snapshot. Use them for server-side
// secrets such as signing keys.

func GetPrivateOption(key string) (string, error) {
	var option Option
	err := DB.Where(Option{Key: key}).First(&option).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", err
	}
	return option.Value, nil
}

// GetOrCreatePrivateOption returns the stored value, generating and persisting
// one on first use. Concurrent creators converge on whichever value landed
// first, so every node signs with the same key.
func GetOrCreatePrivateOption(key string, generate func() (string, error)) (string, error) {
	existing, err := GetPrivateOption(key)
	if err != nil {
		return "", err
	}
	if existing != "" {
		return existing, nil
	}
	value, err := generate()
	if err != nil {
		return "", err
	}
	var option Option
	err = DB.Where(Option{Key: key}).Attrs(Option{Value: value}).FirstOrCreate(&option).Error
	if err != nil {
		// A parallel creator won the race; read back their value.
		return GetPrivateOption(key)
	}
	return option.Value, nil
}
