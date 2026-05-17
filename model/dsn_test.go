package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMySQLDSNHasQueryKey(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
		key  string
		want bool
	}{
		{
			name: "query key exists",
			dsn:  "user:password@tcp(localhost:3306)/new-api?parseTime=true&charset=utf8mb4",
			key:  "parseTime",
			want: true,
		},
		{
			name: "query key is case sensitive",
			dsn:  "user:password@tcp(localhost:3306)/new-api?parsetime=true",
			key:  "parseTime",
			want: false,
		},
		{
			name: "username contains key but query does not",
			dsn:  "parseTime_user:password@tcp(localhost:3306)/new-api",
			key:  "parseTime",
			want: false,
		},
		{
			name: "password contains key but query does not",
			dsn:  "user:parseTime_password@tcp(localhost:3306)/new-api",
			key:  "parseTime",
			want: false,
		},
		{
			name: "database name contains key but query does not",
			dsn:  "user:password@tcp(localhost:3306)/parseTime_db",
			key:  "parseTime",
			want: false,
		},
		{
			name: "query value contains key but key does not exist",
			dsn:  "user:password@tcp(localhost:3306)/new-api?name=parseTime",
			key:  "parseTime",
			want: false,
		},
		{
			name: "socket path with slash still finds db query",
			dsn:  "user:password@unix(/var/run/mysqld/mysqld.sock)/new-api?parseTime=true",
			key:  "parseTime",
			want: true,
		},
		{
			name: "no database separator",
			dsn:  "user:password@tcp(localhost:3306)",
			key:  "parseTime",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, mysqlDSNHasQueryKey(tt.dsn, tt.key))
		})
	}
}

func TestPrepareMySQLDSNAddsParseTimeOnlyWhenQueryKeyMissing(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
		want string
	}{
		{
			name: "adds parseTime to DSN without query",
			dsn:  "user:password@tcp(localhost:3306)/new-api",
			want: "user:password@tcp(localhost:3306)/new-api?parseTime=true",
		},
		{
			name: "adds parseTime to existing query",
			dsn:  "user:password@tcp(localhost:3306)/new-api?charset=utf8",
			want: "user:password@tcp(localhost:3306)/new-api?charset=utf8&parseTime=true",
		},
		{
			name: "keeps existing parseTime true",
			dsn:  "user:password@tcp(localhost:3306)/new-api?parseTime=true",
			want: "user:password@tcp(localhost:3306)/new-api?parseTime=true",
		},
		{
			name: "keeps existing parseTime false",
			dsn:  "user:password@tcp(localhost:3306)/new-api?parseTime=false",
			want: "user:password@tcp(localhost:3306)/new-api?parseTime=false",
		},
		{
			name: "does not treat username substring as query key",
			dsn:  "parseTime_user:password@tcp(localhost:3306)/new-api",
			want: "parseTime_user:password@tcp(localhost:3306)/new-api?parseTime=true",
		},
		{
			name: "does not treat password substring as query key",
			dsn:  "user:parseTime_password@tcp(localhost:3306)/new-api",
			want: "user:parseTime_password@tcp(localhost:3306)/new-api?parseTime=true",
		},
		{
			name: "does not treat database substring as query key",
			dsn:  "user:password@tcp(localhost:3306)/parseTime_db",
			want: "user:password@tcp(localhost:3306)/parseTime_db?parseTime=true",
		},
		{
			name: "preserves charset and loc without adding compatibility-changing defaults",
			dsn:  "user:password@tcp(localhost:3306)/new-api?charset=utf8&loc=UTC",
			want: "user:password@tcp(localhost:3306)/new-api?charset=utf8&loc=UTC&parseTime=true",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, prepareMySQLDSN(tt.dsn))
		})
	}
}
