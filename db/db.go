package db

import (
	"database/sql"
	"fmt"
	"log"
	"shift_schedule_app/models"
	"strconv"
	"strings"

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

// メモを取得する関数
func GetMemos(yearMonth string, isRight bool) ([]models.Memo, error) {
	// yearMonth フォーマットは "2025-03" など
	dateFrom := yearMonth + "-01"
	dateTo := ""

	// 月末の日付を計算
	parts := strings.Split(yearMonth, "-")
	if len(parts) == 2 {
		year, _ := strconv.Atoi(parts[0])
		month, _ := strconv.Atoi(parts[1])

		// 次の月の1日から1日引く
		if month == 12 {
			dateTo = fmt.Sprintf("%d-01-01", year+1)
		} else {
			dateTo = fmt.Sprintf("%d-%02d-01", year, month+1)
		}
	}

	isRightValue := 0
	if isRight {
		isRightValue = 1
	}

	rows, err := DB.Query(`
        SELECT id, date, shift_time, content 
        FROM memos 
        WHERE date >= ? AND date < ? AND is_right = ?
        ORDER BY date, shift_time
    `, dateFrom, dateTo, isRightValue)

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var memos []models.Memo
	for rows.Next() {
		var memo models.Memo
		var dateStr string
		if err := rows.Scan(&memo.ID, &dateStr, &memo.ShiftTime, &memo.Content); err != nil {
			return nil, err
		}
		memo.Date = dateStr
		memo.IsRight = isRight
		memos = append(memos, memo)
	}

	return memos, nil
}

// メモを保存する関数
func SaveMemo(memo models.Memo) (models.Memo, error) {
	// 既存のメモを検索
	var existingID int
	err := DB.QueryRow(`
        SELECT id FROM memos 
        WHERE date = ? AND shift_time = ? AND is_right = ?
    `, memo.Date, memo.ShiftTime, memo.IsRight).Scan(&existingID)

	isRightValue := 0
	if memo.IsRight {
		isRightValue = 1
	}

	var result sql.Result

	if err == sql.ErrNoRows {
		// 新規作成
		result, err = DB.Exec(`
            INSERT INTO memos (date, shift_time, content, is_right)
            VALUES (?, ?, ?, ?)
        `, memo.Date, memo.ShiftTime, memo.Content, isRightValue)

		if err != nil {
			return memo, err
		}

		id, _ := result.LastInsertId()
		memo.ID = int(id)
	} else if err == nil {
		// 更新
		_, err = DB.Exec(`
            UPDATE memos 
            SET content = ? 
            WHERE id = ?
        `, memo.Content, existingID)

		if err != nil {
			return memo, err
		}

		memo.ID = existingID
	} else {
		return memo, err
	}

	return memo, nil
}
