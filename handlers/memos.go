package handlers

import (
	"encoding/json"
	"net/http"
	"shift_schedule_app/db"
	"shift_schedule_app/models"
)

// GetMemos は備考データを取得するハンドラー
func GetMemos(w http.ResponseWriter, r *http.Request) {
	yearMonth := r.URL.Query().Get("yearMonth")
	isRightStr := r.URL.Query().Get("isRight")

	isRight := false
	if isRightStr == "true" {
		isRight = true
	}

	if yearMonth == "" {
		http.Error(w, "yearMonth parameter is required", http.StatusBadRequest)
		return
	}

	memos, err := db.GetMemos(yearMonth, isRight)
	if err != nil {
		http.Error(w, "Failed to get memos: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(memos)
}

// SaveMemo は備考を保存するハンドラー
func SaveMemo(w http.ResponseWriter, r *http.Request) {
	var memo models.Memo
	if err := json.NewDecoder(r.Body).Decode(&memo); err != nil {
		http.Error(w, "Invalid request: "+err.Error(), http.StatusBadRequest)
		return
	}

	savedMemo, err := db.SaveMemo(memo)
	if err != nil {
		http.Error(w, "Failed to save memo: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(savedMemo)
}
