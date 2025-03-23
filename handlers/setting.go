package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"shift_schedule_app/db"
	"shift_schedule_app/models"
)

// EmployeesHandler は、staff テーブルから従業員一覧を取得して JSON で返します
func EmployeesHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("EmployeesHandler called")
	rows, err := db.DB.Query("SELECT id, name, memo FROM staff ORDER BY display_order ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var employees []models.Employee
	for rows.Next() {
		var emp models.Employee
		var id sql.NullInt64
		var name sql.NullString
		var memo sql.NullString

		if err := rows.Scan(&id, &name, &memo); err != nil {
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
	json.NewEncoder(w).Encode(employees)
	log.Println("Employees JSON response sent successfully")
}

// AddEmployeeHandler は、POSTされた従業員情報をDBに登録し、そのレコードをJSONで返します
func AddEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "読み込みエラー", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	var newEmp models.Employee
	if err := json.Unmarshal(body, &newEmp); err != nil {
		http.Error(w, "JSONパースエラー", http.StatusBadRequest)
		return
	}
	if newEmp.Name == "" {
		http.Error(w, "名前は必須です", http.StatusBadRequest)
		return
	}

	res, err := db.DB.Exec("INSERT INTO staff (name, memo, display_order) VALUES (?, ?, ?)", newEmp.Name, newEmp.Memo, 9999)
	if err != nil {
		http.Error(w, fmt.Sprintf("DB挿入エラー: %v", err), http.StatusInternalServerError)
		return
	}
	insertID, err := res.LastInsertId()
	if err != nil {
		http.Error(w, "LastInsertIdエラー", http.StatusInternalServerError)
		return
	}
	newEmp.ID = int(insertID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newEmp)
	log.Printf("New employee added: %+v", newEmp)
}

// UpdateEmployeeOrderHandler は、従業員の並び順を更新します
func UpdateEmployeeOrderHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var orderUpdate struct {
		Order []int `json:"order"`
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "読み込みエラー", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if err := json.Unmarshal(body, &orderUpdate); err != nil {
		http.Error(w, "JSONパースエラー", http.StatusBadRequest)
		return
	}

	tx, err := db.DB.Begin()
	if err != nil {
		http.Error(w, "トランザクション開始エラー", http.StatusInternalServerError)
		return
	}
	for index, id := range orderUpdate.Order {
		_, err := tx.Exec("UPDATE staff SET display_order = ? WHERE id = ?", index, id)
		if err != nil {
			tx.Rollback()
			http.Error(w, "並び順更新エラー", http.StatusInternalServerError)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		http.Error(w, "コミットエラー", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// SaveMemoHandler は、従業員のmemoを更新します
func SaveMemoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input struct {
		ID   int    `json:"id"`
		Memo string `json:"memo"`
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "読み込みエラー", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if err := json.Unmarshal(body, &input); err != nil {
		http.Error(w, "JSONパースエラー", http.StatusBadRequest)
		return
	}
	_, err = db.DB.Exec("UPDATE staff SET memo = ? WHERE id = ?", input.Memo, input.ID)
	if err != nil {
		http.Error(w, fmt.Sprintf("メモ更新エラー: %v", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	log.Printf("Employee ID %d memo updated to: %s", input.ID, input.Memo)
}

// DeleteEmployeeHandler は、従業員を削除します
func DeleteEmployeeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input struct {
		ID int `json:"id"`
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "読み込みエラー", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()
	if err := json.Unmarshal(body, &input); err != nil {
		http.Error(w, "JSONパースエラー", http.StatusBadRequest)
		return
	}
	_, err = db.DB.Exec("DELETE FROM staff WHERE id = ?", input.ID)
	if err != nil {
		http.Error(w, fmt.Sprintf("従業員削除エラー: %v", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	log.Printf("Employee ID %d deleted", input.ID)
}
