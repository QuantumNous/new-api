package gorm

import (
	"context"
	"database/sql"
	"reflect"
	"sync"
)

type Stmt struct {
	*sql.Stmt
	Transaction bool
	prepared    chan struct{}
	prepareErr  error
}

type PreparedStmtDB struct {
	Stmts       map[string]*Stmt
	PreparedSQL []string
	Mux         *sync.RWMutex
	ConnPool
}

func NewPreparedStmtDB(connPool ConnPool) *PreparedStmtDB {
	return &PreparedStmtDB{
		ConnPool:    connPool,
		Stmts:       make(map[string]*Stmt),
		Mux:         &sync.RWMutex{},
		PreparedSQL: make([]string, 0, 100),
	}
}

func (db *PreparedStmtDB) GetDBConn() (*sql.DB, error) {
	if dbConnector, ok := db.ConnPool.(GetDBConnector); ok && dbConnector != nil {
		return dbConnector.GetDBConn()
	}

	if sqldb, ok := db.ConnPool.(*sql.DB); ok {
		return sqldb, nil
	}

	return nil, ErrInvalidDB
}

func (db *PreparedStmtDB) Close() {
	db.Mux.Lock()
	defer db.Mux.Unlock()

	for _, query := range db.PreparedSQL {
		if stmt, ok := db.Stmts[query]; ok {
			delete(db.Stmts, query)
			go stmt.Close()
		}
	}
}

func (db *PreparedStmtDB) Reset() {
	db.Mux.Lock()
	defer db.Mux.Unlock()

	for _, stmt := range db.Stmts {
		go stmt.Close()
	}
	db.PreparedSQL = make([]string, 0, 100)
	db.Stmts = make(map[string]*Stmt)
}

func (db *PreparedStmtDB) prepare(ctx context.Context, conn ConnPool, isTransaction bool, query string) (Stmt, error) {
	db.Mux.RLock()
	if stmt, ok := db.Stmts[query]; ok && (!stmt.Transaction || isTransaction) {
		db.Mux.RUnlock()
		// wait for other goroutines prepared
		<-stmt.prepared
		if stmt.prepareErr != nil {
			return Stmt{}, stmt.prepareErr
		}

		return *stmt, nil
	}
	db.Mux.RUnlock()

	db.Mux.Lock()
	// double check
	if stmt, ok := db.Stmts[query]; ok && (!stmt.Transaction || isTransaction) {
		db.Mux.Unlock()
		// wait for other goroutines prepared
		<-stmt.prepared
		if stmt.prepareErr != nil {
			return Stmt{}, stmt.prepareErr
		}

		return *stmt, nil
	}

	// cache preparing stmt first
	cacheStmt := Stmt{Transaction: isTransaction, prepared: make(chan struct{})}
	db.Stmts[query] = &cacheStmt
	db.Mux.Unlock()

	// prepare completed
	defer close(cacheStmt.prepared)

	// Reason why cannot lock conn.PrepareContext
	// suppose the maxopen is 1, g1 is creating record and g2 is querying record.
	// 1. g1 begin tx, g1 is requeue because of waiting for the system call, now `db.ConnPool` db.numOpen == 1.
	// 2. g2 select lock `conn.PrepareContext(ctx, query)`, now db.numOpen == db.maxOpen , wait for release.
	// 3. g1 tx exec insert, wait for unlock `conn.PrepareContext(ctx, query)` to finish tx and release.
	stmt, err := conn.PrepareContext(ctx, query)
	if err != nil {
		cacheStmt.prepareErr = err
		db.Mux.Lock()
		delete(db.Stmts, query)
		db.Mux.Unlock()
		return Stmt{}, err
	}

	db.Mux.Lock()
	cacheStmt.Stmt = stmt
	db.PreparedSQL = append(db.PreparedSQL, query)
	db.Mux.Unlock()

	return cacheStmt, nil
}

func (db *PreparedStmtDB) BeginTx(ctx context.Context, opt *sql.TxOptions) (ConnPool, error) {
	if beginner, ok := db.ConnPool.(TxBeginner); ok {
		tx, err := beginner.BeginTx(ctx, opt)
		return &PreparedStmtTX{PreparedStmtDB: db, Tx: tx}, err
	}
	return nil, ErrInvalidTransaction
}

func (db *PreparedStmtDB) ExecContext(ctx context.Context, query string, args ...interface{}) (result sql.Result, err error) {
	stmt, err := db.prepare(ctx, db.ConnPool, false, query)
	if err == nil {
		result, err = stmt.ExecContext(ctx, args...)
		if err != nil {
			db.Mux.Lock()
			defer db.Mux.Unlock()
			go stmt.Close()
			delete(db.Stmts, query)
		}
	}
	return result, err
}

func (db *PreparedStmtDB) QueryContext(ctx context.Context, query string, args ...interface{}) (rows *sql.Rows, err error) {
	stmt, err := db.prepare(ctx, db.ConnPool, false, query)
	if err == nil {
		rows, err = stmt.QueryContext(ctx, args...)
		if err != nil {
			db.Mux.Lock()
			defer db.Mux.Unlock()

			go stmt.Close()
			delete(db.Stmts, query)
		}
	}
	return rows, err
}

func (db *PreparedStmtDB) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	stmt, err := db.prepare(ctx, db.ConnPool, false, query)
	if err == nil {
		return stmt.QueryRowContext(ctx, args...)
	}
	return &sql.Row{}
}

type PreparedStmtTX struct {
	Tx
	PreparedStmtDB *PreparedStmtDB
}

func (tx *PreparedStmtTX) Commit() error {
	if tx.Tx != nil && !reflect.ValueOf(tx.Tx).IsNil() {
		return tx.Tx.Commit()
	}
	return ErrInvalidTransaction
}

func (tx *PreparedStmtTX) Rollback() error {
	if tx.Tx != nil && !reflect.ValueOf(tx.Tx).IsNil() {
		return tx.Tx.Rollback()
	}
	return ErrInvalidTransaction
}

func (tx *PreparedStmtTX) ExecContext(ctx context.Context, query string, args ...interface{}) (result sql.Result, err error) {
	stmt, err := tx.PreparedStmtDB.prepare(ctx, tx.Tx, true, query)
	if err == nil {
		result, err = tx.Tx.StmtContext(ctx, stmt.Stmt).ExecContext(ctx, args...)
		if err != nil {
			tx.PreparedStmtDB.Mux.Lock()
			defer tx.PreparedStmtDB.Mux.Unlock()

			go stmt.Close()
			delete(tx.PreparedStmtDB.Stmts, query)
		}
	}
	return result, err
}

func (tx *PreparedStmtTX) QueryContext(ctx context.Context, query string, args ...interface{}) (rows *sql.Rows, err error) {
	stmt, err := tx.PreparedStmtDB.prepare(ctx, tx.Tx, true, query)
	if err == nil {
		rows, err = tx.Tx.StmtContext(ctx, stmt.Stmt).QueryContext(ctx, args...)
		if err != nil {
			tx.PreparedStmtDB.Mux.Lock()
			defer tx.PreparedStmtDB.Mux.Unlock()

			go stmt.Close()
			delete(tx.PreparedStmtDB.Stmts, query)
		}
	}
	return rows, err
}

func (tx *PreparedStmtTX) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	stmt, err := tx.PreparedStmtDB.prepare(ctx, tx.Tx, true, query)
	if err == nil {
		return tx.Tx.StmtContext(ctx, stmt.Stmt).QueryRowContext(ctx, args...)
	}
	return &sql.Row{}
}
