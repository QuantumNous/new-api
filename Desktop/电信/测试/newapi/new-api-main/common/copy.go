package common

import (
	"fmt"

	"github.com/jinzhu/copier"
)

func DeepCopy[T any](src *T) (*T, error) {
	if src == nil {
		return nil, fmt.Errorf("copy source cannot be nil")
	}
	var dst T
	err := copier.CopyWithOption(&dst, src, copier.Option{DeepCopy: true, IgnoreEmpty: true})
	if err != nil {
		return nil, err
	}
	return &dst, nil
}
