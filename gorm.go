package gorm

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"sync"
	"time"

	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

// for Config.cacheStore store PreparedStmtDB key
const preparedStmtDBKey = "preparedStmt"

// Config GORM config
type Config struct {
	// GORM perform single create, update, delete operations in transactions by default to ensure database data integrity
	// You can disable it by setting `SkipDefaultTransaction` to true
	SkipDefaultTransaction bool
	// NamingStrategy tables, columns naming strategy
	NamingStrategy schema.Namer
	// FullSaveAssociations full save associations
	FullSaveAssociations bool
	// Logger
	Logger logger.Interface
	// NowFunc the function to be used when creating a new timestamp
	NowFunc func() time.Time
	// DryRun generate sql without execute
	DryRun bool
	// PrepareStmt executes the given query in cached statement
	PrepareStmt bool
	// DisableAutomaticPing
	DisableAutomaticPing bool
	// DisableForeignKeyConstraintWhenMigrating
	DisableForeignKeyConstraintWhenMigrating bool
	// IgnoreRelationshipsWhenMigrating
	IgnoreRelationshipsWhenMigrating bool
	// DisableNestedTransaction disable nested transaction
	DisableNestedTransaction bool
	// AllowGlobalUpdate allow global update
	AllowGlobalUpdate bool
	// QueryFields executes the SQL query with all fields of the table
	QueryFields bool
	// CreateBatchSize default create batch size
	CreateBatchSize int
	// TranslateError enabling error translation
	TranslateError bool

	// ClauseBuilders clause builder
	ClauseBuilders map[string]clause.ClauseBuilder
	// ConnPool db conn pool
	ConnPool ConnPool
	// Dialector database dialector
	Dialector
	// Plugins registered plugins
	Plugins map[string]Plugin

	callbacks  *callbacks
	cacheStore *sync.Map
}

// Apply update config to new config
func (c *Config) Apply(config *Config) error {
	if config != c {
		*config = *c
	}
	return nil
}

// AfterInitialize initialize plugins after db connected
func (c *Config) AfterInitialize(db *DB) error {
	if db != nil {
		for _, plugin := range c.Plugins {
			if err := plugin.Initialize(db); err != nil {
				return err
			}
		}
	}
	return nil
}

// Option gorm option interface
type Option interface {
	Apply(*Config) error
	AfterInitialize(*DB) error
}

// DB GORM DB definition
type DB struct {
	*Config
	Error        error
	RowsAffected int64
	Statement    *Statement
	clone        int
}

// Session session config when create session with Session() method
type Session struct {
	DryRun                   bool
	PrepareStmt              bool
	NewDB                    bool
	Initialized              bool
	SkipHooks                bool
	SkipDefaultTransaction   bool
	DisableNestedTransaction bool
	AllowGlobalUpdate        bool
	FullSaveAssociations     bool
	QueryFields              bool
	Context                  context.Context
	Logger                   logger.Interface
	NowFunc                  func() time.Time
	CreateBatchSize          int
}

// Open initialize db session based on dialector
func Open(dialector Dialector, opts ...Option) (db *DB, err error) {
	config := &Config{}

	sort.Slice(opts, func(i, j int) bool {
		_, isConfig := opts[i].(*Config)
		_, isConfig2 := opts[j].(*Config)
		return isConfig && !isConfig2
	})

	for _, opt := range opts {
		if opt != nil {
			if applyErr := opt.Apply(config); applyErr != nil {
				return nil, applyErr
			}
			defer func(opt Option) {
				if errr := opt.AfterInitialize(db); errr != nil {
					err = errr
				}
			}(opt)
		}
	}

	if d, ok := dialector.(interface{ Apply(*Config) error }); ok {
		if err = d.Apply(config); err != nil {
			return
		}
	}

	if config.NamingStrategy == nil {
		config.NamingStrategy = schema.NamingStrategy{IdentifierMaxLength: 64} // Default Identifier length is 64
	}

	if config.Logger == nil {
		config.Logger = logger.Default
	}

	if config.NowFunc == nil {
		config.NowFunc = func() time.Time { return time.Now().Local() }
	}

	if dialector != nil {
		config.Dialector = dialector
	}

	if config.Plugins == nil {
		config.Plugins = map[string]Plugin{}
	}

	if config.cacheStore == nil {
		config.cacheStore = &sync.Map{}
	}

	db = &DB{Config: config, clone: 1}

	db.callbacks = initializeCallbacks(db)

	if config.ClauseBuilders == nil {
		config.ClauseBuilders = map[string]clause.ClauseBuilder{}
	}

	if config.Dialector != nil {
		err = config.Dialector.Initialize(db)

		if err != nil {
			if db, err := db.DB(); err == nil {
				_ = db.Close()
			}
		}
	}

	if config.PrepareStmt {
		preparedStmt := NewPreparedStmtDB(db.ConnPool)
		db.cacheStore.Store(preparedStmtDBKey, preparedStmt)
		db.ConnPool = preparedStmt
	}

	db.Statement = &Statement{
		DB:       db,
		ConnPool: db.ConnPool,
		Context:  context.Background(),
		Clauses:  map[string]clause.Clause{},
	}

	if err == nil && !config.DisableAutomaticPing {
		if pinger, ok := db.ConnPool.(interface{ Ping() error }); ok {
			err = pinger.Ping()
		}
	}

	if err != nil {
		config.Logger.Error(context.Background(), "failed to initialize database, got error %v", err)
	}

	return
}

// Session create new db session
func (db *DB) Session(config *Session) *DB {
	var (
		txConfig = *db.Config
		tx       = &DB{
			Config:    &txConfig,
			Statement: db.Statement,
			Error:     db.Error,
			clone:     1,
		}
	)
	if config.CreateBatchSize > 0 {
		tx.Config.CreateBatchSize = config.CreateBatchSize
	}

	if config.SkipDefaultTransaction {
		tx.Config.SkipDefaultTransaction = true
	}

	if config.AllowGlobalUpdate {
		txConfig.AllowGlobalUpdate = true
	}

	if config.FullSaveAssociations {
		txConfig.FullSaveAssociations = true
	}

	if config.Context != nil || config.PrepareStmt || config.SkipHooks {
		tx.Statement = tx.Statement.clone()
		tx.Statement.DB = tx
	}

	if config.Context != nil {
		tx.Statement.Context = config.Context
	}

	if config.PrepareStmt {
		var preparedStmt *PreparedStmtDB

		if v, ok := db.cacheStore.Load(preparedStmtDBKey); ok {
			preparedStmt = v.(*PreparedStmtDB)
		} else {
			preparedStmt = NewPreparedStmtDB(db.ConnPool)
			db.cacheStore.Store(preparedStmtDBKey, preparedStmt)
		}

		switch t := tx.Statement.ConnPool.(type) {
		case Tx:
			tx.Statement.ConnPool = &PreparedStmtTX{
				Tx:             t,
				PreparedStmtDB: preparedStmt,
			}
		default:
			tx.Statement.ConnPool = &PreparedStmtDB{
				ConnPool: db.Config.ConnPool,
				Mux:      preparedStmt.Mux,
				Stmts:    preparedStmt.Stmts,
			}
		}
		txConfig.ConnPool = tx.Statement.ConnPool
		txConfig.PrepareStmt = true
	}

	if config.SkipHooks {
		tx.Statement.SkipHooks = true
	}

	if config.DisableNestedTransaction {
		txConfig.DisableNestedTransaction = true
	}

	if !config.NewDB {
		tx.clone = 2
	}

	if config.DryRun {
		tx.Config.DryRun = true
	}

	if config.QueryFields {
		tx.Config.QueryFields = true
	}

	if config.Logger != nil {
		tx.Config.Logger = config.Logger
	}

	if config.NowFunc != nil {
		tx.Config.NowFunc = config.NowFunc
	}

	if config.Initialized {
		tx = tx.getInstance()
	}

	return tx
}

// WithContext change current instance db's context to ctx
func (db *DB) WithContext(ctx context.Context) *DB {
	return db.Session(&Session{Context: ctx})
}

// Debug start debug mode
func (db *DB) Debug() (tx *DB) {
	tx = db.getInstance()
	return tx.Session(&Session{
		Logger: db.Logger.LogMode(logger.Info),
	})
}

// Set store value with key into current db instance's context
func (db *DB) Set(key string, value interface{}) *DB {
	tx := db.getInstance()
	tx.Statement.Settings.Store(key, value)
	return tx
}

// Get get value with key from current db instance's context
func (db *DB) Get(key string) (interface{}, bool) {
	return db.Statement.Settings.Load(key)
}

// InstanceSet store value with key into current db instance's context
func (db *DB) InstanceSet(key string, value interface{}) *DB {
	tx := db.getInstance()
	tx.Statement.Settings.Store(fmt.Sprintf("%p", tx.Statement)+key, value)
	return tx
}

// InstanceGet get value with key from current db instance's context
func (db *DB) InstanceGet(key string) (interface{}, bool) {
	return db.Statement.Settings.Load(fmt.Sprintf("%p", db.Statement) + key)
}

// Callback returns callback manager
func (db *DB) Callback() *callbacks {
	return db.callbacks
}

// AddError add error to db
func (db *DB) AddError(err error) error {
	if err != nil {
		if db.Config.TranslateError {
			if errTranslator, ok := db.Dialector.(ErrorTranslator); ok {
				err = errTranslator.Translate(err)
			}
		}

		if db.Error == nil {
			db.Error = err
		} else {
			db.Error = fmt.Errorf("%v; %w", db.Error, err)
		}
	}
	return db.Error
}

// DB returns `*sql.DB`
func (db *DB) DB() (*sql.DB, error) {
	connPool := db.ConnPool

	if connector, ok := connPool.(GetDBConnectorWithContext); ok && connector != nil {
		return connector.GetDBConnWithContext(db)
	}

	if dbConnector, ok := connPool.(GetDBConnector); ok && dbConnector != nil {
		if sqldb, err := dbConnector.GetDBConn(); sqldb != nil || err != nil {
			return sqldb, err
		}
	}

	if sqldb, ok := connPool.(*sql.DB); ok && sqldb != nil {
		return sqldb, nil
	}

	return nil, ErrInvalidDB
}

func (db *DB) getInstance() *DB {
	if db.clone > 0 {
		tx := &DB{Config: db.Config, Error: db.Error}

		if db.clone == 1 {
			// clone with new statement
			tx.Statement = &Statement{
				DB:       tx,
				ConnPool: db.Statement.ConnPool,
				Context:  db.Statement.Context,
				Clauses:  map[string]clause.Clause{},
				Vars:     make([]interface{}, 0, 8),
			}
		} else {
			// with clone statement
			tx.Statement = db.Statement.clone()
			tx.Statement.DB = tx
		}

		return tx
	}

	return db
}

// Expr returns clause.Expr, which can be used to pass SQL expression as params
func Expr(expr string, args ...interface{}) clause.Expr {
	return clause.Expr{SQL: expr, Vars: args}
}

// SetupJoinTable setup join table schema
func (db *DB) SetupJoinTable(model interface{}, field string, joinTable interface{}) error {
	var (
		tx                      = db.getInstance()
		stmt                    = tx.Statement
		modelSchema, joinSchema *schema.Schema
	)

	err := stmt.Parse(model)
	if err != nil {
		return err
	}
	modelSchema = stmt.Schema

	err = stmt.Parse(joinTable)
	if err != nil {
		return err
	}
	joinSchema = stmt.Schema

	relation, ok := modelSchema.Relationships.Relations[field]
	isRelation := ok && relation.JoinTable != nil
	if !isRelation {
		return fmt.Errorf("failed to find relation: %s", field)
	}

	for _, ref := range relation.References {
		f := joinSchema.LookUpField(ref.ForeignKey.DBName)
		if f == nil {
			return fmt.Errorf("missing field %s for join table", ref.ForeignKey.DBName)
		}

		f.DataType = ref.ForeignKey.DataType
		f.GORMDataType = ref.ForeignKey.GORMDataType
		if f.Size == 0 {
			f.Size = ref.ForeignKey.Size
		}
		ref.ForeignKey = f
	}

	for name, rel := range relation.JoinTable.Relationships.Relations {
		if _, ok := joinSchema.Relationships.Relations[name]; !ok {
			rel.Schema = joinSchema
			joinSchema.Relationships.Relations[name] = rel
		}
	}
	relation.JoinTable = joinSchema

	return nil
}

// Use use plugin
func (db *DB) Use(plugin Plugin) error {
	name := plugin.Name()
	if _, ok := db.Plugins[name]; ok {
		return ErrRegistered
	}
	if err := plugin.Initialize(db); err != nil {
		return err
	}
	db.Plugins[name] = plugin
	return nil
}

// ToSQL for generate SQL string.
//
//	db.ToSQL(func(tx *gorm.DB) *gorm.DB {
//			return tx.Model(&User{}).Where(&User{Name: "foo", Age: 20})
//				.Limit(10).Offset(5)
//				.Order("name ASC")
//				.First(&User{})
//	})
func (db *DB) ToSQL(queryFn func(tx *DB) *DB) string {
	tx := queryFn(db.Session(&Session{DryRun: true, SkipDefaultTransaction: true}))
	stmt := tx.Statement

	return db.Dialector.Explain(stmt.SQL.String(), stmt.Vars...)
}
