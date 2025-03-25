package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"shift_schedule_app/db"
	"strconv"
	"strings"
)

// JobTypesHandler は、job_types テーブルから職種一覧を取得し JSON で返します
func JobTypesHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("JobTypesHandler called")

	// URLからIDを取得（パスが/api/job_types/123 のような形式の場合）
	var id int64 = 0
	path := strings.TrimPrefix(r.URL.Path, "/api/job_types")
	path = strings.TrimPrefix(path, "/")
	path = strings.TrimSuffix(path, "/")

	if path != "" {
		var err error
		id, err = strconv.ParseInt(path, 10, 64)
		if err != nil {
			http.Error(w, "無効なID形式です", http.StatusBadRequest)
			return
		}
	}

	// HTTPメソッドによって処理を分岐
	switch r.Method {
	case http.MethodGet:
		getJobTypes(w, r, id)
	case http.MethodPost:
		addJobType(w, r)
	case http.MethodPut:
		updateJobType(w, r, id)
	case http.MethodDelete:
		deleteJobType(w, r, id)
	default:
		http.Error(w, "許可されていないメソッドです", http.StatusMethodNotAllowed)
	}
}

// getJobTypes は職種一覧を取得します
func getJobTypes(w http.ResponseWriter, r *http.Request, id int64) {
	var err error
	var rows *sql.Rows

	if id > 0 {
		// 特定のIDの職種を取得
		rows, err = db.DB.Query("SELECT id, name FROM job_types WHERE id = ?", id)
	} else {
		// 全ての職種を取得
		rows, err = db.DB.Query("SELECT id, name FROM job_types ORDER BY id ASC")
	}

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type JobType struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}

	if id > 0 {
		// 単一の職種を返す場合
		var jobType JobType
		if rows.Next() {
			if err := rows.Scan(&jobType.ID, &jobType.Name); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(jobType)
		} else {
			http.Error(w, "職種が見つかりません", http.StatusNotFound)
		}
	} else {
		// 職種一覧を返す場合
		var jobTypes []JobType
		for rows.Next() {
			var jt JobType
			if err := rows.Scan(&jt.ID, &jt.Name); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			jobTypes = append(jobTypes, jt)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(jobTypes)
		log.Println("Job types JSON response sent successfully")
	}
}

// addJobType は新規職種を追加します
func addJobType(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name string `json:"name"`
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

	if input.Name == "" {
		http.Error(w, "名前は必須です", http.StatusBadRequest)
		return
	}

	res, err := db.DB.Exec("INSERT INTO job_types (name) VALUES (?)", input.Name)
	if err != nil {
		http.Error(w, fmt.Sprintf("DB挿入エラー: %v", err), http.StatusInternalServerError)
		return
	}

	insertID, err := res.LastInsertId()
	if err != nil {
		http.Error(w, "LastInsertIdエラー", http.StatusInternalServerError)
		return
	}

	newJobType := struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	}{
		ID:   insertID,
		Name: input.Name,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newJobType)
	log.Printf("New job type added: %+v", newJobType)
}

// updateJobType は職種を更新します
func updateJobType(w http.ResponseWriter, r *http.Request, id int64) {
	if id <= 0 {
		http.Error(w, "IDは必須です", http.StatusBadRequest)
		return
	}

	var input struct {
		Name string `json:"name"`
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

	if input.Name == "" {
		http.Error(w, "名前は必須です", http.StatusBadRequest)
		return
	}

	// まず職種が存在するか確認
	var exists bool
	err = db.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM job_types WHERE id = ?)", id).Scan(&exists)
	if err != nil {
		http.Error(w, fmt.Sprintf("DB検索エラー: %v", err), http.StatusInternalServerError)
		return
	}

	if !exists {
		http.Error(w, "職種が見つかりません", http.StatusNotFound)
		return
	}

	_, err = db.DB.Exec("UPDATE job_types SET name = ? WHERE id = ?", input.Name, id)
	if err != nil {
		http.Error(w, fmt.Sprintf("更新エラー: %v", err), http.StatusInternalServerError)
		return
	}

	updatedJobType := struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	}{
		ID:   id,
		Name: input.Name,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedJobType)
	log.Printf("Job type ID %d updated", id)
}

// deleteJobType は職種を削除します
func deleteJobType(w http.ResponseWriter, r *http.Request, id int64) {
	if id <= 0 {
		http.Error(w, "IDは必須です", http.StatusBadRequest)
		return
	}

	// まず職種が存在するか確認
	var exists bool
	err := db.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM job_types WHERE id = ?)", id).Scan(&exists)
	if err != nil {
		http.Error(w, fmt.Sprintf("DB検索エラー: %v", err), http.StatusInternalServerError)
		return
	}

	if !exists {
		http.Error(w, "職種が見つかりません", http.StatusNotFound)
		return
	}

	_, err = db.DB.Exec("DELETE FROM job_types WHERE id = ?", id)
	if err != nil {
		http.Error(w, fmt.Sprintf("削除エラー: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "message": "職種を削除しました"})
	log.Printf("Job type ID %d deleted", id)
}
