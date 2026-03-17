package common

import (
	"errors"

	"github.com/jinzhu/copier"
)

func DeepCopy[T any](src *T) (*T, error) {
	if src == nil {
		return nil, errors.New(Translate("common.copy_source_cannot_be_nil"))
	}
	var dst T
	err := copier.CopyWithOption(&dst, src, copier.Option{DeepCopy: true, IgnoreEmpty: true})
	if err != nil {
		return nil, err
	}
	return &dst, nil
}
