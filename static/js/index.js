document.addEventListener('DOMContentLoaded', function() {
  // 今日の日付を取得
  const today = new Date();
  let currentYear = today.getFullYear();
  let currentMonth = today.getMonth() + 1; // JavaScriptの月は0から始まるので+1

  // 祝日データを格納する変数を追加
let holidaysData = {};

// 備考データのグローバル変数
let leftMemosData = {};  // 左側カレンダー用
let rightMemosData = {}; // 右側カレンダー用

// 全画面表示の状態を保存/読み込みする機能
let isFullscreen = localStorage.getItem('calendarFullscreen') === 'true';

// 祝日データを取得して表示する関数
function fetchAndDisplayHolidays() {
  return fetch('https://holidays-jp.github.io/api/v1/date.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`祝日API通信エラー: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      
      // グローバル変数に保存
      holidaysData = data;
      
      // データの一部を整形して表示
      const currentYear = new Date().getFullYear();
      
      Object.entries(data)
        .filter(([dateStr]) => dateStr.startsWith(currentYear))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([date, name]) => {
          const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            weekday: 'short'
          });
        });
        
      
      // データを返して他の処理でも使えるようにする
      return data;
    })
    .catch(error => {
      console.error('祝日データの取得に失敗しました:', error);
      holidaysData = {}; // エラー時は空オブジェクト
      return {};
    });
}
  
  // ページ読み込み時に祝日データを取得・表示
  fetchAndDisplayHolidays();
  
  // モーダルの選択肢要素の参照を保持する変数
  let selectedCell = null;
  
  // 勤怠パターンとシフトデータを格納する変数
  let kintaiPatterns = [];
  let shiftsData = {}; // 左側カレンダー用
  let rightShiftsData = {}; // 右側カレンダー用（独立したデータ）
  
  // 月選択の初期化
  const monthSelector = document.getElementById('monthSelector');
  const monthDisplay = document.getElementById('currentMonthDisplay');

// 全画面表示ボタンの参照
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenBtnText = document.getElementById('fullscreenBtnText');
const leftContentCol = document.getElementById('leftContentCol');
const rightContentCol = document.getElementById('rightContentCol');


// ページ読み込み時に全画面表示状態を適用
function applyFullscreenState() {
  if (isFullscreen) {
    // 全画面モード - Bootstrap のグリッドシステムを活用
    leftContentCol.classList.add('d-none');
    rightContentCol.classList.remove('col-md-6');
    rightContentCol.classList.add('col-md-12');
    fullscreenBtnText.textContent = '両方表示';
    
    // ボタンスタイルを変更
    fullscreenBtn.classList.remove('btn-outline-success');
    fullscreenBtn.classList.add('btn-success');
    
    // コンテナをfluidに変更
    const rightContainer = rightContentCol.querySelector('.container');
    if (rightContainer) {
      rightContainer.classList.remove('container');
      rightContainer.classList.add('container-fluid', 'px-3');
    }
    
    // カレンダーコンテナを横幅最大に
    const calendarContainer = rightContentCol.querySelector('.calendar-container');
    if (calendarContainer) {
      calendarContainer.classList.add('w-100');
      
      // Bootstrapのスクロールクラスを調整
      calendarContainer.classList.remove('overflow-auto');
      calendarContainer.classList.add('overflow-hidden'); // 縦スクロール非表示
      
      // スタイルの直接操作
      calendarContainer.style.overflowY = 'hidden';
      calendarContainer.style.maxHeight = 'none';
    }
  }
}

// 全画面表示ボタンの機能を追加（Bootstrap クラスを活用）
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', function() {
    isFullscreen = !isFullscreen;
    
    // 状態をローカルストレージに保存
    localStorage.setItem('calendarFullscreen', isFullscreen);
    
    if (isFullscreen) {
      // 全画面モード - Bootstrap のグリッドシステムを活用
      leftContentCol.classList.add('d-none');
      rightContentCol.classList.remove('col-md-6');
      rightContentCol.classList.add('col-md-12');
      fullscreenBtnText.textContent = '両方表示';
      
      // ボタンスタイルを変更
      fullscreenBtn.classList.remove('btn-outline-success');
      fullscreenBtn.classList.add('btn-success');
      
      // コンテナをfluidに変更
      const rightContainer = rightContentCol.querySelector('.container');
      if (rightContainer) {
        rightContainer.classList.remove('container');
        rightContainer.classList.add('container-fluid', 'px-3');
      }
      
      // カレンダーコンテナを横幅最大に
      const calendarContainer = rightContentCol.querySelector('.calendar-container');
      if (calendarContainer) {
        calendarContainer.classList.add('w-100');
        
        // Bootstrapのスクロールクラスを調整
        calendarContainer.classList.remove('overflow-auto');
        calendarContainer.classList.add('overflow-hidden'); // 縦スクロール非表示
        
        // スタイルの直接操作
        calendarContainer.style.overflowY = 'hidden';
        calendarContainer.style.maxHeight = 'none';
      }
    } else {
      // 通常モード - Bootstrap のグリッドシステムに戻す
      leftContentCol.classList.remove('d-none');
      rightContentCol.classList.remove('col-md-12');
      rightContentCol.classList.add('col-md-6');
      fullscreenBtnText.textContent = '右側のみ表示';
      
      // ボタンスタイルを元に戻す
      fullscreenBtn.classList.remove('btn-success');
      fullscreenBtn.classList.add('btn-outline-success');
      
      // コンテナを通常に戻す
      const rightContainer = rightContentCol.querySelector('.container-fluid');
      if (rightContainer) {
        rightContainer.classList.remove('container-fluid', 'px-3');
        rightContainer.classList.add('container');
      }

      // カレンダーコンテナを元に戻す
      const calendarContainer = rightContentCol.querySelector('.calendar-container');
      if (calendarContainer) {
        calendarContainer.classList.remove('w-100');
        
        // Bootstrapのスクロールクラスを元に戻す
        calendarContainer.classList.remove('overflow-hidden');
        calendarContainer.classList.add('overflow-auto');
        
        // スタイルの直接操作をリセット
        calendarContainer.style.overflowY = '';
        calendarContainer.style.maxHeight = '';
      }
    }
    
    // カレンダー再描画（レイアウト調整のため）
    setTimeout(() => {
      updateCalendars();
    }, 300);
  });
}

// ページ読み込み時にローカルストレージから状態を適用
applyFullscreenState();
  
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
  
  // データ取得関数を修正
function fetchData() {
  // 最初に祝日データを取得してから他のデータを取得
  fetchAndDisplayHolidays()
    .then(() => {
      // 勤怠パターンを取得
      return fetch('/api/kintai_patterns');
    })
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

      // 左右のカレンダーの備考データを取得 - ここに追加
      fetchMemos(false); // 左側
      fetchMemos(true);  // 右側
      
      
      // 左側（通常）シフトデータを取得
      return fetch(`/api/shifts?yearMonth=${formatYearMonth(currentYear, currentMonth)}`);
    })
    .then(response => response.json())
    .then(data => {
      // 左側シフトデータをキーで整理
      shiftsData = {};
      data.forEach(shift => {
        const key = `${shift.employee_id}_${shift.date}_${shift.shift_time}`;
        shiftsData[key] = shift;
      });
      
      // 右側（シミュレーション）シフトデータを取得
      return fetch(`/api/shifts_simulation?yearMonth=${formatYearMonth(currentYear, currentMonth)}`);
    })
    .then(response => response.json())
    .then(data => {
      // 右側シフトデータをキーで整理
      rightShiftsData = {};
      data.forEach(shift => {
        // right_deletedがtrueのシフトは右側に表示しない
        if (!shift.right_deleted) {
          const key = `${shift.employee_id}_${shift.date}_${shift.shift_time}`;
          rightShiftsData[key] = shift;
        }
      });
      
      console.log('両カレンダーのシフトデータ取得完了:', {
        左側: Object.keys(shiftsData).length,
        右側: Object.keys(rightShiftsData).length
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

  // 備考データを取得する関数
function fetchMemos(isRight) {
  const dataStore = isRight ? rightMemosData : leftMemosData;
  
  fetch(`/api/memos?yearMonth=${formatYearMonth(currentYear, currentMonth)}&isRight=${isRight}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('備考データの取得に失敗しました');
      }
      return response.json();
    })
    .then(memos => {
      // データを整理して保存
      Object.keys(dataStore).forEach(key => delete dataStore[key]);
      
      memos.forEach(memo => {
        const key = `${memo.date}_${memo.shift_time}`;
        dataStore[key] = memo.content;
      });
      
      // 該当するカレンダーの備考欄を更新
      updateMemoDisplay(isRight);
    })
    .catch(error => {
      console.error('備考データ取得エラー:', error);
    });
}

// 備考表示を更新する関数
function updateMemoDisplay(isRight) {
  const containerId = isRight ? 'rightCalendar' : 'leftCalendar';
  const dataStore = isRight ? rightMemosData : leftMemosData;
  
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const noteCells = container.querySelectorAll('.note-cell');
  
  noteCells.forEach(cell => {
    const date = cell.getAttribute('data-date');
    // 日付ごとに1つの備考を共有（朝・昼・夜で共通）
    const key = `${date}_morning`;
    
    // 備考があれば表示
    if (dataStore[key]) {
      cell.textContent = dataStore[key];
      cell.title = dataStore[key]; // ツールチップにも表示
    } else {
      cell.textContent = '';
      cell.title = 'クリックして備考を入力';
    }
  });
}

// 備考を保存する関数
function saveMemo(date, content, isRight) {
  const memo = {
    date: date,
    shift_time: 'morning', // 朝・昼・夜で共通の備考を使用
    content: content,
    is_right: isRight
  };
  
  // API呼び出しでデータを保存
  fetch('/api/saveNoteMemo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(memo)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('備考の保存に失敗しました');
    }
    return response.json();
  })
  .then(data => {
    console.log('備考保存成功:', data);
    // 保存したデータをローカルに反映
    const dataStore = isRight ? rightMemosData : leftMemosData;
    const key = `${date}_morning`;
    dataStore[key] = content;
  })
  .catch(error => {
    console.error('備考保存エラー:', error);
    alert('備考の保存に失敗しました: ' + error.message);
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
  
  // シフト情報を取得する関数（カレンダー側によって異なるデータソースを使用）
  function getShiftInfo(employeeId, date, shiftTime, isRight = false) {
    const key = `${employeeId}_${date}_${shiftTime}`;
    return isRight ? rightShiftsData[key] || null : shiftsData[key] || null;
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
    
    // シフト情報を取得
    const td = selectedCell.parentElement;
    const employeeId = parseInt(td.getAttribute('data-employee-id'));
    const date = td.getAttribute('data-date');
    const shiftTime = td.getAttribute('data-shift-time');
    const isRight = selectedCell.getAttribute('data-side') === 'right';
    
    console.log(`シフト更新リクエスト: 従業員ID=${employeeId}, 日付=${date}, 時間帯=${shiftTime}, パターンID=${pattern.id}, 右側=${isRight}`);
    
    // 対象のデータを更新
    const key = `${employeeId}_${date}_${shiftTime}`;
    
    // API エンドポイントを選択（右側と左側で異なるエンドポイントを使用）
    const apiEndpoint = isRight ? '/api/updateShiftSimulation' : '/api/updateShift';
    
    // APIにデータを送信（右側と左側の両方）
    fetch(apiEndpoint, {
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
      console.log(`シフト更新成功 (${isRight ? '右側' : '左側'})`, updatedShift);
      // 成功したらデータを更新
    if (isRight) {
      rightShiftsData[key] = updatedShift;
    } else {
      shiftsData[key] = updatedShift;
      
      // 左側の変更を右側にも反映する
      updateRightCalendarCell(employeeId, date, shiftTime, pattern.id, pattern.pattern_name);
    }
  })
  .catch(error => console.error('シフト更新エラー:', error));
  
  // モーダルを閉じる前にフォーカスを移動
  document.body.focus();
  
  // モーダルを閉じる
  $('#patternSelectModal').modal('hide');
  selectedCell = null;
}
  
  
  // 左側の変更を右側に反映する関数
  function updateRightCalendarCell(employeeId, date, shiftTime, patternId, patternName) {
    const key = `${employeeId}_${date}_${shiftTime}`;
    rightShiftsData[key] = {
      id: -1,
      employee_id: employeeId,
      date: date,
      shift_time: shiftTime,
      kintai_pattern_id: patternId
    };
    
    // 既に表示されている右側カレンダーがあれば更新
    const rightCalendar = document.getElementById('rightCalendar');
    if (!rightCalendar) return;
    
    const cellSelector = `.shift-cell[data-side="right"][data-employee="${employeeId}"][data-date="${date}"][data-shift-time="${shiftTime}"]`;
    const cell = rightCalendar.querySelector(cellSelector);
    if (cell) {
      cell.textContent = patternName;
      cell.setAttribute('data-shift', patternName);
      cell.setAttribute('data-pattern-id', patternId);
      updateShiftCellStyle(cell);
    }
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
      // モーダルを閉じる前にフォーカスを移動
      document.body.focus();
      $('#patternSelectModal').modal('hide');
      selectedCell = null;
      return;
    }
    
    // シフト情報を取得
    const td = selectedCell.parentElement;
    const employeeId = parseInt(td.getAttribute('data-employee-id'));
    const date = td.getAttribute('data-date');
    const shiftTime = td.getAttribute('data-shift-time');
    const isRight = selectedCell.getAttribute('data-side') === 'right';
    
    console.log(`シフト削除リクエスト: 従業員ID=${employeeId}, 日付=${date}, 時間帯=${shiftTime}, 右側=${isRight}`);
    
    // セルの参照をローカル変数に保存（非同期処理内で安全に参照するため）
    const cellToUpdate = selectedCell;
    
    // モーダルを閉じる前にフォーカスを別の場所（ドキュメント本体など）に移動する
    document.body.focus();
    
    // モーダルを閉じる
    $('#patternSelectModal').modal('hide');
    
    // selectedCell をリセット
    selectedCell = null;
  
  // シフトデータ用のキー
  const key = `${employeeId}_${date}_${shiftTime}`;
  
  if (isRight) {
    // 右側カレンダーの処理
    
    // まず、このシフトが左側カレンダーからも来ているかチェック
    const existsInLeft = shiftsData[key] !== undefined;
    
    if (existsInLeft) {
      // 左側カレンダーに存在する場合は、右側削除フラグをセットする
      fetch('/api/markShiftAsRightDeleted', {
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
        console.log('シフトに右側削除フラグを設定:', result);
        
        // 右側UIとメモリ上のデータを更新
        if (cellToUpdate) {
          cellToUpdate.textContent = '';
          cellToUpdate.setAttribute('data-shift', '');
          cellToUpdate.setAttribute('data-pattern-id', '0');
          updateShiftCellStyle(cellToUpdate);
        }
        
        // 右側データからは削除（表示しないように）
        delete rightShiftsData[key];
        
        // 注意: shiftsDataは更新しない（左側カレンダーには表示したまま）
      })
      .catch(error => {
        console.error('シフト右側削除フラグ設定エラー:', error);
      });
    } else {
      // 右側カレンダーのみの追加データの場合は通常削除
      fetch('/api/deleteShiftSimulation', {
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
        console.log('シミュレーションシフト削除成功:', result);
        
        // UI更新
        if (cellToUpdate) {
          cellToUpdate.textContent = '';
          cellToUpdate.setAttribute('data-shift', '');
          cellToUpdate.setAttribute('data-pattern-id', '0');
          updateShiftCellStyle(cellToUpdate);
        }
        
        // データ更新
        delete rightShiftsData[key];
      })
      .catch(error => {
        console.error('シミュレーションシフト削除エラー:', error);
      });
    }
  } else {
    // 左側カレンダーの削除処理（変更なし）
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
      console.log('シフト削除成功 (左側):', result);
      
      // 成功したら表示を更新
      if (cellToUpdate) {
        cellToUpdate.textContent = '';
        cellToUpdate.setAttribute('data-shift', '');
        cellToUpdate.setAttribute('data-pattern-id', '0');
        updateShiftCellStyle(cellToUpdate);
      }
      
      // データを更新
      delete shiftsData[key];
      
      // 左側の削除を右側にも反映
      updateRightCalendarCellDelete(employeeId, date, shiftTime);
    })
    .catch(error => {
      console.error('シフト削除エラー:', error);
      
      // エラーが発生しても表示だけ更新
      if (cellToUpdate) {
        cellToUpdate.textContent = '';
        cellToUpdate.setAttribute('data-shift', '');
        cellToUpdate.setAttribute('data-pattern-id', '0');
        updateShiftCellStyle(cellToUpdate);
      }
    });
  }
}

  // 左側の削除を右側に反映する関数
  function updateRightCalendarCellDelete(employeeId, date, shiftTime) {
    const key = `${employeeId}_${date}_${shiftTime}`;
    delete rightShiftsData[key];
    
    // 既に表示されている右側カレンダーがあれば更新
    const rightCalendar = document.getElementById('rightCalendar');
    if (!rightCalendar) return;
    
    const cellSelector = `.shift-cell[data-side="right"][data-employee="${employeeId}"][data-date="${date}"][data-shift-time="${shiftTime}"]`;
    const cell = rightCalendar.querySelector(cellSelector);
    if (cell) {
      cell.textContent = '';
      cell.setAttribute('data-shift', '');
      cell.setAttribute('data-pattern-id', '0');
      updateShiftCellStyle(cell);
    }
  }

  // 日付が祝日かどうかを判定する関数
function isHoliday(dateStr) {
  return holidaysData[dateStr] !== undefined;
}

// 祝日名を取得する関数
function getHolidayName(dateStr) {
  return holidaysData[dateStr] || '';
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
  
  const isRight = containerId === 'rightCalendar';
  console.log(`カレンダー生成開始: ${containerId}, ${year}年${month}月, 右側=${isRight}`);
  
  try {
    // 従業員データを取得
    const employees = await fetchEmployees();
    
    // 月の最初の日と最後の日を取得
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    
    // 曜日の名前配列
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    
    // HTML生成開始 - テーブルクラスを動的に設定
let tableClass = 'table table-bordered table-sm horizontal-calendar';
// 全画面表示時は右側のテーブルに w-100 クラスを追加
if (isRight && isFullscreen) {
  tableClass += ' w-100';
}
let calendarHTML = `<table class="${tableClass}">`;

// HTMLを挿入
container.innerHTML = calendarHTML;
    
    // ヘッダー行（日付の列とその右に従業員名）
    calendarHTML += '<thead><tr><th rowspan="2">日付</th><th rowspan="2">時間帯</th>';
    
    // 従業員名のヘッダー
    employees.forEach(employee => {
      calendarHTML += `<th class="employee-header">${employee.name}</th>`;
    });
    
    // 右端に備考と日付と時間帯のヘッダーを追加
    calendarHTML += '<th rowspan="2">備考</th><th rowspan="2">日付</th><th rowspan="2">時間帯</th></tr>';
    
    calendarHTML += '</thead>';
    
    // カレンダー本体
    calendarHTML += '<tbody>';
    
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month - 1, i);
      const dayOfWeek = date.getDay();
      const dateStr = `${year}-${month.toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      
      // 祝日判定
      const isHolidayDate = isHoliday(dateStr);
      const holidayName = getHolidayName(dateStr);
      
      // 日付のクラスを設定（日曜または祝日なら赤色になるようにクラスを指定）
      let dayClass = '';
      if (dayOfWeek === 0) {
        dayClass = 'sun';
      } else if (dayOfWeek === 6) {
        dayClass = 'sat';
      }
      
      // 祝日の場合はholidayクラスを追加
      if (isHolidayDate) {
        dayClass += ' holiday';
      }
      
      // 今日の日付には特別なクラスを適用
      const isToday = i === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();
      const todayClass = isToday ? 'today' : '';
      
      // 日付セルのスタイル（日曜または祝日なら赤色）
      const dateCellStyle = (dayOfWeek === 0 || isHolidayDate) ? 'style="color: #dc3545; font-weight: bold;"' : '';
      
      // 日付セルの内容（左右共通）
      const dateCellContent = `
        ${i}（${weekDays[dayOfWeek]}）
        ${isHolidayDate ? `<br><span class="holiday-name">${holidayName}</span>` : ''}
      `;
      
      // 朝の行
      calendarHTML += `<tr class="${dayClass} ${todayClass} time-morning">
        <td class="date-cell" rowspan="3" ${dateCellStyle}>
          ${dateCellContent}
        </td>
        <td class="shift-time-label">朝</td>`;
      
      // 各従業員のシフトセル（朝）
      employees.forEach(employee => {
        const shiftInfo = getShiftInfo(employee.id, dateStr, 'morning', isRight);
        const patternId = shiftInfo ? shiftInfo.kintai_pattern_id : 0;
        const patternName = getPatternName(patternId);
        
        calendarHTML += `<td data-employee-id="${employee.id}" data-date="${dateStr}" data-shift-time="morning">
          <div class="shift-cell" data-shift="${patternName}" data-pattern-id="${patternId}" data-side="${isRight ? 'right' : 'left'}" data-employee="${employee.id}" data-date="${dateStr}" data-shift-time="morning">${patternName}</div>
        </td>`;
      });
      
      // 備考セル、右端の日付と時間帯セル（朝の行）
      calendarHTML += `
        <td class="note-cell" rowspan="3" data-date="${dateStr}" data-is-right="${isRight}"></td>
        <td class="date-cell right-date-cell" rowspan="3" ${dateCellStyle}>
          ${dateCellContent}
        </td>
        <td class="shift-time-label right-time-label">朝</td>`;
      
      calendarHTML += '</tr>';
      
      // 昼の行
      calendarHTML += `<tr class="${dayClass} ${todayClass} time-day">
        <td class="shift-time-label">昼</td>`;
      
      // 各従業員のシフトセル（昼）
      employees.forEach(employee => {
        const shiftInfo = getShiftInfo(employee.id, dateStr, 'day', isRight);
        const patternId = shiftInfo ? shiftInfo.kintai_pattern_id : 0;
        const patternName = getPatternName(patternId);
        
        calendarHTML += `<td data-employee-id="${employee.id}" data-date="${dateStr}" data-shift-time="day">
          <div class="shift-cell" data-shift="${patternName}" data-pattern-id="${patternId}" data-side="${isRight ? 'right' : 'left'}" data-employee="${employee.id}" data-date="${dateStr}" data-shift-time="day">${patternName}</div>
        </td>`;
      });
      
      // 右端の時間帯（昼）- 備考と日付は朝の行で設定済み
      calendarHTML += `<td class="shift-time-label right-time-label">昼</td>`;
      
      calendarHTML += '</tr>';
      
      // 夜の行
      calendarHTML += `<tr class="${dayClass} ${todayClass} time-night">
        <td class="shift-time-label">夜</td>`;
      
      // 各従業員のシフトセル（夜）
      employees.forEach(employee => {
        const shiftInfo = getShiftInfo(employee.id, dateStr, 'night', isRight);
        const patternId = shiftInfo ? shiftInfo.kintai_pattern_id : 0;
        const patternName = getPatternName(patternId);
        
        calendarHTML += `<td data-employee-id="${employee.id}" data-date="${dateStr}" data-shift-time="night">
          <div class="shift-cell" data-shift="${patternName}" data-pattern-id="${patternId}" data-side="${isRight ? 'right' : 'left'}" data-employee="${employee.id}" data-date="${dateStr}" data-shift-time="night">${patternName}</div>
        </td>`;
      });
      
      // 右端の時間帯（夜）- 備考と日付は朝の行で設定済み
      calendarHTML += `<td class="shift-time-label right-time-label">夜</td>`;
      
      calendarHTML += '</tr>';
    }
    
    calendarHTML += '</tbody></table>';
    
    console.log(`カレンダーHTML生成完了: ${containerId}`);
    
    // HTMLを挿入
    container.innerHTML = calendarHTML;

    // 全画面表示時にテーブル幅を調整 - より強力な調整
if (isRight && isFullscreen) {
  const table = container.querySelector('table');
  if (table) {
    table.style.width = '100%';
    table.style.maxWidth = 'none';
    
    // テーブルの親要素も幅を調整
    container.style.width = '100%';
    
    // container の親要素も調整
    const calendarContainer = container.closest('.calendar-container');
    if (calendarContainer) {
      calendarContainer.style.maxWidth = '100%';
    }
  }
}
    
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
        const side = this.getAttribute('data-side');
        
        console.log('セルをクリックしました。', {
          従業員ID: employeeId,
          日付: date,
          時間帯: shiftTime,
          現在のパターン: patternName,
          パターンID: patternId,
          カレンダー: side
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
    
    // 備考セルにイベントリスナーを追加
    const noteCells = container.querySelectorAll('.note-cell');
    
    noteCells.forEach(cell => {
      // カーソルをポインターに
      cell.style.cursor = 'pointer';
      
      // クリックイベント
      cell.addEventListener('click', function() {
        // 既に入力欄がある場合は何もしない
        if (this.querySelector('textarea')) return;
        
        const date = this.getAttribute('data-date');
        const isRight = this.getAttribute('data-is-right') === 'true';
        const dataStore = isRight ? rightMemosData : leftMemosData;
        const key = `${date}_morning`;
        const currentContent = dataStore[key] || '';
        
        // テキストエリアを作成
        const textarea = document.createElement('textarea');
        textarea.className = 'form-control note-textarea';
        textarea.style.height = '100%';
        textarea.style.minHeight = '60px';
        textarea.value = currentContent;
        textarea.placeholder = '備考を入力...';
        
        // 元の内容を消して入力欄を表示
        const originalContent = this.innerHTML;
        this.innerHTML = '';
        this.appendChild(textarea);
        textarea.focus();
        
        // Enterキー押下時の処理（Ctrl/Cmdキーと一緒に押す場合）
        textarea.addEventListener('keydown', function(e) {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault(); // フォーム送信を防止
            textarea.blur();
          }
        });
        
        // フォーカスを失ったときの処理
        textarea.addEventListener('blur', function() {
          const newContent = textarea.value;
          
          // 内容が変更されていれば保存
          if (newContent !== currentContent) {
            // 表示を更新
            cell.textContent = newContent;
            cell.title = newContent;
            
            // データを保存
            saveMemo(date, newContent, isRight);
          } else {
            // 変更がなければ元の表示に戻す
            cell.innerHTML = originalContent;
          }
        });
      });
    });
    
    // 備考表示を更新
    updateMemoDisplay(isRight);
    
    console.log(`カレンダー生成完了: ${containerId}`);
  } catch (error) {
    console.error(`カレンダー生成エラー:`, error);
  }
}


      
// テーブルレスポンシブクラスを適用する関数
function applyResponsiveTable() {
  const containers = document.querySelectorAll('.calendar-container');
  containers.forEach(container => {
    if (!container.classList.contains('table-responsive')) {
      container.classList.add('table-responsive');
    }
    
    // 全画面表示時は右側のカレンダーテーブルを幅いっぱいに
    if (isFullscreen) {
      const rightContainer = document.getElementById('rightContentCol');
      if (rightContainer && rightContainer.contains(container)) {
        const table = container.querySelector('table');
        if (table) {
          table.classList.add('w-100');
        }
      }
    }
  });
}

// 両方のカレンダーを更新する関数
async function updateCalendars() {
  console.log(`カレンダー更新: ${currentYear}年${currentMonth}月`);
  
  try {
    // 左側カレンダー生成
    await generateCalendar(currentYear, currentMonth, 'leftCalendar');
    
    // 左カレンダーの日曜日と祝日を赤く
    const leftContainer = document.getElementById('leftCalendar');
    if (leftContainer) {
      // 日曜日を赤く
      const sundayCells = leftContainer.querySelectorAll('tr.sun .date-cell');
      sundayCells.forEach(cell => {
        cell.style.color = '#dc3545';
        cell.style.fontWeight = 'bold';
      });
      
      // 祝日を赤く
      const holidayCells = leftContainer.querySelectorAll('tr.holiday .date-cell');
      holidayCells.forEach(cell => {
        cell.style.color = '#dc3545';
        cell.style.fontWeight = 'bold';
      });
      
      // 祝日名も赤く
      const holidayNames = leftContainer.querySelectorAll('.holiday-name');
      holidayNames.forEach(span => {
        span.style.color = '#dc3545';
        span.style.fontSize = '0.7rem';
        span.style.display = 'block';
      });
    }
    
    // 右側カレンダー生成
    await generateCalendar(currentYear, currentMonth, 'rightCalendar');
    
    // 右カレンダーの日曜日と祝日を赤く
    const rightContainer = document.getElementById('rightCalendar');
    if (rightContainer) {
      // すべての日付セル（左端と右端両方）を赤く
      const sundayCells = rightContainer.querySelectorAll('tr.sun .date-cell');
      sundayCells.forEach(cell => {
        cell.style.color = '#dc3545';
        cell.style.fontWeight = 'bold';
      });
      
      // 祝日を赤く
      const holidayCells = rightContainer.querySelectorAll('tr.holiday .date-cell');
      holidayCells.forEach(cell => {
        cell.style.color = '#dc3545';
        cell.style.fontWeight = 'bold';
      });
      
      // 祝日名も赤く
      const holidayNames = rightContainer.querySelectorAll('.holiday-name');
      holidayNames.forEach(span => {
        span.style.color = '#dc3545';
        span.style.fontSize = '0.7rem';
        span.style.display = 'block';
      });
    }
    
    // レスポンシブテーブルクラスを適用
    applyResponsiveTable();
    
  } catch (error) {
    console.error('カレンダー更新エラー:', error);
  }
}

  
  // 初期データ取得 - 祝日データを最初に読み込む
  fetchAndDisplayHolidays()
    .then(() => {
      fetchData();
    });
  
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

  $(document).ready(function() {
    $('#patternSelectModal').on('hidden.bs.modal', function () {
      // モーダルが閉じられた後にフォーカスをリセット
      setTimeout(() => {
        document.activeElement.blur();
      }, 10);
    });
    
    // 削除ボタンのイベントリスナーも修正
    const deleteShiftBtn = document.getElementById('deleteShiftBtn');
    if (deleteShiftBtn) {
      // 既存のイベントリスナーを削除（もしあれば）
      const newDeleteBtn = deleteShiftBtn.cloneNode(true);
      deleteShiftBtn.parentNode.replaceChild(newDeleteBtn, deleteShiftBtn);
      
      // 新しいイベントリスナーを追加
      newDeleteBtn.addEventListener('click', function() {
        // フォーカスを移動してからハンドラを呼び出す
        document.body.focus();
        setTimeout(handleDeleteShift, 10);
      });
    }
  });

  
});