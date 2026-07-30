package model

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func TestLargeTextUsesLongTextOnMySQL(t *testing.T) {
	db := &gorm.DB{
		Config: &gorm.Config{
			Dialector: mysql.New(mysql.Config{}),
		},
	}

	require.Equal(t, "longtext", LargeText("").GormDBDataType(db, nil))
}
