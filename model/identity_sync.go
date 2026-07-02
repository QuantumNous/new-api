package model

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const identitySyncRemoteDSNEnv = "IDENTITY_SYNC_REMOTE_DSN"

var identitySyncIdentifierPattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

type identitySyncTableSpec struct {
	Table       string
	PrimaryKeys []string
	Required    bool
	CacheCols   []string
}

var defaultIdentitySyncTableOrder = []string{
	"users",
	"setups",
	"custom_oauth_providers",
	"tokens",
	"two_fas",
	"two_fa_backup_codes",
	"passkey_credentials",
	"user_oauth_bindings",
}

var identitySyncAllowedTables = map[string]identitySyncTableSpec{
	"users":                  {Table: "users", PrimaryKeys: []string{"id"}, Required: true},
	"setups":                 {Table: "setups", PrimaryKeys: []string{"id"}, Required: true},
	"tokens":                 {Table: "tokens", PrimaryKeys: []string{"id"}, Required: true, CacheCols: []string{"key"}},
	"two_fas":                {Table: "two_fas", PrimaryKeys: []string{"id"}},
	"two_fa_backup_codes":    {Table: "two_fa_backup_codes", PrimaryKeys: []string{"id"}},
	"passkey_credentials":    {Table: "passkey_credentials", PrimaryKeys: []string{"id"}},
	"custom_oauth_providers": {Table: "custom_oauth_providers", PrimaryKeys: []string{"id"}},
	"user_oauth_bindings":    {Table: "user_oauth_bindings", PrimaryKeys: []string{"id"}},
}

type identitySyncConfig struct {
	Enabled            bool
	RemoteDSN          string
	Tables             []identitySyncTableSpec
	Interval           time.Duration
	Timeout            time.Duration
	BatchSize          int
	MaxRowsPerTable    int64
	DeleteMissing      bool
	RefreshOnSync      bool
	RunOnStartup       bool
	FailStartupOnError bool
}

type identitySyncer struct {
	config   identitySyncConfig
	remoteDB *gorm.DB
	localDB  *gorm.DB
}

type identitySyncResult struct {
	Tables []identitySyncTableResult
}

type identitySyncTableResult struct {
	Table     string
	Rows      int64
	Upserted  int64
	Deleted   int64
	Skipped   bool
	SkipCause string
}

func (r identitySyncResult) DidWrite() bool {
	for _, table := range r.Tables {
		if table.Upserted > 0 || table.Deleted > 0 {
			return true
		}
	}
	return false
}

func loadIdentitySyncConfigFromEnv() (identitySyncConfig, error) {
	cfg := identitySyncConfig{
		Enabled:            common.GetEnvOrDefaultBool("IDENTITY_SYNC_ENABLED", false),
		RemoteDSN:          strings.TrimSpace(os.Getenv(identitySyncRemoteDSNEnv)),
		Interval:           time.Duration(common.GetEnvOrDefault("IDENTITY_SYNC_INTERVAL_SECONDS", 300)) * time.Second,
		Timeout:            time.Duration(common.GetEnvOrDefault("IDENTITY_SYNC_TIMEOUT_SECONDS", 30)) * time.Second,
		BatchSize:          common.GetEnvOrDefault("IDENTITY_SYNC_BATCH_SIZE", 100),
		MaxRowsPerTable:    int64(common.GetEnvOrDefault("IDENTITY_SYNC_MAX_ROWS_PER_TABLE", 10000)),
		DeleteMissing:      common.GetEnvOrDefaultBool("IDENTITY_SYNC_DELETE_MISSING", true),
		RefreshOnSync:      common.GetEnvOrDefaultBool("IDENTITY_SYNC_REFRESH_ON_SYNC", true),
		RunOnStartup:       common.GetEnvOrDefaultBool("IDENTITY_SYNC_ON_STARTUP", true),
		FailStartupOnError: common.GetEnvOrDefaultBool("IDENTITY_SYNC_FAIL_STARTUP_ON_ERROR", false),
	}
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 100
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 30 * time.Second
	}
	tables, err := parseIdentitySyncTables(os.Getenv("IDENTITY_SYNC_TABLES"))
	if err != nil {
		return cfg, err
	}
	cfg.Tables = tables
	return cfg, nil
}

func parseIdentitySyncTables(raw string) ([]identitySyncTableSpec, error) {
	if strings.TrimSpace(raw) == "" {
		specs := make([]identitySyncTableSpec, 0, len(defaultIdentitySyncTableOrder))
		for _, table := range defaultIdentitySyncTableOrder {
			specs = append(specs, identitySyncAllowedTables[table])
		}
		return specs, nil
	}

	seen := make(map[string]struct{})
	var specs []identitySyncTableSpec
	for _, part := range strings.Split(raw, ",") {
		table := strings.TrimSpace(part)
		if table == "" {
			continue
		}
		if !identitySyncIdentifierPattern.MatchString(table) {
			return nil, fmt.Errorf("identity sync table %q is not a safe identifier", table)
		}
		spec, ok := identitySyncAllowedTables[table]
		if !ok {
			return nil, fmt.Errorf("identity sync table %q is not in the allowed table list", table)
		}
		if _, ok := seen[table]; ok {
			continue
		}
		seen[table] = struct{}{}
		specs = append(specs, spec)
	}
	if len(specs) == 0 {
		return nil, fmt.Errorf("IDENTITY_SYNC_TABLES did not contain any allowed table")
	}
	return specs, nil
}

func newIdentitySyncerFromEnv(cfg identitySyncConfig) (*identitySyncer, error) {
	if cfg.RemoteDSN == "" {
		return nil, fmt.Errorf("%s is required when IDENTITY_SYNC_ENABLED=true", identitySyncRemoteDSNEnv)
	}
	remoteDB, _, err := chooseDB(identitySyncRemoteDSNEnv, false)
	if err != nil {
		return nil, fmt.Errorf("connect identity sync remote database: %w", err)
	}
	configureIdentitySyncRemotePool(remoteDB)
	return &identitySyncer{
		config:   cfg,
		remoteDB: remoteDB,
		localDB:  DB,
	}, nil
}

func configureIdentitySyncRemotePool(db *gorm.DB) {
	sqlDB, err := db.DB()
	if err != nil {
		common.SysError("identity sync remote database pool unavailable: " + err.Error())
		return
	}
	sqlDB.SetMaxIdleConns(common.GetEnvOrDefault("IDENTITY_SYNC_REMOTE_MAX_IDLE_CONNS", 1))
	sqlDB.SetMaxOpenConns(common.GetEnvOrDefault("IDENTITY_SYNC_REMOTE_MAX_OPEN_CONNS", 2))
	sqlDB.SetConnMaxLifetime(time.Second * time.Duration(common.GetEnvOrDefault("IDENTITY_SYNC_REMOTE_CONN_MAX_LIFETIME_SECONDS", 300)))
}

// StartIdentitySync starts the optional one-way identity table sync loop.
// The optional afterSync callback should refresh in-memory state that depends on
// synchronized identity tables.
func StartIdentitySync(afterSync func()) {
	cfg, err := loadIdentitySyncConfigFromEnv()
	if err != nil {
		common.SysError("identity sync config error: " + err.Error())
		return
	}
	if !cfg.Enabled {
		return
	}

	syncer, err := newIdentitySyncerFromEnv(cfg)
	if err != nil {
		common.SysError("identity sync disabled: " + err.Error())
		if cfg.FailStartupOnError {
			common.FatalLog(err.Error())
		}
		return
	}

	runOnce := func(reason string) error {
		ctx, cancel := context.WithTimeout(context.Background(), cfg.Timeout)
		defer cancel()
		result, err := syncer.Sync(ctx)
		if err != nil {
			common.SysError("identity sync " + reason + " failed: " + err.Error())
			return err
		}
		logIdentitySyncResult(reason, result)
		if cfg.RefreshOnSync && result.DidWrite() {
			syncer.refreshCaches(result)
			if afterSync != nil {
				afterSync()
			}
		}
		return nil
	}

	if cfg.RunOnStartup {
		if err := runOnce("startup"); err != nil && cfg.FailStartupOnError {
			common.FatalLog(err.Error())
		}
	}

	if cfg.Interval <= 0 {
		common.SysLog("identity sync interval disabled; startup sync only")
		return
	}

	go func() {
		ticker := time.NewTicker(cfg.Interval)
		defer ticker.Stop()
		for range ticker.C {
			_ = runOnce("periodic")
		}
	}()
	common.SysLog(fmt.Sprintf("identity sync enabled for %d tables every %s", len(cfg.Tables), cfg.Interval))
}

func (s *identitySyncer) Sync(ctx context.Context) (identitySyncResult, error) {
	var result identitySyncResult
	for _, spec := range s.config.Tables {
		tableResult, err := s.syncTable(ctx, spec)
		result.Tables = append(result.Tables, tableResult)
		if err != nil {
			return result, err
		}
	}
	return result, nil
}

func (s *identitySyncer) syncTable(ctx context.Context, spec identitySyncTableSpec) (identitySyncTableResult, error) {
	result := identitySyncTableResult{Table: spec.Table}
	if err := ctx.Err(); err != nil {
		return result, err
	}
	if !s.remoteDB.Migrator().HasTable(spec.Table) {
		if spec.Required {
			return result, fmt.Errorf("remote identity table %s does not exist", spec.Table)
		}
		result.Skipped = true
		result.SkipCause = "remote table missing"
		return result, nil
	}
	if !s.localDB.Migrator().HasTable(spec.Table) {
		return result, fmt.Errorf("local identity table %s does not exist", spec.Table)
	}

	columns, err := identitySyncSharedColumns(s.remoteDB, s.localDB, spec.Table)
	if err != nil {
		return result, err
	}
	if err := identitySyncValidatePrimaryKeys(spec, columns); err != nil {
		return result, err
	}

	var total int64
	if err := s.remoteDB.WithContext(ctx).Table(spec.Table).Count(&total).Error; err != nil {
		return result, fmt.Errorf("count remote table %s: %w", spec.Table, err)
	}
	result.Rows = total
	if s.config.MaxRowsPerTable > 0 && total > s.config.MaxRowsPerTable {
		return result, fmt.Errorf("remote identity table %s has %d rows, above max %d", spec.Table, total, s.config.MaxRowsPerTable)
	}

	remoteRows, remoteKeySet, err := s.loadRemoteRows(ctx, spec, columns)
	if err != nil {
		return result, err
	}

	result.Upserted, err = s.upsertRows(ctx, spec, columns, remoteRows)
	if err != nil {
		return result, err
	}

	if s.config.DeleteMissing {
		result.Deleted, err = s.deleteMissingRows(ctx, spec, columns, remoteKeySet)
		if err != nil {
			return result, err
		}
	}

	return result, nil
}

func identitySyncSharedColumns(remoteDB, localDB *gorm.DB, table string) ([]string, error) {
	remoteCols, err := identitySyncColumnSet(remoteDB, table)
	if err != nil {
		return nil, fmt.Errorf("read remote columns for %s: %w", table, err)
	}
	localCols, err := identitySyncColumnSet(localDB, table)
	if err != nil {
		return nil, fmt.Errorf("read local columns for %s: %w", table, err)
	}
	var columns []string
	for col := range remoteCols {
		if _, ok := localCols[col]; ok {
			columns = append(columns, col)
		}
	}
	sort.Strings(columns)
	if len(columns) == 0 {
		return nil, fmt.Errorf("identity table %s has no shared columns", table)
	}
	return columns, nil
}

func identitySyncColumnSet(db *gorm.DB, table string) (map[string]struct{}, error) {
	columnTypes, err := db.Migrator().ColumnTypes(table)
	if err != nil {
		return nil, err
	}
	columns := make(map[string]struct{}, len(columnTypes))
	for _, col := range columnTypes {
		name := strings.ToLower(strings.TrimSpace(col.Name()))
		if name != "" {
			columns[name] = struct{}{}
		}
	}
	return columns, nil
}

func identitySyncValidatePrimaryKeys(spec identitySyncTableSpec, columns []string) error {
	columnSet := make(map[string]struct{}, len(columns))
	for _, col := range columns {
		columnSet[col] = struct{}{}
	}
	for _, pk := range spec.PrimaryKeys {
		if _, ok := columnSet[pk]; !ok {
			return fmt.Errorf("identity table %s shared columns do not include primary key %s", spec.Table, pk)
		}
	}
	return nil
}

func (s *identitySyncer) loadRemoteRows(ctx context.Context, spec identitySyncTableSpec, columns []string) ([]map[string]interface{}, map[string]struct{}, error) {
	order := identitySyncQuotedColumnList(s.remoteDB, spec.PrimaryKeys)
	selectColumns := identitySyncQuotedColumnList(s.remoteDB, columns)
	remoteKeys := make(map[string]struct{})
	remoteRows := make([]map[string]interface{}, 0)
	for offset := 0; ; offset += s.config.BatchSize {
		var rows []map[string]interface{}
		err := s.remoteDB.WithContext(ctx).
			Table(spec.Table).
			Select(selectColumns).
			Order(order).
			Limit(s.config.BatchSize).
			Offset(offset).
			Find(&rows).Error
		if err != nil {
			return nil, nil, fmt.Errorf("read remote table %s: %w", spec.Table, err)
		}
		if len(rows) == 0 {
			break
		}
		for _, row := range rows {
			normalizeIdentitySyncRow(row)
			remoteKeys[identitySyncPrimaryKeyString(row, spec.PrimaryKeys)] = struct{}{}
			remoteRows = append(remoteRows, row)
		}
		if len(rows) < s.config.BatchSize {
			break
		}
	}
	return remoteRows, remoteKeys, nil
}

func (s *identitySyncer) upsertRows(ctx context.Context, spec identitySyncTableSpec, columns []string, rows []map[string]interface{}) (int64, error) {
	if len(rows) == 0 {
		return 0, nil
	}
	updateColumns := identitySyncUpdateColumns(columns, spec.PrimaryKeys)
	onConflict := clause.OnConflict{
		Columns: identitySyncClauseColumns(spec.PrimaryKeys),
	}
	if len(updateColumns) == 0 {
		onConflict.DoNothing = true
	} else {
		onConflict.DoUpdates = clause.AssignmentColumns(updateColumns)
	}

	var affected int64
	for start := 0; start < len(rows); start += s.config.BatchSize {
		end := start + s.config.BatchSize
		if end > len(rows) {
			end = len(rows)
		}
		tx := s.localDB.WithContext(ctx).
			Table(spec.Table).
			Clauses(onConflict).
			Create(rows[start:end])
		if tx.Error != nil {
			return affected, fmt.Errorf("upsert local table %s: %w", spec.Table, tx.Error)
		}
		affected += tx.RowsAffected
	}
	return affected, nil
}

func identitySyncUpdateColumns(columns, primaryKeys []string) []string {
	pkSet := make(map[string]struct{}, len(primaryKeys))
	for _, pk := range primaryKeys {
		pkSet[pk] = struct{}{}
	}
	updateColumns := make([]string, 0, len(columns))
	for _, column := range columns {
		if _, ok := pkSet[column]; ok {
			continue
		}
		updateColumns = append(updateColumns, column)
	}
	return updateColumns
}

func identitySyncClauseColumns(columns []string) []clause.Column {
	result := make([]clause.Column, 0, len(columns))
	for _, column := range columns {
		result = append(result, clause.Column{Name: column})
	}
	return result
}

func (s *identitySyncer) deleteMissingRows(ctx context.Context, spec identitySyncTableSpec, columns []string, remoteKeys map[string]struct{}) (int64, error) {
	selectColumns := identitySyncSelectColumns(spec.PrimaryKeys, spec.CacheCols, columns)
	selectExpr := identitySyncQuotedColumnList(s.localDB, selectColumns)
	var localRows []map[string]interface{}
	if err := s.localDB.WithContext(ctx).Table(spec.Table).Select(selectExpr).Find(&localRows).Error; err != nil {
		return 0, fmt.Errorf("read local table %s keys: %w", spec.Table, err)
	}

	var deleted int64
	for _, row := range localRows {
		normalizeIdentitySyncRow(row)
		if _, ok := remoteKeys[identitySyncPrimaryKeyString(row, spec.PrimaryKeys)]; ok {
			continue
		}
		where, args := identitySyncPKWhere(s.localDB, row, spec.PrimaryKeys)
		tx := s.localDB.WithContext(ctx).Exec("DELETE FROM "+identitySyncQuoteIdentifier(s.localDB, spec.Table)+" WHERE "+where, args...)
		if tx.Error != nil {
			return deleted, fmt.Errorf("delete local table %s: %w", spec.Table, tx.Error)
		}
		deleted += tx.RowsAffected
		s.invalidateRowCache(spec, row)
	}
	return deleted, nil
}

func identitySyncSelectColumns(primaryKeys, cacheCols, available []string) []string {
	availableSet := make(map[string]struct{}, len(available))
	for _, col := range available {
		availableSet[col] = struct{}{}
	}
	seen := make(map[string]struct{})
	var columns []string
	for _, col := range append(primaryKeys, cacheCols...) {
		if _, ok := availableSet[col]; !ok {
			continue
		}
		if _, ok := seen[col]; ok {
			continue
		}
		seen[col] = struct{}{}
		columns = append(columns, col)
	}
	return columns
}

func identitySyncPKWhere(db *gorm.DB, row map[string]interface{}, primaryKeys []string) (string, []interface{}) {
	parts := make([]string, 0, len(primaryKeys))
	args := make([]interface{}, 0, len(primaryKeys))
	for _, pk := range primaryKeys {
		parts = append(parts, identitySyncQuoteIdentifier(db, pk)+" = ?")
		args = append(args, row[pk])
	}
	return strings.Join(parts, " AND "), args
}

func identitySyncQuotedColumnList(db *gorm.DB, columns []string) string {
	quoted := make([]string, 0, len(columns))
	for _, column := range columns {
		quoted = append(quoted, identitySyncQuoteIdentifier(db, column))
	}
	return strings.Join(quoted, ", ")
}

func identitySyncQuoteIdentifier(db *gorm.DB, identifier string) string {
	var builder strings.Builder
	db.Dialector.QuoteTo(&builder, identifier)
	return builder.String()
}

func identitySyncPrimaryKeyString(row map[string]interface{}, primaryKeys []string) string {
	parts := make([]string, 0, len(primaryKeys))
	for _, pk := range primaryKeys {
		parts = append(parts, fmt.Sprint(row[pk]))
	}
	return strings.Join(parts, "\x00")
}

func normalizeIdentitySyncRow(row map[string]interface{}) {
	for key, value := range row {
		lowerKey := strings.ToLower(key)
		if lowerKey != key {
			delete(row, key)
			row[lowerKey] = value
		}
		switch v := row[lowerKey].(type) {
		case []byte:
			row[lowerKey] = string(v)
		case sql.RawBytes:
			row[lowerKey] = string(v)
		}
	}
}

func (s *identitySyncer) refreshCaches(result identitySyncResult) {
	if !common.RedisEnabled {
		return
	}
	for _, tableResult := range result.Tables {
		if tableResult.Upserted == 0 && tableResult.Deleted == 0 {
			continue
		}
		switch tableResult.Table {
		case "users":
			var users []User
			if err := s.localDB.Select("id").Find(&users).Error; err != nil {
				common.SysError("identity sync failed to refresh user cache: " + err.Error())
				continue
			}
			for _, user := range users {
				if err := invalidateUserCache(user.Id); err != nil {
					common.SysError(fmt.Sprintf("identity sync failed to invalidate user cache %d: %s", user.Id, err.Error()))
				}
			}
		case "tokens":
			var tokens []Token
			if err := s.localDB.Select("key").Find(&tokens).Error; err != nil {
				common.SysError("identity sync failed to refresh token cache: " + err.Error())
				continue
			}
			for _, token := range tokens {
				if token.Key == "" {
					continue
				}
				if err := cacheDeleteToken(token.Key); err != nil {
					common.SysError("identity sync failed to invalidate token cache: " + err.Error())
				}
			}
		}
	}
}

func (s *identitySyncer) invalidateRowCache(spec identitySyncTableSpec, row map[string]interface{}) {
	if !common.RedisEnabled {
		return
	}
	switch spec.Table {
	case "users":
		if id, ok := identitySyncInt(row["id"]); ok {
			if err := invalidateUserCache(id); err != nil {
				common.SysError(fmt.Sprintf("identity sync failed to invalidate deleted user cache %d: %s", id, err.Error()))
			}
		}
	case "tokens":
		if key, ok := row["key"].(string); ok && key != "" {
			if err := cacheDeleteToken(key); err != nil {
				common.SysError("identity sync failed to invalidate deleted token cache: " + err.Error())
			}
		}
	}
}

func identitySyncInt(value interface{}) (int, bool) {
	switch v := value.(type) {
	case int:
		return v, true
	case int64:
		return int(v), true
	case int32:
		return int(v), true
	case uint:
		return int(v), true
	case uint64:
		return int(v), true
	case uint32:
		return int(v), true
	default:
		return 0, false
	}
}

func logIdentitySyncResult(reason string, result identitySyncResult) {
	parts := make([]string, 0, len(result.Tables))
	for _, table := range result.Tables {
		if table.Skipped {
			parts = append(parts, fmt.Sprintf("%s:skipped(%s)", table.Table, table.SkipCause))
			continue
		}
		parts = append(parts, fmt.Sprintf("%s:rows=%d,upserted=%d,deleted=%d", table.Table, table.Rows, table.Upserted, table.Deleted))
	}
	common.SysLog(fmt.Sprintf("identity sync %s complete: %s", reason, strings.Join(parts, "; ")))
}
