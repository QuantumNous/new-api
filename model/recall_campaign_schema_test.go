package model

import (
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestRecallCampaignEmailSequenceConfigUsesLargeTextStorage(t *testing.T) {
	tests := []struct {
		name     string
		dialect  gorm.Dialector
		wantType string
	}{
		{name: "mysql", dialect: mysql.New(mysql.Config{}), wantType: "longtext"},
		{name: "postgres", dialect: postgres.New(postgres.Config{}), wantType: "text"},
		{name: "sqlite", dialect: sqlite.Open(":memory:"), wantType: "text"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			parsed, err := schema.Parse(&RecallCampaign{}, &sync.Map{}, schema.NamingStrategy{})
			require.NoError(t, err)

			field := parsed.LookUpField("EmailSequenceConfig")
			require.NotNil(t, field)
			require.Equal(t, test.wantType, test.dialect.DataTypeOf(field))
		})
	}
}
