package db

import (
	"database/sql"
	"log"

	_ "github.com/go-sql-driver/mysql"
)

var DB *sql.DB

// InitDB はMySQLへの接続を初期化し、グローバルなDB変数にセットします
func InitDB() {
	var err error
	// DSNは環境に合わせて変更してください
	dsn := "root:@tcp(127.0.0.1:3306)/shift_schedle_app"
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("Database connection error:", err)
	}
	if err = DB.Ping(); err != nil {
		log.Fatal("Database ping error:", err)
	}
	log.Println("Database connected successfully!")
}
