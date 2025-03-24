document.addEventListener('DOMContentLoaded', function() {
    // 今日の日付を取得
    const today = new Date();
    let currentYear = today.getFullYear();
    let currentMonth = today.getMonth() + 1; // JavaScriptの月は0から始まるので+1
    
    // 勤怠パターンとシフトデータを格納する変数
    let kintaiPatterns = [];
    let shiftsData = {};
    
    // 月選択の初期化
    const monthSelector = document.getElementById('monthSelector');
    const monthDisplay = document.getElementById('currentMonthDisplay');
    
    // YYYY-MM形式に変換
    function formatYearMonth(year, month) {
      return `${year}-${month.toString().padStart(2, '0')}`;
    }
    
    // 表示用の形式に変換（YYYY年M月）
    function formatDisplayMonth(year, month) {
      return `${year}年${month}月`;
    }
    
    // 初期設定
    monthSelector.value = formatYearMonth(currentYear, currentMonth);
    monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
    
    // データ取得関数
    function fetchData() {
      // 勤怠パターンを取得
      fetch('/api/kintai_patterns')
        .then(response => response.json())
        .then(data => {
          kintaiPatterns = data;
          // 勤怠パターン取得後にシフトデータを取得
          return fetch(`/api/shifts?yearMonth=${formatYearMonth(currentYear, currentMonth)}`);
        })
        .then(response => response.json())
        .then(data => {
          // シフトデータをキーで整理
          shiftsData = {};
          data.forEach(shift => {
            const key = `${shift.employee_id}_${shift.date}_${shift.shift_time}`;
            shiftsData[key] = shift;
          });
          
          // データ取得後にカレンダーを更新
          updateCalendars();
        })
        .catch(error => console.error('データ取得エラー:', error));
    }
    
    // 月セレクターの変更イベント
    monthSelector.addEventListener('change', function() {
      const selectedDate = monthSelector.value.split('-');
      currentYear = parseInt(selectedDate[0]);
      currentMonth = parseInt(selectedDate[1]);
      monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
      fetchData(); // 新しい月のデータを取得
    });
    
    // 前月ボタン
    document.getElementById('prevMonth').addEventListener('click', function() {
      currentMonth--;
      if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
      }
      monthSelector.value = formatYearMonth(currentYear, currentMonth);
      monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
      fetchData(); // 新しい月のデータを取得
    });
    
    // 次月ボタン
    document.getElementById('nextMonth').addEventListener('click', function() {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      monthSelector.value = formatYearMonth(currentYear, currentMonth);
      monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
      fetchData(); // 新しい月のデータを取得
    });
    
    // 今月ボタン
    document.getElementById('showCurrentMonth').addEventListener('click', function() {
      currentYear = today.getFullYear();
      currentMonth = today.getMonth() + 1;
      monthSelector.value = formatYearMonth(currentYear, currentMonth);
      monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
      fetchData(); // 新しい月のデータを取得
    });
    
    // 従業員を取得する関数
    function fetchEmployees() {
      return fetch('/api/employees')
        .then(response => response.json())
        .catch(error => {
          console.error('従業員データ取得エラー:', error);
          return []; // エラー時は空配列を返す
        });
    }
    
    // パターンIDから勤怠パターン名を取得する関数
    function getPatternName(patternId) {
      const pattern = kintaiPatterns.find(p => p.id === patternId);
      return pattern ? pattern.pattern_name : '';
    }
    
    // シフト情報を取得する関数
    function getShiftInfo(employeeId, date, shiftTime) {
      const key = `${employeeId}_${date}_${shiftTime}`;
      return shiftsData[key] || null;
    }
    
    // 日付ごとに朝・昼・夜の3行に分けたシフト表を生成する関数
    async function generateCalendar(year, month, containerId) {
      const container = document.getElementById(containerId);
      if (!container) return;
      
      // 従業員データを取得
      const employees = await fetchEmployees();
      
      // 月の最初の日と最後の日を取得
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const daysInMonth = lastDay.getDate();
      
      // 曜日の名前配列
      const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
      
      // HTML生成開始
      let calendarHTML = '<table class="table table-bordered horizontal-calendar">';
      
      // ヘッダー行（日付の列とその右に従業員名）
      calendarHTML += '<thead><tr><th rowspan="2">日付</th><th rowspan="2">時間帯</th>';
      employees.forEach(employee => {
        calendarHTML += `<th class="employee-header">${employee.name}</th>`;
      });
      calendarHTML += '</tr>';
      calendarHTML += '</thead>';
      
      // カレンダー本体
      calendarHTML += '<tbody>';
      
      for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month - 1, i);
        const dayOfWeek = date.getDay();
        const dayClass = dayOfWeek === 0 ? 'sun' : (dayOfWeek === 6 ? 'sat' : '');
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        
        // 今日の日付には特別なクラスを適用
        const isToday = i === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
        const todayClass = isToday ? 'today' : '';
        
        // 各日付に対して3行（朝・昼・夜）を作成
        
        // 朝の行
        calendarHTML += `<tr class="${dayClass} ${todayClass} time-morning">
          <td class="date-cell" rowspan="3">
            ${i}（${weekDays[dayOfWeek]}）
          </td>
          <td class="shift-time-label">朝</td>`;
        
        // 各従業員のシフトセル（朝）
        employees.forEach(employee => {
          const shiftInfo = getShiftInfo(employee.id, dateStr, 'morning');
          const patternId = shiftInfo ? shiftInfo.kintai_pattern_id : 0;
          const patternName = getPatternName(patternId);
          
          calendarHTML += `<td data-employee-id="${employee.id}" data-date="${dateStr}" data-shift-time="morning">
            <div class="shift-cell" data-shift="${patternName}" data-pattern-id="${patternId}">${patternName}</div>
          </td>`;
        });
        calendarHTML += '</tr>';
        
        // 昼の行
        calendarHTML += `<tr class="${dayClass} ${todayClass} time-day">
          <td class="shift-time-label">昼</td>`;
        
        // 各従業員のシフトセル（昼）
        employees.forEach(employee => {
          const shiftInfo = getShiftInfo(employee.id, dateStr, 'day');
          const patternId = shiftInfo ? shiftInfo.kintai_pattern_id : 0;
          const patternName = getPatternName(patternId);
          
          calendarHTML += `<td data-employee-id="${employee.id}" data-date="${dateStr}" data-shift-time="day">
            <div class="shift-cell" data-shift="${patternName}" data-pattern-id="${patternId}">${patternName}</div>
          </td>`;
        });
        calendarHTML += '</tr>';
        
        // 夜の行
        calendarHTML += `<tr class="${dayClass} ${todayClass} time-night">
          <td class="shift-time-label">夜</td>`;
        
        // 各従業員のシフトセル（夜）
        employees.forEach(employee => {
          const shiftInfo = getShiftInfo(employee.id, dateStr, 'night');
          const patternId = shiftInfo ? shiftInfo.kintai_pattern_id : 0;
          const patternName = getPatternName(patternId);
          
          calendarHTML += `<td data-employee-id="${employee.id}" data-date="${dateStr}" data-shift-time="night">
            <div class="shift-cell" data-shift="${patternName}" data-pattern-id="${patternId}">${patternName}</div>
          </td>`;
        });
        calendarHTML += '</tr>';
      }
      
      calendarHTML += '</tbody></table>';
      
      // HTMLを挿入
      container.innerHTML = calendarHTML;
      
      // イベントリスナーの追加
      const shiftCells = container.querySelectorAll('.shift-cell');
      shiftCells.forEach(cell => {
        cell.addEventListener('click', function() {
          if (kintaiPatterns.length === 0) {
            alert('勤怠パターンが取得できていません');
            return;
          }
          
          // 現在のパターンIDを取得
          const currentPatternId = parseInt(this.getAttribute('data-pattern-id')) || 0;
          
          // 次のパターンIDを取得
          let nextPatternIndex = 0;
          if (currentPatternId > 0) {
            const currentIndex = kintaiPatterns.findIndex(p => p.id === currentPatternId);
            nextPatternIndex = (currentIndex + 1) % kintaiPatterns.length;
          }
          
          // 次のパターンを設定
          const nextPattern = kintaiPatterns[nextPatternIndex];
          this.textContent = nextPattern.pattern_name;
          this.setAttribute('data-shift', nextPattern.pattern_name);
          this.setAttribute('data-pattern-id', nextPattern.id);
          
          // 見た目を変更
          updateShiftCellStyle(this);
          
          // シフト情報をサーバーに送信
          const td = this.parentElement;
          const employeeId = parseInt(td.getAttribute('data-employee-id'));
          const date = td.getAttribute('data-date');
          const shiftTime = td.getAttribute('data-shift-time');
          
          // APIにデータを送信
          fetch('/api/updateShift', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              employee_id: employeeId,
              date: date,
              shift_time: shiftTime,
              kintai_pattern_id: nextPattern.id
            })
          })
          .then(response => response.json())
          .then(updatedShift => {
            console.log('シフト更新成功:', updatedShift);
            // 成功したら shiftsData を更新
            const key = `${employeeId}_${date}_${shiftTime}`;
            shiftsData[key] = updatedShift;
          })
          .catch(error => console.error('シフト更新エラー:', error));
        });
      });
      
      // 初期の見た目を設定
      shiftCells.forEach(cell => {
        updateShiftCellStyle(cell);
      });
    }
    
    // シフトセルの見た目を更新する関数
    function updateShiftCellStyle(cell) {
      // 一旦すべてのクラスをリセット
      cell.classList.remove('shift-early', 'shift-day', 'shift-late', 'shift-off', 'shift-vacation');
      
      // シフトパターンによってクラスを追加
      const pattern = cell.getAttribute('data-shift');
      switch (pattern) {
        case '早番':
          cell.classList.add('shift-early');
          break;
        case '日勤':
          cell.classList.add('shift-day');
          break;
        case '遅番':
          cell.classList.add('shift-late');
          break;
        case '休み':
          cell.classList.add('shift-off');
          break;
        case '有給':
          cell.classList.add('shift-vacation');
          break;
      }
    }
    
    // 両方のカレンダーを更新する関数
    function updateCalendars() {
        console.log(`カレンダー更新: ${currentYear}年${currentMonth}月`);
        generateCalendar(currentYear, currentMonth, 'leftCalendar')
        .then(() => generateCalendar(currentYear, currentMonth, 'rightCalendar'))
        .then(() => {
            // カレンダー生成後、必要に応じてスクロール位置をリセット
            const containers = document.querySelectorAll('.calendar-container');
            containers.forEach(container => {
            container.scrollLeft = 0;
            
            // 今日の日付が表示されている場合、そこまでスクロール
            const today = container.querySelector('.today');
            if (today) {
                const containerRect = container.getBoundingClientRect();
                const todayRect = today.getBoundingClientRect();
                const scrollTop = todayRect.top - containerRect.top - (containerRect.height / 2) + (todayRect.height / 2);
                if (scrollTop > 0) {
                container.scrollTop = scrollTop;
                }
            }
            });
        });
    }
    
    // 初期データ取得
    fetchData();
  });