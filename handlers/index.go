package handlers

import (
	"encoding/json"
	"net/http"
	"shift_schedule_app/db"
	"shift_schedule_app/models"
	"time"
)

// GetShiftsHandler は指定された年月のシフト情報を取得するハンドラーです
func GetShiftsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// URLクエリから年月を取得
	yearMonth := r.URL.Query().Get("yearMonth")
	if yearMonth == "" {
		// 年月が指定されていない場合は現在の年月を使用
		now := time.Now()
		yearMonth = now.Format("2006-01")
	}

	// データベースからシフト情報を取得
	rows, err := db.DB.Query(`
        SELECT s.id, s.staff_id, s.date, s.shift_time, s.kintai_pattern_id
        FROM shifts s
        WHERE DATE_FORMAT(s.date, '%Y-%m') = ?
    `, yearMonth)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	shifts := []models.Shift{}
	for rows.Next() {
		var shift models.Shift
		err := rows.Scan(&shift.ID, &shift.EmployeeID, &shift.Date, &shift.ShiftTime, &shift.KintaiPatternID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		shifts = append(shifts, shift)
	}

	// JSONとして返す
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shifts)
}

// UpdateShiftHandler はシフトを更新するハンドラーです
func UpdateShiftHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// リクエストボディからデータをデコード
	var shift models.Shift
	err := json.NewDecoder(r.Body).Decode(&shift)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// 既存のシフトがあるか確認
	var existingID int
	err = db.DB.QueryRow(`
        SELECT id FROM shifts 
        WHERE staff_id = ? AND date = ? AND shift_time = ?
    `, shift.EmployeeID, shift.Date, shift.ShiftTime).Scan(&existingID)

	var result models.Shift
	if err == nil {
		// 既存のシフトがある場合は更新
		_, err = db.DB.Exec(`
            UPDATE shifts SET kintai_pattern_id = ?
            WHERE id = ?
        `, shift.KintaiPatternID, existingID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		result.ID = existingID
	} else {
		// 既存のシフトがない場合は新規作成
		res, err := db.DB.Exec(`
            INSERT INTO shifts (staff_id, date, shift_time, kintai_pattern_id)
            VALUES (?, ?, ?, ?)
        `, shift.EmployeeID, shift.Date, shift.ShiftTime, shift.KintaiPatternID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		id, _ := res.LastInsertId()
		result.ID = int(id)
	}

	// 結果を返す
	result.EmployeeID = shift.EmployeeID
	result.Date = shift.Date
	result.ShiftTime = shift.ShiftTime
	result.KintaiPatternID = shift.KintaiPatternID

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
