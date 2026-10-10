package tests_test

import (
	"context"
	"database/sql"
	"os"
	"reflect"
	"testing"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

type wrapperTx struct {
	*sql.Tx
	conn *wrapperConnPool
}

func (c *wrapperTx) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	c.conn.got = append(c.conn.got, query)
	return c.Tx.PrepareContext(ctx, query)
}

func (c *wrapperTx) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	c.conn.got = append(c.conn.got, query)
	return c.Tx.ExecContext(ctx, query, args...)
}

func (c *wrapperTx) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	c.conn.got = append(c.conn.got, query)
	return c.Tx.QueryContext(ctx, query, args...)
}

func (c *wrapperTx) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	c.conn.got = append(c.conn.got, query)
	return c.Tx.QueryRowContext(ctx, query, args...)
}

type wrapperConnPool struct {
	db     *sql.DB
	got    []string
	expect []string
}

func (c *wrapperConnPool) Ping() error {
	return c.db.Ping()
}

// If you use BeginTx returned *sql.Tx as shown below then you can't record queries in a transaction.
//
//	func (c *wrapperConnPool) BeginTx(ctx context.Context, opts *sql.TxOptions) (*sql.Tx, error) {
//		 return c.db.BeginTx(ctx, opts)
//	}
//
// You should use BeginTx returned gorm.Tx which could wrap *sql.Tx then you can record all queries.
func (c *wrapperConnPool) BeginTx(ctx context.Context, opts *sql.TxOptions) (gorm.ConnPool, error) {
	tx, err := c.db.BeginTx(ctx, opts)
	if err != nil {
		return nil, err
	}
	return &wrapperTx{Tx: tx, conn: c}, nil
}

func (c *wrapperConnPool) PrepareContext(ctx context.Context, query string) (*sql.Stmt, error) {
	c.got = append(c.got, query)
	return c.db.PrepareContext(ctx, query)
}

func (c *wrapperConnPool) ExecContext(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	c.got = append(c.got, query)
	return c.db.ExecContext(ctx, query, args...)
}

func (c *wrapperConnPool) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	c.got = append(c.got, query)
	return c.db.QueryContext(ctx, query, args...)
}

func (c *wrapperConnPool) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	c.got = append(c.got, query)
	return c.db.QueryRowContext(ctx, query, args...)
}

func TestConnPoolWrapper(t *testing.T) {
	dialect := os.Getenv("GORM_DIALECT")
	if dialect != "mysql" {
		t.SkipNow()
	}

	dbDSN := os.Getenv("GORM_DSN")
	if dbDSN == "" {
		dbDSN = "gorm:gorm@tcp(localhost:9910)/gorm?charset=utf8&parseTime=True&loc=Local"
	}
	nativeDB, err := sql.Open("mysql", dbDSN)
	if err != nil {
		t.Fatalf("Should open db success, but got %v", err)
	}

	conn := &wrapperConnPool{
		db: nativeDB,
		expect: []string{
			"SELECT VERSION()",
			"INSERT INTO `users` (`created_at`,`updated_at`,`deleted_at`,`name`,`age`,`birthday`,`company_id`,`manager_id`,`active`) VALUES (?,?,?,?,?,?,?,?,?)",
			"SELECT * FROM `users` WHERE name = ? AND `users`.`deleted_at` IS NULL ORDER BY `users`.`id` LIMIT 1",
			"INSERT INTO `users` (`created_at`,`updated_at`,`deleted_at`,`name`,`age`,`birthday`,`company_id`,`manager_id`,`active`) VALUES (?,?,?,?,?,?,?,?,?)",
			"SELECT * FROM `users` WHERE name = ? AND `users`.`deleted_at` IS NULL ORDER BY `users`.`id` LIMIT 1",
			"SELECT * FROM `users` WHERE name = ? AND `users`.`deleted_at` IS NULL ORDER BY `users`.`id` LIMIT 1",
			"INSERT INTO `users` (`created_at`,`updated_at`,`deleted_at`,`name`,`age`,`birthday`,`company_id`,`manager_id`,`active`) VALUES (?,?,?,?,?,?,?,?,?)",
			"SELECT * FROM `users` WHERE name = ? AND `users`.`deleted_at` IS NULL ORDER BY `users`.`id` LIMIT 1",
			"SELECT * FROM `users` WHERE name = ? AND `users`.`deleted_at` IS NULL ORDER BY `users`.`id` LIMIT 1",
		},
	}

	defer func() {
		if !reflect.DeepEqual(conn.got, conn.expect) {
			t.Errorf("expect %#v but got %#v", conn.expect, conn.got)
		}
	}()

	db, err := gorm.Open(mysql.New(mysql.Config{Conn: conn, DisableWithReturning: true}))
	if err != nil {
		t.Fatalf("Should open db success, but got %v", err)
	}

	tx := db.Begin()
	user := *GetUser("transaction", Config{})

	if err = tx.Save(&user).Error; err != nil {
		t.Fatalf("No error should raise, but got %v", err)
	}

	if err = tx.First(&User{}, "name = ?", "transaction").Error; err != nil {
		t.Fatalf("Should find saved record, but got %v", err)
	}

	user1 := *GetUser("transaction1-1", Config{})

	if err = tx.Save(&user1).Error; err != nil {
		t.Fatalf("No error should raise, but got %v", err)
	}

	if err = tx.First(&User{}, "name = ?", user1.Name).Error; err != nil {
		t.Fatalf("Should find saved record, but got %v", err)
	}

	if sqlTx, ok := tx.Statement.ConnPool.(gorm.TxCommitter); !ok || sqlTx == nil {
		t.Fatalf("Should return the underlying sql.Tx")
	}

	tx.Rollback()

	if err = db.First(&User{}, "name = ?", "transaction").Error; err == nil {
		t.Fatalf("Should not find record after rollback, but got %v", err)
	}

	txDB := db.Where("fake_name = ?", "fake_name")
	tx2 := txDB.Session(&gorm.Session{NewDB: true}).Begin()
	user2 := *GetUser("transaction-2", Config{})
	if err = tx2.Save(&user2).Error; err != nil {
		t.Fatalf("No error should raise, but got %v", err)
	}

	if err = tx2.First(&User{}, "name = ?", "transaction-2").Error; err != nil {
		t.Fatalf("Should find saved record, but got %v", err)
	}

	tx2.Commit()

	if err = db.First(&User{}, "name = ?", "transaction-2").Error; err != nil {
		t.Fatalf("Should be able to find committed record, but got %v", err)
	}
}
