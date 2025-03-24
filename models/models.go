package models

// Employee は従業員の構造体です
type Employee struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Memo string `json:"memo"`
}

// KintaiPattern は勤怠パターンの構造体です
type KintaiPattern struct {
	ID          int    `json:"id"`
	PatternName string `json:"pattern_name"`
	Description string `json:"description"`
}

// Shift はシフト情報の構造体です
type Shift struct {
	ID              int    `json:"id"`
	EmployeeID      int    `json:"employee_id"`
	Date            string `json:"date"`
	ShiftTime       string `json:"shift_time"`
	KintaiPatternID int    `json:"kintai_pattern_id"`
}
