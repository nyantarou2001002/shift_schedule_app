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
