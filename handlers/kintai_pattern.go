package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"shift_schedule_app/db"
	"shift_schedule_app/models"
)

// KintaiPatternsHandler は、kintai_pattern テーブルから勤怠パターン一覧を取得し JSON で返します
func KintaiPatternsHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("KintaiPatternsHandler called")
	rows, err := db.DB.Query("SELECT id, pattern_name, description FROM kintai_pattern ORDER BY id ASC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var patterns []models.KintaiPattern
	for rows.Next() {
		var p models.KintaiPattern
		if err := rows.Scan(&p.ID, &p.PatternName, &p.Description); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		patterns = append(patterns, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(patterns)
	log.Println("Kintai patterns JSON response sent successfully")
}

// AddKintaiPatternHandler は、POSTされた勤怠パターン情報をDBに登録し、登録結果をJSONで返します
func AddKintaiPatternHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var input struct {
		PatternName string `json:"pattern_name"`
		Description string `json:"description"`
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
	if input.PatternName == "" {
		http.Error(w, "pattern_nameは必須です", http.StatusBadRequest)
		return
	}
	res, err := db.DB.Exec("INSERT INTO kintai_pattern (pattern_name, description) VALUES (?, ?)", input.PatternName, input.Description)
	if err != nil {
		http.Error(w, fmt.Sprintf("DB挿入エラー: %v", err), http.StatusInternalServerError)
		return
	}
	insertID, err := res.LastInsertId()
	if err != nil {
		http.Error(w, "LastInsertIdエラー", http.StatusInternalServerError)
		return
	}
	newPattern := models.KintaiPattern{
		ID:          int(insertID),
		PatternName: input.PatternName,
		Description: input.Description,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newPattern)
	log.Printf("New kintai pattern added: %+v", newPattern)
}

// DeleteKintaiPatternHandler は、勤怠パターンを削除します
func DeleteKintaiPatternHandler(w http.ResponseWriter, r *http.Request) {
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
	_, err = db.DB.Exec("DELETE FROM kintai_pattern WHERE id = ?", input.ID)
	if err != nil {
		http.Error(w, fmt.Sprintf("削除エラー: %v", err), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
	log.Printf("Kintai pattern ID %d deleted", input.ID)
}
