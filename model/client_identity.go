package model

import (
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	clickhousedriver "gorm.io/driver/clickhouse"
	"gorm.io/gorm"
)

func AttachClientLog(other *LogOther, identity *common.ClientIdentity) *LogOther {
	if other == nil {
		other = NewLogOther()
	}
	if identity != nil {
		other.SetPublic("client", identity)
	}
	return other
}

func clientFamilyFromContext(c *gin.Context) string {
	if identity := common.RequestClient(c); identity != nil {
		return identity.Family
	}
	return ""
}

func applyClientFamilyFilter(tx *gorm.DB, family []string) *gorm.DB {
	if len(family) == 0 || family[0] == "" {
		return tx
	}
	if family[0] == "unrecorded" {
		if common.UsingLogDatabase(common.DatabaseTypeClickHouse) {
			// ClickHouse 25.8 cannot merge sparse/defaulted legacy columns with
			// lazy blocks for this filter. Keep the workaround query-local and
			// avoid sending the newer setting to older server versions.
			if dialect, ok := tx.Dialector.(*clickhousedriver.Dialector); ok && strings.HasPrefix(dialect.Version, "25.8.") {
				ctx := clickhouse.Context(tx.Statement.Context, clickhouse.WithSettings(clickhouse.Settings{"query_plan_optimize_lazy_materialization": 0}))
				tx = tx.WithContext(ctx)
			}
			return tx.Where("logs.client_family = ?", "")
		}
		return tx.Where("logs.client_family IS NULL OR logs.client_family = ?", "")
	}
	return tx.Where("logs.client_family = ?", family[0])
}
