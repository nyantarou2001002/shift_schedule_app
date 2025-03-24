package main

import (
	"log"
	"net/http"

	"shift_schedule_app/db"
	"shift_schedule_app/handlers"
)

func main() {
	// DB の初期化
	db.InitDB()

	// ハンドラーの登録
	http.HandleFunc("/api/employees", handlers.EmployeesHandler)
	http.HandleFunc("/api/addEmployee", handlers.AddEmployeeHandler)
	http.HandleFunc("/api/updateEmployeeOrder", handlers.UpdateEmployeeOrderHandler)
	http.HandleFunc("/api/saveMemo", handlers.SaveMemoHandler)
	http.HandleFunc("/api/deleteEmployee", handlers.DeleteEmployeeHandler)

	http.HandleFunc("/api/kintai_patterns", handlers.KintaiPatternsHandler)
	http.HandleFunc("/api/addKintaiPattern", handlers.AddKintaiPatternHandler)
	http.HandleFunc("/api/deleteKintaiPattern", handlers.DeleteKintaiPatternHandler)

	// シフト関連のエンドポイントを追加
	http.HandleFunc("/api/shifts", handlers.GetShiftsHandler)
	http.HandleFunc("/api/updateShift", handlers.UpdateShiftHandler)
	http.HandleFunc("/api/deleteShift", handlers.DeleteShiftHandler)

	// 静的ファイルサーバー
	http.Handle("/", http.FileServer(http.Dir("./static")))

	log.Println("Server started on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
