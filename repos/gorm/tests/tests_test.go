package tests_test

import (
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/driver/sqlserver"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	. "gorm.io/gorm/utils/tests"
)

var DB *gorm.DB
var (
	mysqlDSN     = "gorm:gorm@tcp(localhost:9910)/gorm?charset=utf8&parseTime=True&loc=Local"
	postgresDSN  = "user=gorm password=gorm dbname=gorm host=localhost port=9920 sslmode=disable TimeZone=Asia/Shanghai"
	sqlserverDSN = "sqlserver://gorm:LoremIpsum86@localhost:9930?database=gorm"
	tidbDSN      = "root:@tcp(localhost:9940)/test?charset=utf8&parseTime=True&loc=Local"
)

func init() {
	var err error
	if DB, err = OpenTestConnection(&gorm.Config{}); err != nil {
		log.Printf("failed to connect database, got error %v", err)
		os.Exit(1)
	} else {
		sqlDB, err := DB.DB()
		if err != nil {
			log.Printf("failed to connect database, got error %v", err)
			os.Exit(1)
		}

		err = sqlDB.Ping()
		if err != nil {
			log.Printf("failed to ping sqlDB, got error %v", err)
			os.Exit(1)
		}

		RunMigrations()
		if DB.Dialector.Name() == "sqlite" {
			DB.Exec("PRAGMA foreign_keys = ON")
		}
	}
}

func OpenTestConnection(cfg *gorm.Config) (db *gorm.DB, err error) {
	dbDSN := os.Getenv("GORM_DSN")
	switch os.Getenv("GORM_DIALECT") {
	case "mysql":
		log.Println("testing mysql...")
		if dbDSN == "" {
			dbDSN = mysqlDSN
		}
		db, err = gorm.Open(mysql.Open(dbDSN), cfg)
	case "postgres":
		log.Println("testing postgres...")
		if dbDSN == "" {
			dbDSN = postgresDSN
		}
		db, err = gorm.Open(postgres.New(postgres.Config{
			DSN:                  dbDSN,
			PreferSimpleProtocol: true,
		}), cfg)
	case "sqlserver":
		// go install github.com/microsoft/go-sqlcmd/cmd/sqlcmd@latest
		// SQLCMDPASSWORD=LoremIpsum86 sqlcmd -U sa -S localhost:9930
		// CREATE DATABASE gorm;
		// GO
		// CREATE LOGIN gorm WITH PASSWORD = 'LoremIpsum86';
		// CREATE USER gorm FROM LOGIN gorm;
		// ALTER SERVER ROLE sysadmin ADD MEMBER [gorm];
		// GO
		log.Println("testing sqlserver...")
		if dbDSN == "" {
			dbDSN = sqlserverDSN
		}
		db, err = gorm.Open(sqlserver.Open(dbDSN), cfg)
	case "tidb":
		log.Println("testing tidb...")
		if dbDSN == "" {
			dbDSN = tidbDSN
		}
		db, err = gorm.Open(mysql.Open(dbDSN), cfg)
	default:
		log.Println("testing sqlite3...")
		db, err = gorm.Open(sqlite.Open(filepath.Join(os.TempDir(), "gorm.db")), cfg)
	}

	if err != nil {
		return
	}

	if debug := os.Getenv("DEBUG"); debug == "true" {
		db.Logger = db.Logger.LogMode(logger.Info)
	} else if debug == "false" {
		db.Logger = db.Logger.LogMode(logger.Silent)
	}

	return
}

func RunMigrations() {
	var err error
	allModels := []interface{}{&User{}, &Account{}, &Pet{}, &Company{}, &Toy{}, &Language{}, &Coupon{}, &CouponProduct{}, &Order{}, &Parent{}, &Child{}}
	rand.Seed(time.Now().UnixNano())
	rand.Shuffle(len(allModels), func(i, j int) { allModels[i], allModels[j] = allModels[j], allModels[i] })

	DB.Migrator().DropTable("user_friends", "user_speaks")

	if err = DB.Migrator().DropTable(allModels...); err != nil {
		log.Printf("Failed to drop table, got error %v\n", err)
		os.Exit(1)
	}

	if err = DB.AutoMigrate(allModels...); err != nil {
		log.Printf("Failed to auto migrate, but got error %v\n", err)
		os.Exit(1)
	}

	for _, m := range allModels {
		if !DB.Migrator().HasTable(m) {
			log.Printf("Failed to create table for %#v\n", m)
			os.Exit(1)
		}
	}
}
