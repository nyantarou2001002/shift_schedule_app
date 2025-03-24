document.addEventListener('DOMContentLoaded', function() {
  // 今日の日付を取得
  const today = new Date();
  let currentYear = today.getFullYear();
  let currentMonth = today.getMonth() + 1; // JavaScriptの月は0から始まるので+1
  
  // モーダルの選択肢要素の参照を保持する変数
  let selectedCell = null;
  
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
  if (monthSelector && monthDisplay) {
    monthSelector.value = formatYearMonth(currentYear, currentMonth);
    monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
  }
  
  // データ取得関数
  function fetchData() {
    // 勤怠パターンを取得
    fetch('/api/kintai_patterns')
      .then(response => response.json())
      .then(data => {
        kintaiPatterns = data;
        console.log('勤怠パターン取得成功:', kintaiPatterns);
        
        // 勤怠パターン選択モーダルの中身を生成
        const patternListElement = document.getElementById('patternList');
        if (patternListElement) {
          patternListElement.innerHTML = '';
          kintaiPatterns.forEach(pattern => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item pattern-item';
            listItem.dataset.patternId = pattern.id;
            listItem.textContent = pattern.pattern_name;
            listItem.addEventListener('click', function() {
              handlePatternSelect(pattern.id);
            });
            patternListElement.appendChild(listItem);
          });
        }
        
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
  if (monthSelector) {
    monthSelector.addEventListener('change', function() {
      const selectedDate = monthSelector.value.split('-');
      currentYear = parseInt(selectedDate[0]);
      currentMonth = parseInt(selectedDate[1]);
      monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
      fetchData();
    });
  }
  
  // 前月ボタン
  const prevMonthBtn = document.getElementById('prevMonth');
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', function() {
      currentMonth--;
      if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
      }
      if (monthSelector) {
        monthSelector.value = formatYearMonth(currentYear, currentMonth);
      }
      if (monthDisplay) {
        monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
      }
      fetchData();
    });
  }
  
  // 次月ボタン
  const nextMonthBtn = document.getElementById('nextMonth');
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', function() {
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
      if (monthSelector) {
        monthSelector.value = formatYearMonth(currentYear, currentMonth);
      }
      if (monthDisplay) {
        monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
      }
      fetchData();
    });
  }
  
  // 今月ボタン
  const currentMonthBtn = document.getElementById('showCurrentMonth');
  if (currentMonthBtn) {
    currentMonthBtn.addEventListener('click', function() {
      currentYear = today.getFullYear();
      currentMonth = today.getMonth() + 1;
      if (monthSelector) {
        monthSelector.value = formatYearMonth(currentYear, currentMonth);
      }
      if (monthDisplay) {
        monthDisplay.textContent = formatDisplayMonth(currentYear, currentMonth);
      }
      fetchData();
    });
  }
  
  // 従業員を取得する関数
  function fetchEmployees() {
    return fetch('/api/employees')
      .then(response => response.json())
      .catch(error => {
        console.error('従業員データ取得エラー:', error);
        return [];
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
  
  // 勤怠パターン選択時の処理
  function handlePatternSelect(patternId) {
    if (!selectedCell) {
      console.error('選択されたセルがありません');
      return;
    }
    
    const pattern = kintaiPatterns.find(p => p.id === patternId);
    if (!pattern) {
      console.error(`ID ${patternId} のパターンが見つかりません`);
      return;
    }
    
    console.log(`選択されたパターン: ID=${patternId}, 名前=${pattern.pattern_name}`);
    
    // 選択したセルに勤怠パターンをセット
    selectedCell.textContent = pattern.pattern_name;
    selectedCell.setAttribute('data-shift', pattern.pattern_name);
    selectedCell.setAttribute('data-pattern-id', pattern.id);
    
    // 見た目を更新
    updateShiftCellStyle(selectedCell);
    
    // シフト情報をサーバーに送信
    const td = selectedCell.parentElement;
    const employeeId = parseInt(td.getAttribute('data-employee-id'));
    const date = td.getAttribute('data-date');
    const shiftTime = td.getAttribute('data-shift-time');
    
    console.log(`シフト更新リクエスト: 従業員ID=${employeeId}, 日付=${date}, 時間帯=${shiftTime}, パターンID=${pattern.id}`);
    
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
        kintai_pattern_id: pattern.id
      })
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`サーバーエラー (${response.status}): ${text}`);
        });
      }
      return response.json();
    })
    .then(updatedShift => {
      console.log('シフト更新成功:', updatedShift);
      // 成功したら shiftsData を更新
      const key = `${employeeId}_${date}_${shiftTime}`;
      shiftsData[key] = updatedShift;
    })
    .catch(error => console.error('シフト更新エラー:', error));
    
    // モーダルを閉じる
    $('#patternSelectModal').modal('hide');
    selectedCell = null;
  }
  
  // シフト削除時の処理を修正
function handleDeleteShift() {
  if (!selectedCell) {
    console.error('選択されたセルがありません');
    return;
  }
  
  // 現在のパターン情報を取得
  const patternId = parseInt(selectedCell.getAttribute('data-pattern-id')) || 0;
  if (patternId === 0) {
    // 既に空の場合は何もしない
    $('#patternSelectModal').modal('hide');
    selectedCell = null;
    return;
  }
  
  // シフト情報を取得
  const td = selectedCell.parentElement;
  const employeeId = parseInt(td.getAttribute('data-employee-id'));
  const date = td.getAttribute('data-date');
  const shiftTime = td.getAttribute('data-shift-time');
  
  console.log(`シフト削除リクエスト: 従業員ID=${employeeId}, 日付=${date}, 時間帯=${shiftTime}`);
  
  // セルの参照をローカル変数に保存（非同期処理内で安全に参照するため）
  const cellToUpdate = selectedCell;
  
  // モーダルを閉じる - 先に閉じることでエラー回避
  $('#patternSelectModal').modal('hide');
  
  // selectedCell をリセット
  selectedCell = null;
  
  // APIにデータを送信して削除
  fetch('/api/deleteShift', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      employee_id: employeeId,
      date: date,
      shift_time: shiftTime
    })
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`サーバーエラー (${response.status}): ${text}`);
      });
    }
    return response.json();
  })
  .then(result => {
    console.log('シフト削除成功:', result);
    
    // 成功したら表示を更新（ローカル変数を使用）
    if (cellToUpdate) {
      cellToUpdate.textContent = '';
      cellToUpdate.setAttribute('data-shift', '');
      cellToUpdate.setAttribute('data-pattern-id', '0');
      updateShiftCellStyle(cellToUpdate);
    }
    
    // シフトデータも更新
    const key = `${employeeId}_${date}_${shiftTime}`;
    delete shiftsData[key];
  })
  .catch(error => {
    console.error('シフト削除エラー:', error);
    
    // エラーが発生しても表示だけ更新（ローカル変数を使用）
    if (cellToUpdate) {
      cellToUpdate.textContent = '';
      cellToUpdate.setAttribute('data-shift', '');
      cellToUpdate.setAttribute('data-pattern-id', '0');
      updateShiftCellStyle(cellToUpdate);
    }
  });
}


  // シフトセルの見た目を更新する関数
  function updateShiftCellStyle(cell) {
    // 一旦すべてのクラスをリセット
    cell.classList.remove('shift-early', 'shift-day', 'shift-late', 'shift-off', 'shift-vacation');
    
    // シフトパターンによってクラスを追加
    const pattern = cell.getAttribute('data-shift');
    switch (pattern) {
      case 'Mそ':
      case '早番':
        cell.classList.add('shift-early');
        break;
      case 'D1':
      case 'D2':
      case '日勤':
        cell.classList.add('shift-day');
        break;
      case 'SL':
      case 'L1':
      case 'L2':
      case '遅番':
        cell.classList.add('shift-late');
        break;
      case 'SD':
      case '休み':
        cell.classList.add('shift-off');
        break;
      case 'Dそ':
      case '有給':
        cell.classList.add('shift-vacation');
        break;
    }
  }
  
  // 日付ごとに朝・昼・夜の3行に分けたシフト表を生成する関数
  async function generateCalendar(year, month, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    console.log(`カレンダー生成開始: ${containerId}, ${year}年${month}月`);
    
    try {
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
      
      console.log(`カレンダーHTML生成完了: ${containerId}`);
      
      // HTMLを挿入
      container.innerHTML = calendarHTML;
      
      // イベントリスナーの追加
      const shiftCells = container.querySelectorAll('.shift-cell');
      console.log(`セル検出: ${shiftCells.length}個のセルを見つけました`);
      
      shiftCells.forEach(cell => {
        // デバッグ用にスタイルを追加
        cell.style.cursor = 'pointer';
        
        // シフトセルのクリックイベント
        cell.addEventListener('click', function(event) {
          // クリックされたセルの情報を取得
          const td = this.parentElement;
          const employeeId = td.getAttribute('data-employee-id');
          const date = td.getAttribute('data-date');
          const shiftTime = td.getAttribute('data-shift-time');
          const patternName = this.getAttribute('data-shift');
          const patternId = parseInt(this.getAttribute('data-pattern-id')) || 0;
          
          console.log('セルをクリックしました。', {
            従業員ID: employeeId,
            日付: date,
            時間帯: shiftTime,
            現在のパターン: patternName,
            パターンID: patternId
          });
          
          // 背景色を一時的に変更して視覚的フィードバックを提供
          const originalBackgroundColor = this.style.backgroundColor;
          this.style.backgroundColor = '#ffeb3b';  // 黄色でハイライト
          
          // 500ms後に元の色に戻す
          setTimeout(() => {
            this.style.backgroundColor = originalBackgroundColor;
          }, 500);
          
          if (kintaiPatterns.length === 0) {
            alert('勤怠パターンが取得できていません');
            return;
          }
          
          // クリックされたセルを記憶
          selectedCell = this;
          
          // 削除ボタンの表示/非表示を制御
          const deleteShiftContainer = document.getElementById('deleteShiftContainer');
          if (deleteShiftContainer) {
            // パターンIDが設定されている場合のみ削除ボタンを表示
            if (patternId > 0) {
              deleteShiftContainer.style.display = 'block';
            } else {
              deleteShiftContainer.style.display = 'none';
            }
          }
          
          // モーダルで勤怠パターン選択を表示
          $('#patternSelectModal').modal('show');
        });
      });
      
      // 初期の見た目を設定
      shiftCells.forEach(cell => {
        updateShiftCellStyle(cell);
      });
      
      console.log(`カレンダー生成完了: ${containerId}`);
    } catch (error) {
      console.error(`カレンダー生成エラー:`, error);
    }
  }
  
  // 両方のカレンダーを更新する関数
  function updateCalendars() {
    console.log(`カレンダー更新: ${currentYear}年${currentMonth}月`);
    generateCalendar(currentYear, currentMonth, 'leftCalendar')
      .then(() => generateCalendar(currentYear, currentMonth, 'rightCalendar'));
  }
  
  // 削除ボタンのイベントリスナーを追加
  const deleteShiftBtn = document.getElementById('deleteShiftBtn');
  if (deleteShiftBtn) {
    deleteShiftBtn.addEventListener('click', function() {
      handleDeleteShift();
    });
  }
  
  // 初期データ取得
  fetchData();
  
  // jQuery と Bootstrap が読み込まれていることを確認
  if (window.jQuery) {
    console.log('jQuery が正常に読み込まれています');
    
    // モーダルが正しく初期化されていることを確認
    $('#patternSelectModal').on('show.bs.modal', function() {
      console.log('モーダル表示イベント');
      
      // 削除ボタンの表示/非表示を初期状態としてセット
      const deleteShiftContainer = document.getElementById('deleteShiftContainer');
      if (deleteShiftContainer && selectedCell) {
        const patternId = parseInt(selectedCell.getAttribute('data-pattern-id')) || 0;
        if (patternId > 0) {
          deleteShiftContainer.style.display = 'block';
        } else {
          deleteShiftContainer.style.display = 'none';
        }
      }
    });
  } else {
    console.error('jQuery が読み込まれていません！');
  }
});