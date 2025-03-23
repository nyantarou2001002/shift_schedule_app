package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

// Employee は従業員の構造体です
type Employee struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Memo string `json:"memo"`
}

// initDB はMySQLへの接続を初期化します
func initDB() {
	var err error
	// DSNは環境に合わせて変更してください
	dsn := "root:@tcp(127.0.0.1:3306)/shift_schedle_app"
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal("Database connection error:", err)
	}
	if err = db.Ping(); err != nil {
		log.Fatal("Database ping error:", err)
	}
	fmt.Println("Database connected successfully!")
}

// employeesHandler はstaffテーブルから従業員一覧を取得しJSONで返します
func employeesHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("employeesHandler called")

	// display_order カラムでソート（※ display_order カラムをstaffテーブルに追加してください）
	rows, err := db.Query("SELECT id, name, memo FROM staff ORDER BY display_order ASC")
	if err != nil {
		log.Printf("Query error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var employees []Employee
	for rows.Next() {
		var emp Employee
		var id sql.NullInt64
		var name sql.NullString
		var memo sql.NullString

		if err := rows.Scan(&id, &name, &memo); err != nil {
			log.Printf("Scan error: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if id.Valid {
			emp.ID = int(id.Int64)
		}
		if name.Valid {
			emp.Name = name.String
		}
		if memo.Valid {
			emp.Memo = memo.String
		}
		employees = append(employees, emp)
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(employees); err != nil {
		log.Printf("JSON encoding error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	log.Println("JSON response sent successfully")
}

// addEmployeeHandler はPOSTされた従業員情報をDBに登録し、登録したレコードをJSONで返します
func addEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "リクエストボディの読み込みに失敗しました", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var newEmp Employee
	if err := json.Unmarshal(body, &newEmp); err != nil {
		http.Error(w, "JSONのパースに失敗しました", http.StatusBadRequest)
		return
	}

	// 名前は必須チェック
	if newEmp.Name == "" {
		http.Error(w, "名前は必須です", http.StatusBadRequest)
		return
	}

	// memoが空文字の場合はNULL扱いにできます（ここではそのまま挿入）
	// ※ 新規追加時はdisplay_orderは、最後尾の順番＋1などの処理を入れるのが一般的です。
	res, err := db.Exec("INSERT INTO staff (name, memo, display_order) VALUES (?, ?, ?)", newEmp.Name, newEmp.Memo, 9999)
	if err != nil {
		http.Error(w, fmt.Sprintf("DB挿入エラー: %v", err), http.StatusInternalServerError)
		return
	}
	insertID, err := res.LastInsertId()
	if err != nil {
		http.Error(w, "LastInsertId取得エラー", http.StatusInternalServerError)
		return
	}
	newEmp.ID = int(insertID)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(newEmp); err != nil {
		http.Error(w, "JSONエンコードエラー", http.StatusInternalServerError)
		return
	}
	log.Printf("New employee added: %+v", newEmp)
}

// updateEmployeeOrderHandler は、ドラッグ＆ドロップで変更された従業員の並び順をDBに保存します
func updateEmployeeOrderHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// リクエストボディから順番の配列を受け取る（例: { "order": [3,1,2,5,...] }）
	var orderUpdate struct {
		Order []int `json:"order"`
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "リクエストボディの読み込みに失敗しました", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if err := json.Unmarshal(body, &orderUpdate); err != nil {
		http.Error(w, "JSONのパースに失敗しました", http.StatusBadRequest)
		return
	}

	// トランザクションを開始して各従業員のdisplay_orderを更新する
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "トランザクション開始エラー", http.StatusInternalServerError)
		return
	}

	for index, id := range orderUpdate.Order {
		// display_order カラムに新しい順番（0始まり）をセット
		_, err := tx.Exec("UPDATE staff SET display_order = ? WHERE id = ?", index, id)
		if err != nil {
			tx.Rollback()
			http.Error(w, "並び順更新エラー", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "トランザクションコミットエラー", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// saveMemoHandler は、従業員のmemoを更新するハンドラーです
func saveMemoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// リクエストボディからIDとmemoを取得
	var input struct {
		ID   int    `json:"id"`
		Memo string `json:"memo"`
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "リクエストボディの読み込みに失敗しました", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if err := json.Unmarshal(body, &input); err != nil {
		http.Error(w, "JSONのパースに失敗しました", http.StatusBadRequest)
		return
	}

	// 対象従業員のmemoを更新
	_, err = db.Exec("UPDATE staff SET memo = ? WHERE id = ?", input.Memo, input.ID)
	if err != nil {
		http.Error(w, fmt.Sprintf("メモ更新エラー: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	log.Printf("Employee ID %d memo updated to: %s", input.ID, input.Memo)
}

// deleteEmployeeHandler は、従業員を削除するハンドラーです
func deleteEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// リクエストボディから ID を取得
	var input struct {
		ID int `json:"id"`
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "リクエストボディの読み込みに失敗しました", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	if err := json.Unmarshal(body, &input); err != nil {
		http.Error(w, "JSONのパースに失敗しました", http.StatusBadRequest)
		return
	}

	// 該当の従業員レコードを削除
	_, err = db.Exec("DELETE FROM staff WHERE id = ?", input.ID)
	if err != nil {
		http.Error(w, fmt.Sprintf("従業員削除エラー: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	log.Printf("Employee ID %d deleted", input.ID)
}

func main() {
	initDB()

	// 既存のハンドラーに加え、deleteEmployeeHandler を登録
	http.HandleFunc("/api/employees", employeesHandler)
	http.HandleFunc("/api/addEmployee", addEmployeeHandler)
	http.HandleFunc("/api/updateEmployeeOrder", updateEmployeeOrderHandler)
	http.HandleFunc("/api/saveMemo", saveMemoHandler)
	http.HandleFunc("/api/deleteEmployee", deleteEmployeeHandler) // ← 追加

	// 静的ファイルサーバー（HTML,JS,CSS など）
	http.Handle("/", http.FileServer(http.Dir("./static")))

	log.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
