package handlers

import (
	"encoding/json"
	"fmt"
	"log"
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

	log.Println("GetShiftsHandler called")

	// URLクエリから年月を取得
	yearMonth := r.URL.Query().Get("yearMonth")
	if yearMonth == "" {
		// 年月が指定されていない場合は現在の年月を使用
		now := time.Now()
		yearMonth = now.Format("2006-01")
	}

	log.Printf("Fetching shifts for year-month: %s", yearMonth)

	// データベースからシフト情報を取得
	rows, err := db.DB.Query(`
        SELECT s.id, s.staff_id, s.date, s.shift_time, s.kintai_pattern_id
        FROM shifts s
        WHERE DATE_FORMAT(s.date, '%Y-%m') = ?
    `, yearMonth)
	if err != nil {
		log.Printf("Error querying shifts: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	shifts := []models.Shift{}
	for rows.Next() {
		var shift models.Shift
		var staffID int
		err := rows.Scan(&shift.ID, &staffID, &shift.Date, &shift.ShiftTime, &shift.KintaiPatternID)
		if err != nil {
			log.Printf("Error scanning shift row: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// staff_id を employee_id にマッピング
		shift.EmployeeID = staffID
		shifts = append(shifts, shift)
	}

	log.Printf("Found %d shifts for %s", len(shifts), yearMonth)

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

	log.Println("UpdateShiftHandler called")

	// リクエストボディからデータをデコード
	var shift models.Shift
	err := json.NewDecoder(r.Body).Decode(&shift)
	if err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Updating shift: employee_id=%d, date=%s, shift_time=%s, kintai_pattern_id=%d",
		shift.EmployeeID, shift.Date, shift.ShiftTime, shift.KintaiPatternID)

	// 重要: employee_id を staff_id として使用
	staffID := shift.EmployeeID

	// まず、従業員IDがstaffテーブルに存在するか確認
	var exists bool
	err = db.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM staff WHERE id = ?)", staffID).Scan(&exists)
	if err != nil {
		log.Printf("Error checking staff existence: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if !exists {
		// スタッフが存在しない場合はエラー
		log.Printf("Staff with ID %d does not exist", staffID)
		http.Error(w, "Staff does not exist", http.StatusBadRequest)
		return
	}

	// 既存のシフトがあるか確認
	var existingID int
	err = db.DB.QueryRow(`
        SELECT id FROM shifts 
        WHERE staff_id = ? AND date = ? AND shift_time = ?
    `, staffID, shift.Date, shift.ShiftTime).Scan(&existingID)

	var result models.Shift
	if err == nil {
		log.Printf("Updating existing shift with ID %d", existingID)
		// 既存のシフトがある場合は更新
		_, err = db.DB.Exec(`
            UPDATE shifts SET kintai_pattern_id = ?
            WHERE id = ?
        `, shift.KintaiPatternID, existingID)
		if err != nil {
			log.Printf("Error updating shift: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		result.ID = existingID
	} else {
		log.Printf("Creating new shift for staff_id=%d", staffID)
		// 既存のシフトがない場合は新規作成
		res, err := db.DB.Exec(`
            INSERT INTO shifts (staff_id, date, shift_time, kintai_pattern_id)
            VALUES (?, ?, ?, ?)
        `, staffID, shift.Date, shift.ShiftTime, shift.KintaiPatternID)
		if err != nil {
			log.Printf("Error creating new shift: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		id, _ := res.LastInsertId()
		result.ID = int(id)
	}

	// 結果を返す
	result.EmployeeID = staffID
	result.Date = shift.Date
	result.ShiftTime = shift.ShiftTime
	result.KintaiPatternID = shift.KintaiPatternID

	log.Printf("Shift updated successfully with ID %d", result.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// DeleteShiftHandler はシフトを削除するハンドラーです
func DeleteShiftHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("DeleteShiftHandler called")

	// リクエストボディからデータをデコード
	var request struct {
		EmployeeID int    `json:"employee_id"`
		Date       string `json:"date"`
		ShiftTime  string `json:"shift_time"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Deleting shift: employee_id=%d, date=%s, shift_time=%s",
		request.EmployeeID, request.Date, request.ShiftTime)

	// employee_id を staff_id として使用
	staffID := request.EmployeeID

	// 削除対象のシフトを検索
	var shiftID int
	err = db.DB.QueryRow(`
        SELECT id FROM shifts 
        WHERE staff_id = ? AND date = ? AND shift_time = ?
    `, staffID, request.Date, request.ShiftTime).Scan(&shiftID)

	if err != nil {
		log.Printf("Shift not found: %v", err)
		// シフトが見つからない場合は正常に200 OKを返す（冪等性を保つため）
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Shift not found or already deleted",
		})
		return
	}

	// シフトを削除
	_, err = db.DB.Exec("DELETE FROM shifts WHERE id = ?", shiftID)
	if err != nil {
		log.Printf("Error deleting shift: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("Shift deleted successfully: ID=%d", shiftID)

	// 成功レスポンスを返す
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      shiftID,
		"message": "Shift deleted successfully",
	})
}

// GetShiftsSimulationHandler はシミュレーション用のシフト情報を取得するハンドラーです
func GetShiftsSimulationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("GetShiftsSimulationHandler called")

	// URLクエリから年月を取得
	yearMonth := r.URL.Query().Get("yearMonth")
	if yearMonth == "" {
		// 年月が指定されていない場合は現在の年月を使用
		now := time.Now()
		yearMonth = now.Format("2006-01")
	}

	log.Printf("Fetching simulation shifts for year-month: %s", yearMonth)

	// まず実際のシフトデータを取得
	regularShifts, err := getRegularShiftsData(yearMonth)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 次にシミュレーションのシフトデータを取得
	simulationShifts, err := getSimulationShiftsData(yearMonth)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// シミュレーションデータとして、通常のシフトをベースにシミュレーションシフトで上書き
	resultShifts := mergeShifts(regularShifts, simulationShifts)

	log.Printf("Found %d simulation shifts for %s", len(resultShifts), yearMonth)

	// JSONとして返す
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resultShifts)
}

// 通常のシフトデータを取得
func getRegularShiftsData(yearMonth string) ([]models.Shift, error) {
	rows, err := db.DB.Query(`
        SELECT s.id, s.staff_id, s.date, s.shift_time, s.kintai_pattern_id
        FROM shifts s
        WHERE DATE_FORMAT(s.date, '%Y-%m') = ?
    `, yearMonth)
	if err != nil {
		log.Printf("Error querying shifts: %v", err)
		return nil, err
	}
	defer rows.Close()

	shifts := []models.Shift{}
	for rows.Next() {
		var shift models.Shift
		var staffID int
		err := rows.Scan(&shift.ID, &staffID, &shift.Date, &shift.ShiftTime, &shift.KintaiPatternID)
		if err != nil {
			log.Printf("Error scanning shift row: %v", err)
			return nil, err
		}

		// staff_id を employee_id にマッピング
		shift.EmployeeID = staffID
		shifts = append(shifts, shift)
	}

	return shifts, nil
}

// シミュレーションのシフトデータを取得
func getSimulationShiftsData(yearMonth string) ([]models.ShiftSimulation, error) {
	rows, err := db.DB.Query(`
        SELECT s.id, s.staff_id, s.date, s.shift_time, s.kintai_pattern_id
        FROM shifts_simulation s
        WHERE DATE_FORMAT(s.date, '%Y-%m') = ?
    `, yearMonth)
	if err != nil {
		log.Printf("Error querying simulation shifts: %v", err)
		return nil, err
	}
	defer rows.Close()

	shifts := []models.ShiftSimulation{}
	for rows.Next() {
		var shift models.ShiftSimulation
		var staffID int
		err := rows.Scan(&shift.ID, &staffID, &shift.Date, &shift.ShiftTime, &shift.KintaiPatternID)
		if err != nil {
			log.Printf("Error scanning simulation shift row: %v", err)
			return nil, err
		}

		// staff_id を employee_id にマッピング
		shift.EmployeeID = staffID
		shifts = append(shifts, shift)
	}

	return shifts, nil
}

// シフトデータをマージする
func mergeShifts(regularShifts []models.Shift, simulationShifts []models.ShiftSimulation) []models.Shift {
	// キーをもとに高速に検索できるようマップ化
	shiftMap := make(map[string]models.Shift)

	// 通常シフトをマップに格納
	for _, shift := range regularShifts {
		key := fmt.Sprintf("%d_%s_%s", shift.EmployeeID, shift.Date, shift.ShiftTime)
		shiftMap[key] = shift
	}

	// シミュレーションシフトで上書き
	for _, simShift := range simulationShifts {
		key := fmt.Sprintf("%d_%s_%s", simShift.EmployeeID, simShift.Date, simShift.ShiftTime)
		shiftMap[key] = models.Shift{
			ID:              simShift.ID,
			EmployeeID:      simShift.EmployeeID,
			Date:            simShift.Date,
			ShiftTime:       simShift.ShiftTime,
			KintaiPatternID: simShift.KintaiPatternID,
		}
	}

	// マップから結果のリストを作成
	result := make([]models.Shift, 0, len(shiftMap))
	for _, shift := range shiftMap {
		result = append(result, shift)
	}

	return result
}

// UpdateShiftSimulationHandler はシミュレーション用シフトを更新するハンドラーです
func UpdateShiftSimulationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("UpdateShiftSimulationHandler called")

	// リクエストボディからデータをデコード
	var shift models.ShiftSimulation
	err := json.NewDecoder(r.Body).Decode(&shift)
	if err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Updating simulation shift: employee_id=%d, date=%s, shift_time=%s, kintai_pattern_id=%d",
		shift.EmployeeID, shift.Date, shift.ShiftTime, shift.KintaiPatternID)

	// employee_id を staff_id として使用
	staffID := shift.EmployeeID

	// スタッフの存在を確認
	var exists bool
	err = db.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM staff WHERE id = ?)", staffID).Scan(&exists)
	if err != nil {
		log.Printf("Error checking staff existence: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if !exists {
		log.Printf("Staff with ID %d does not exist", staffID)
		http.Error(w, "Staff does not exist", http.StatusBadRequest)
		return
	}

	// 既存のシミュレーションシフトがあるか確認
	var existingID int
	err = db.DB.QueryRow(`
        SELECT id FROM shifts_simulation
        WHERE staff_id = ? AND date = ? AND shift_time = ?
    `, staffID, shift.Date, shift.ShiftTime).Scan(&existingID)

	var result models.ShiftSimulation
	if err == nil {
		log.Printf("Updating existing simulation shift with ID %d", existingID)
		// 既存のシフトがある場合は更新
		_, err = db.DB.Exec(`
            UPDATE shifts_simulation SET kintai_pattern_id = ?
            WHERE id = ?
        `, shift.KintaiPatternID, existingID)
		if err != nil {
			log.Printf("Error updating simulation shift: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		result.ID = existingID
	} else {
		log.Printf("Creating new simulation shift for staff_id=%d", staffID)
		// 既存のシフトがない場合は新規作成
		res, err := db.DB.Exec(`
            INSERT INTO shifts_simulation (staff_id, date, shift_time, kintai_pattern_id)
            VALUES (?, ?, ?, ?)
        `, staffID, shift.Date, shift.ShiftTime, shift.KintaiPatternID)
		if err != nil {
			log.Printf("Error creating new simulation shift: %v", err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		id, _ := res.LastInsertId()
		result.ID = int(id)
	}

	// 結果を返す
	result.EmployeeID = staffID
	result.Date = shift.Date
	result.ShiftTime = shift.ShiftTime
	result.KintaiPatternID = shift.KintaiPatternID

	log.Printf("Simulation shift updated successfully with ID %d", result.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// DeleteShiftSimulationHandler はシミュレーション用シフトを削除するハンドラーです
func DeleteShiftSimulationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	log.Println("DeleteShiftSimulationHandler called")

	// リクエストボディからデータをデコード
	var request struct {
		EmployeeID int    `json:"employee_id"`
		Date       string `json:"date"`
		ShiftTime  string `json:"shift_time"`
	}

	err := json.NewDecoder(r.Body).Decode(&request)
	if err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	log.Printf("Deleting simulation shift: employee_id=%d, date=%s, shift_time=%s",
		request.EmployeeID, request.Date, request.ShiftTime)

	staffID := request.EmployeeID

	// 削除対象のシフトを検索
	var shiftID int
	err = db.DB.QueryRow(`
        SELECT id FROM shifts_simulation 
        WHERE staff_id = ? AND date = ? AND shift_time = ?
    `, staffID, request.Date, request.ShiftTime).Scan(&shiftID)

	if err != nil {
		log.Printf("Simulation shift not found: %v", err)
		// 存在しない場合は正常に200 OKを返す
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Simulation shift not found or already deleted",
		})
		return
	}

	// シフトを削除
	_, err = db.DB.Exec("DELETE FROM shifts_simulation WHERE id = ?", shiftID)
	if err != nil {
		log.Printf("Error deleting simulation shift: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("Simulation shift deleted successfully: ID=%d", shiftID)

	// 成功レスポンスを返す
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"id":      shiftID,
		"message": "Simulation shift deleted successfully",
	})
}
