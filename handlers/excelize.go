package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"shift_schedule_app/db"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/xuri/excelize/v2"
)

// 祝日データをキャッシュするためのグローバル変数
var (
	holidayCache     = make(map[string]string) // 日付→祝日名のマップ
	holidayCacheLock sync.RWMutex
	holidayCacheInit sync.Once
)

// 初期化関数 - サーバー起動時に呼び出す
func InitHolidayCache() {
	holidayCacheInit.Do(func() {
		log.Println("祝日データのキャッシュを初期化します...")
		fetchHolidays()
	})
}

// 祝日データを取得する関数
func fetchHolidays() {
	// 祝日APIのURL
	apiURL := "https://holidays-jp.github.io/api/v1/date.json"

	// HTTPリクエスト
	resp, err := http.Get(apiURL)
	if err != nil {
		log.Printf("祝日APIの取得に失敗しました: %v", err)
		return
	}
	defer resp.Body.Close()

	// 応答が成功していることを確認
	if resp.StatusCode != http.StatusOK {
		log.Printf("祝日APIが異常なステータスコードを返しました: %d", resp.StatusCode)
		return
	}

	// JSONデコード
	var holidays map[string]string
	err = json.NewDecoder(resp.Body).Decode(&holidays)
	if err != nil {
		log.Printf("祝日データのデコードに失敗しました: %v", err)
		return
	}

	// ロックしてキャッシュを更新
	holidayCacheLock.Lock()
	defer holidayCacheLock.Unlock()

	// データをキャッシュに保存
	for date, name := range holidays {
		holidayCache[date] = name
	}

	log.Printf("祝日データを %d 件キャッシュしました", len(holidayCache))
}

// 日付が祝日かどうかをチェックする関数（修正版）
func isHoliday(year, month, day int) bool {
	t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)

	// 日曜日はtrue
	if t.Weekday() == time.Sunday {
		return true
	}

	// 日付フォーマットをYYYY-MM-DD形式に変換
	dateStr := fmt.Sprintf("%d-%02d-%02d", year, month, day)

	// キャッシュをロックして確認
	holidayCacheLock.RLock()
	defer holidayCacheLock.RUnlock()

	// 祝日リストに存在するかチェック
	_, isHoliday := holidayCache[dateStr]
	return isHoliday
}

// ExportShiftExcelHandler はシフト表をExcelファイルとしてエクスポートするハンドラです
func ExportShiftExcelHandler(w http.ResponseWriter, r *http.Request) {
	// POSTメソッドのみ許可
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 祝日データが初期化されていることを確認
	InitHolidayCache()

	log.Println("ExportShiftExcelHandler called")

	// クエリパラメータから年月を取得
	yearMonth := r.URL.Query().Get("yearMonth")
	if yearMonth == "" {
		// 年月が指定されていない場合は現在の年月を使用
		now := time.Now()
		yearMonth = now.Format("2006-01")
	}

	// 年と月を分離
	parts := strings.Split(yearMonth, "-")
	if len(parts) != 2 {
		http.Error(w, "Invalid yearMonth format", http.StatusBadRequest)
		return
	}

	year, err := strconv.Atoi(parts[0])
	if err != nil {
		http.Error(w, "Invalid year", http.StatusBadRequest)
		return
	}

	month, err := strconv.Atoi(parts[1])
	if err != nil {
		http.Error(w, "Invalid month", http.StatusBadRequest)
		return
	}

	// 月の日数を取得
	daysInMonth := getDaysInMonth(year, month)

	// Excelファイルを作成
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			log.Println(err)
		}
	}()

	// シート名を設定
	sheetName := fmt.Sprintf("%d年%d月", year, month)
	index, err := f.NewSheet(sheetName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	f.DeleteSheet("Sheet1") // デフォルトのシートを削除
	f.SetActiveSheet(index)

	// タイトル行を追加
	title := fmt.Sprintf("%d年%d月シフト表", year, month)
	f.SetCellValue(sheetName, "A1", title)
	// タイトルのスタイル設定
	titleStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
			Size: 14,
		},
	})
	if err == nil {
		f.SetCellStyle(sheetName, "A1", "A1", titleStyle)
	}
	f.MergeCell(sheetName, "A1", "J1")

	// 従業員データを取得
	employees, err := getEmployeesForExcel()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 各セクション（区分線の間）の開始列を追跡
	sectionStartCols := []string{"A"} // 最初のセクションはA列から開始
	allDateCols := []string{"A"}      // すべての日付列を記録
	allWeekdayCols := []string{"B"}   // すべての曜日列を記録

	// 各セクションの従業員列を追跡
	sectionEmpCols := make(map[int][]string) // セクションインデックス -> 従業員の列のリスト
	sectionEmpCols[0] = []string{}           // 最初のセクションの従業員列を初期化

	// 現在の列位置（インデックスとして管理）
	colIndex := 2       // C列（インデックス2）から従業員名を開始
	currentSection := 0 // 現在のセクションインデックス

	// 区分線の位置を保存
	blackBarPositions := []int{}

	// ヘッダー行（3行目）- 最初のセクションのヘッダー
	f.SetCellValue(sheetName, "A3", "日付")
	f.SetCellValue(sheetName, "B3", "曜日")

	// インデックスから列名を取得する関数
	getColName := func(idx int) string {
		// エクセルの列名はA, B, C, ... Z, AA, AB, ...と続く
		if idx < 26 {
			// A-Z (0-25)
			return string(rune('A' + idx))
		}
		// AA以降 (26-)
		firstChar := (idx / 26) - 1 // 最初の文字は0基準（A=0）なので-1
		secondChar := idx % 26
		return string(rune('A'+firstChar)) + string(rune('A'+secondChar))
	}

	// 従業員名をヘッダーに設定（C列からスタート）
	for i, emp := range employees {
		if emp.Name == "black_bar" {
			// 区分線の位置を記録
			blackBarPositions = append(blackBarPositions, i)

			// 区分線の後に新しいセクションを開始
			currentSection++

			// 区分線の後に新しい日付と曜日の列を追加
			dateColIndex := colIndex
			weekdayColIndex := colIndex + 1
			dateCol := getColName(dateColIndex)
			weekdayCol := getColName(weekdayColIndex)

			// 区分線後の日付と曜日の列ヘッダーを設定
			f.SetCellValue(sheetName, dateCol+"3", "日付")
			f.SetCellValue(sheetName, weekdayCol+"3", "曜日")

			// 新しいセクションの開始列と日付/曜日の列を記録
			sectionStartCols = append(sectionStartCols, dateCol)
			allDateCols = append(allDateCols, dateCol)
			allWeekdayCols = append(allWeekdayCols, weekdayCol)

			// 新しいセクションの従業員列の配列を初期化
			sectionEmpCols[currentSection] = []string{}

			// 列位置を更新（日付と曜日の2列を追加したので+2）
			colIndex += 2
		} else {
			// 従業員名をヘッダーに設定
			col := getColName(colIndex)
			cellRef := col + "3"
			f.SetCellValue(sheetName, cellRef, emp.Name)

			// 従業員列を現在のセクションに記録
			sectionEmpCols[currentSection] = append(sectionEmpCols[currentSection], col)

			// 次の列へ
			colIndex++
		}
	}

	// 備考列を追加
	memoCol := getColName(colIndex)
	f.SetCellValue(sheetName, memoCol+"3", "備考")
	colIndex++

	// 備考列の右側に日付と曜日の列を追加
	rightDateColIndex := colIndex
	rightWeekdayColIndex := colIndex + 1
	rightDateCol := getColName(rightDateColIndex)
	rightWeekdayCol := getColName(rightWeekdayColIndex)

	// 右端の日付と曜日のヘッダーを設定
	f.SetCellValue(sheetName, rightDateCol+"3", "日付")
	f.SetCellValue(sheetName, rightWeekdayCol+"3", "曜日")

	// 日付と曜日の列を記録
	allDateCols = append(allDateCols, rightDateCol)
	allWeekdayCols = append(allWeekdayCols, rightWeekdayCol)

	// ヘッダー行のスタイル
	headerStyle, err := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Bold: true,
			Size: 11,
		},
		Fill: excelize.Fill{
			Type:    "pattern",
			Color:   []string{"#E0E0E0"},
			Pattern: 1,
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#000000", Style: 1},
			{Type: "bottom", Color: "#000000", Style: 2}, // 下線を太く
			{Type: "left", Color: "#000000", Style: 1},
			{Type: "right", Color: "#000000", Style: 1},
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
	})
	if err == nil {
		// ヘッダー行全体にスタイルを適用（右端の日付・曜日列も含める）
		headerRange := fmt.Sprintf("A3:%s3", rightWeekdayCol)
		f.SetCellStyle(sheetName, "A3", headerRange, headerStyle)
	}

	// 日付と曜日のセルスタイル（通常）
	normalDateStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#D0D0D0", Style: 1},
			{Type: "bottom", Color: "#D0D0D0", Style: 1},
			{Type: "left", Color: "#D0D0D0", Style: 1},
			{Type: "right", Color: "#D0D0D0", Style: 1},
		},
	})

	// 日付と曜日のセルスタイル（休日・削除日）
	redDateStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{
			Color: "#FF0000",
			Bold:  true,
		},
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#D0D0D0", Style: 1},
			{Type: "bottom", Color: "#D0D0D0", Style: 1},
			{Type: "left", Color: "#D0D0D0", Style: 1},
			{Type: "right", Color: "#D0D0D0", Style: 1},
		},
	})

	// 日付行
	currentRow := 4
	for day := 1; day <= daysInMonth; day++ {
		date := fmt.Sprintf("%d-%02d-%02d", year, month, day)
		weekday := getWeekdayJapanese(year, month, day)

		// 色設定の判定（祝日、日曜日、削除された日付）
		isHolidayDate := isHoliday(year, month, day)
		isSunday := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC).Weekday() == time.Sunday
		isDeleted := isDateDeleted(date)
		isRed := isHolidayDate || isSunday || isDeleted

		// 全セクションの日付列と曜日列にデータを設定
		for i := 0; i < len(allDateCols); i++ {
			dateCol := allDateCols[i]
			weekdayCol := allWeekdayCols[i]

			// 日付と曜日を設定
			f.SetCellValue(sheetName, fmt.Sprintf("%s%d", dateCol, currentRow), day)
			f.SetCellValue(sheetName, fmt.Sprintf("%s%d", weekdayCol, currentRow), weekday)

			// スタイルを適用
			if isRed {
				f.SetCellStyle(sheetName, fmt.Sprintf("%s%d", dateCol, currentRow), fmt.Sprintf("%s%d", dateCol, currentRow), redDateStyle)
				f.SetCellStyle(sheetName, fmt.Sprintf("%s%d", weekdayCol, currentRow), fmt.Sprintf("%s%d", weekdayCol, currentRow), redDateStyle)
			} else {
				f.SetCellStyle(sheetName, fmt.Sprintf("%s%d", dateCol, currentRow), fmt.Sprintf("%s%d", dateCol, currentRow), normalDateStyle)
				f.SetCellStyle(sheetName, fmt.Sprintf("%s%d", weekdayCol, currentRow), fmt.Sprintf("%s%d", weekdayCol, currentRow), normalDateStyle)
			}
		}

		// 備考データを取得
		memo, err := getMemoForDate(date, false) // 左側カレンダーの備考を取得
		if err != nil {
			log.Printf("Error fetching memo for date %s: %v", date, err)
		}

		// 備考セルに値を設定
		if memo != "" {
			f.SetCellValue(sheetName, fmt.Sprintf("%s%d", memoCol, currentRow), memo)
		}

		// 各セクションの従業員ごとにシフトデータを取得してまとめる
		for sectionIdx, empCols := range sectionEmpCols {
			// 当該セクションの従業員列を処理
			for colIdx, empCol := range empCols {
				// 従業員の配列インデックスを計算
				empIndex := 0
				for i := 0; i < sectionIdx; i++ {
					// 前のセクションの従業員数 + 区分線（1）を加算
					empIndex += len(sectionEmpCols[i]) + 1
				}
				empIndex += colIdx // 現在のセクション内のインデックス

				emp := employees[empIndex]

				// 朝・昼・夜のシフトを取得して1つのセルにまとめる
				if emp.ID > 0 {
					// 各時間帯のシフトデータを取得
					morningShift, err := getShiftForExcel(emp.ID, date, "morning")
					if err != nil {
						log.Printf("朝のシフト取得エラー: 社員ID=%d, 日付=%s, エラー=%v",
							emp.ID, date, err)
						morningShift.PatternID = 0
					}

					dayShift, err := getShiftForExcel(emp.ID, date, "afternoon")
					if err != nil {
						log.Printf("昼のシフト取得エラー: 社員ID=%d, 日付=%s, エラー=%v",
							emp.ID, date, err)
						dayShift.PatternID = 0
					}

					eveningShift, err := getShiftForExcel(emp.ID, date, "evening")
					if err != nil {
						log.Printf("夜のシフト取得エラー: 社員ID=%d, 日付=%s, エラー=%v",
							emp.ID, date, err)
						eveningShift.PatternID = 0
					}

					// シフトパターン名を取得
					morningPatternName := ""
					dayPatternName := ""
					eveningPatternName := ""

					if morningShift.PatternID > 0 {
						morningPatternName, err = getPatternName(morningShift.PatternID)
						if err != nil {
							log.Printf("朝パターン名取得エラー: ID=%d, エラー=%v",
								morningShift.PatternID, err)
							morningPatternName = fmt.Sprintf("ID:%d", morningShift.PatternID)
						}
					}

					if dayShift.PatternID > 0 {
						dayPatternName, err = getPatternName(dayShift.PatternID)
						if err != nil {
							log.Printf("昼パターン名取得エラー: ID=%d, エラー=%v",
								dayShift.PatternID, err)
							dayPatternName = fmt.Sprintf("ID:%d", dayShift.PatternID)
						}
					}

					if eveningShift.PatternID > 0 {
						eveningPatternName, err = getPatternName(eveningShift.PatternID)
						if err != nil {
							log.Printf("夜パターン名取得エラー: ID=%d, エラー=%v",
								eveningShift.PatternID, err)
							eveningPatternName = fmt.Sprintf("ID:%d", eveningShift.PatternID)
						}
					}

					// パターン名を1つにまとめる
					combinedPattern := morningPatternName
					if dayPatternName != "" && dayPatternName != morningPatternName {
						if combinedPattern != "" {
							combinedPattern += " "
						}
						combinedPattern += dayPatternName
					}
					if eveningPatternName != "" && eveningPatternName != dayPatternName && eveningPatternName != morningPatternName {
						if combinedPattern != "" {
							combinedPattern += " "
						}
						combinedPattern += eveningPatternName
					}

					// デバッグログ
					if morningShift.PatternID > 0 || dayShift.PatternID > 0 || eveningShift.PatternID > 0 {
						log.Printf("シフト設定: 社員ID=%d, 名前=%s, 日付=%s, パターン=[朝:%s, 昼:%s, 夜:%s], 結合=%s",
							emp.ID, emp.Name, date, morningPatternName, dayPatternName, eveningPatternName, combinedPattern)
					}

					cellRef := fmt.Sprintf("%s%d", empCol, currentRow)
					f.SetCellValue(sheetName, cellRef, combinedPattern)

					// パターンによって色を設定
					setShiftCellStyleCombined(f, sheetName, cellRef, morningPatternName, dayPatternName, eveningPatternName)
				}
			}
		}

		// 次の日付の行
		currentRow++
	}

	// 区分線の列を太い罫線でマーク（列の境界に設定）
	for i := 1; i < len(sectionStartCols); i++ {
		// 区分線となる列（各セクションの開始列）
		dividerCol := sectionStartCols[i]

		// 区分線の左罫線を太くする
		dividerStyle, _ := f.NewStyle(&excelize.Style{
			Border: []excelize.Border{
				{Type: "left", Color: "#000000", Style: 5}, // 太い実線
			},
		})

		// 区分線スタイルを適用（ヘッダー行と全ての日付行に対して）
		for row := 3; row < 4+daysInMonth; row++ {
			cellRef := fmt.Sprintf("%s%d", dividerCol, row)
			f.SetCellStyle(sheetName, cellRef, cellRef, dividerStyle)
		}
	}

	// 右端の日付・曜日列の左罫線も太くする
	rightDividerStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "#000000", Style: 5}, // 太い実線
		},
	})

	// 右端日付列に区分線スタイルを適用
	for row := 3; row < 4+daysInMonth; row++ {
		cellRef := fmt.Sprintf("%s%d", rightDateCol, row)
		f.SetCellStyle(sheetName, cellRef, cellRef, rightDividerStyle)
	}

	// 備考セルのスタイルを改善
	memoStyle, _ := f.NewStyle(&excelize.Style{
		Alignment: &excelize.Alignment{
			Vertical: "top", // 上揃え
			WrapText: true,  // テキストの折り返し
		},
		Border: []excelize.Border{
			{Type: "top", Color: "#D0D0D0", Style: 1},
			{Type: "bottom", Color: "#D0D0D0", Style: 1},
			{Type: "left", Color: "#000000", Style: 1},  // 左罫線を強調
			{Type: "right", Color: "#000000", Style: 1}, // 右罫線も強調
		},
	})

	// 備考セルにスタイル適用
	for row := 4; row < 4+daysInMonth; row++ {
		memoCellRef := fmt.Sprintf("%s%d", memoCol, row)
		f.SetCellStyle(sheetName, memoCellRef, memoCellRef, memoStyle)
	}

	// 列幅の調整 - すべての日付と曜日の列
	for _, dateCol := range allDateCols {
		f.SetColWidth(sheetName, dateCol, dateCol, 8) // 日付列
	}
	for _, weekdayCol := range allWeekdayCols {
		f.SetColWidth(sheetName, weekdayCol, weekdayCol, 8) // 曜日列
	}

	// 従業員列の幅調整 - 各セクションの従業員列
	for _, empCols := range sectionEmpCols {
		for _, empCol := range empCols {
			f.SetColWidth(sheetName, empCol, empCol, 12) // 従業員列
		}
	}

	// 備考列の幅
	f.SetColWidth(sheetName, memoCol, memoCol, 30) // 備考列

	// ヘッダーを全ページに表示
	f.SetHeaderFooter(sheetName, &excelize.HeaderFooterOptions{
		DifferentFirst:   false,
		DifferentOddEven: false,
		OddHeader:        fmt.Sprintf("&C%s", title),
		OddFooter:        "&C&P / &N",
	})

	// ファイル名設定
	filename := fmt.Sprintf("シフト表_%d年%d月.xlsx", year, month)

	// Content-Typeヘッダーを設定
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// ファイルをレスポンスとして書き込み
	if err := f.Write(w); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("Excel file '%s' exported successfully", filename)
}

// シフトパターンに応じたセルスタイルを設定（朝昼夜の組み合わせ）
func setShiftCellStyleCombined(f *excelize.File, sheetName, cellRef, morningPattern, dayPattern, eveningPattern string) {
	// 基本のスタイル設定（中央揃え）
	baseStyle := &excelize.Style{
		Alignment: &excelize.Alignment{
			Horizontal: "center",
			Vertical:   "center",
		},
	}

	// パターンの組み合わせに基づいて色を決定
	// 基本的には最初のパターンの色を優先
	var fontColor string
	var isBold bool = true

	if morningPattern != "" {
		fontColor = getPatternColor(morningPattern)
	} else if dayPattern != "" {
		fontColor = getPatternColor(dayPattern)
	} else if eveningPattern != "" {
		fontColor = getPatternColor(eveningPattern)
	} else {
		// パターンがない場合
		fontColor = "#000000"
		isBold = false
	}

	// フォントスタイル設定
	baseStyle.Font = &excelize.Font{
		Color: fontColor,
		Bold:  isBold,
	}

	// セルに罫線を追加
	baseStyle.Border = []excelize.Border{
		{Type: "top", Color: "#D0D0D0", Style: 1},
		{Type: "bottom", Color: "#D0D0D0", Style: 1},
		{Type: "left", Color: "#D0D0D0", Style: 1},
		{Type: "right", Color: "#D0D0D0", Style: 1},
	}

	// スタイルを適用
	styleID, err := f.NewStyle(baseStyle)
	if err == nil {
		f.SetCellStyle(sheetName, cellRef, cellRef, styleID)
	}
}

// パターン名から色コードを取得
func getPatternColor(patternName string) string {
	switch patternName {
	case "早番", "Mそ":
		return "#28a745" // 緑
	case "日勤", "D1", "D2":
		return "#0066cc" // 青
	case "遅番", "SL", "L1", "L2":
		return "#007bff" // 明るい青
	case "休み", "SD":
		return "#dc3545" // 赤
	case "有給", "Dそ":
		return "#fd7e14" // オレンジ
	default:
		return "#000000" // 黒
	}
}

// Helper to get the number of days in a month
func getDaysInMonth(year, month int) int {
	return time.Date(year, time.Month(month+1), 0, 0, 0, 0, 0, time.UTC).Day()
}

// Helper to get the Japanese weekday name
func getWeekdayJapanese(year, month, day int) string {
	t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	weekday := t.Weekday()

	weekdayNames := []string{"日", "月", "火", "水", "木", "金", "土"}
	return weekdayNames[weekday]
}

// 代替案: 従業員データを取得して特定の順序でソート
func getEmployeesForExcel() ([]EmployeeData, error) {
	// まず従業員データを取得
	rows, err := db.DB.Query(`
        SELECT id, name, display_order FROM staff
    `)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var employees []EmployeeData
	for rows.Next() {
		var emp EmployeeData
		var displayOrder int
		if err := rows.Scan(&emp.ID, &emp.Name, &displayOrder); err != nil {
			return nil, err
		}
		// displayOrderも保存
		emp.DisplayOrder = displayOrder
		employees = append(employees, emp)
	}

	// 表示順でソート
	sort.Slice(employees, func(i, j int) bool {
		return employees[i].DisplayOrder < employees[j].DisplayOrder
	})

	return employees, nil
}

// EmployeeData構造体の修正
type EmployeeData struct {
	ID           int
	Name         string
	DisplayOrder int
}

// シフト情報を取得
type ShiftData struct {
	PatternID int
}

// 指定された日付の備考を取得
func getMemoForDate(date string, isRight bool) (string, error) {
	var content string
	err := db.DB.QueryRow(`
        SELECT content 
        FROM memos 
        WHERE date = ? AND is_right = ? AND shift_time = 'morning'
    `, date, isRight).Scan(&content)

	if err != nil && err != sql.ErrNoRows {
		return "", err
	}

	return content, nil
}

// 日付が削除されているかどうかを確認する関数
func isDateDeleted(date string) bool {
	var exists bool
	err := db.DB.QueryRow(`
        SELECT EXISTS(SELECT 1 FROM deleted_dates WHERE date = ? AND is_deleted = TRUE)
    `, date).Scan(&exists)

	if err != nil {
		log.Printf("Error checking if date is deleted: %v", err)
		return false
	}

	return exists
}

// シフト情報を取得
func getShiftForExcel(employeeID int, date, timeSlot string) (ShiftData, error) {
	var data ShiftData

	// ログ出力
	log.Printf("シフト取得: 社員ID=%d, 日付=%s, 時間帯=%s", employeeID, date, timeSlot)

	// まずシミュレーションデータを確認
	err := db.DB.QueryRow(`
        SELECT kintai_pattern_id 
        FROM shifts_simulation 
        WHERE staff_id = ? AND date = ? AND shift_time = ?
    `, employeeID, date, timeSlot).Scan(&data.PatternID)

	if err == nil {
		// シミュレーションデータが見つかった場合
		log.Printf("シミュレーションシフト見つかりました: 社員ID=%d, 日付=%s, 時間帯=%s, パターンID=%d",
			employeeID, date, timeSlot, data.PatternID)
		return data, nil
	}

	if err != sql.ErrNoRows {
		// クエリエラーの場合
		log.Printf("シミュレーションシフト検索エラー: %v", err)
	}

	// シミュレーションデータがなければ通常のシフトを確認（右側で削除されていないもの）
	err = db.DB.QueryRow(`
        SELECT kintai_pattern_id 
        FROM shifts 
        WHERE staff_id = ? AND date = ? AND shift_time = ? AND right_deleted = FALSE
    `, employeeID, date, timeSlot).Scan(&data.PatternID)

	if err == nil {
		// 通常シフトが見つかった場合
		log.Printf("通常シフト見つかりました: 社員ID=%d, 日付=%s, 時間帯=%s, パターンID=%d",
			employeeID, date, timeSlot, data.PatternID)
		return data, nil
	}

	if err == sql.ErrNoRows {
		// シフトが見つからない場合は空のデータを返す
		data.PatternID = 0
		return data, nil
	}

	// その他のエラーの場合
	log.Printf("通常シフト検索エラー: %v", err)
	data.PatternID = 0
	return data, nil
}

// パターン名を取得
func getPatternName(patternID int) (string, error) {
	// パターンIDが0の場合（シフトなし）は空文字を返す
	if patternID == 0 {
		return "", nil
	}

	var name string
	// テーブル名を kintai_patterns から kintai_pattern に修正
	err := db.DB.QueryRow(`
        SELECT pattern_name 
        FROM kintai_pattern 
        WHERE id = ?
    `, patternID).Scan(&name)

	if err != nil {
		if err == sql.ErrNoRows {
			// パターンが見つからない場合、未定義と表示
			log.Printf("パターンID %d が見つかりません。「未定義」と表示します。", patternID)
			return "未定義", nil
		}
		log.Printf("パターン名取得エラー: %v", err)
		return "未定義", nil
	}

	log.Printf("パターン名取得成功: ID=%d, 名前=%s", patternID, name)
	return name, nil
}
