package internal

import "github.com/QuantumNous/new-api/model"

func AutoMigrate() error {
	return model.DB.AutoMigrate(&InternalKey{})
}
