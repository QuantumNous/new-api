package controller

import (
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/go-fuego/fuego"
)

// GetMissingModels returns the list of model names that are referenced by channels
// but do not have corresponding records in the models meta table.
// This helps administrators quickly discover models that need configuration.
func GetMissingModels(c fuego.ContextNoBody) (*dto.Response[[]string], error) {
	missing, err := model.GetMissingModels()
	if err != nil {
		return dto.Fail[[]string](err.Error())
	}

	return dto.Ok(missing)
}
