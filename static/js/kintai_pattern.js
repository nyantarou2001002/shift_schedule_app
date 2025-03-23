document.addEventListener('DOMContentLoaded', function() {
    // 勤怠パターン一覧を取得してテーブルに表示する関数
    function loadKintaiPatterns() {
      fetch('/api/kintai_patterns')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          const tbody = document.querySelector('#patternTable tbody');
          tbody.innerHTML = ""; // 一旦クリア
          data.forEach(pattern => {
            const tr = document.createElement('tr');
    
            // パターン名セル
            const tdPatternName = document.createElement('td');
            tdPatternName.textContent = pattern.pattern_name;
            tr.appendChild(tdPatternName);
    
            // 説明セル
            const tdDescription = document.createElement('td');
            tdDescription.textContent = pattern.description || "";
            tr.appendChild(tdDescription);
    
            // 操作セル
            const tdActions = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '削除';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteButton.addEventListener('click', function() {
              if (confirm("このパターンを削除してもよろしいですか？")) {
                fetch('/api/deleteKintaiPattern', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: pattern.id })
                })
                .then(response => {
                  if (!response.ok) {
                    return response.text().then(text => { throw new Error(text) });
                  }
                  return response.json();
                })
                .then(result => {
                  console.log('削除成功:', result);
                  // DOMから該当行を削除
                  tr.remove();
                })
                .catch(error => {
                  console.error('削除エラー:', error);
                  alert("削除に失敗しました: " + error.message);
                });
              }
            });
            tdActions.appendChild(deleteButton);
            tr.appendChild(tdActions);
    
            tbody.appendChild(tr);
          });
        })
        .catch(error => {
          console.error('勤怠パターンの取得に失敗しました:', error);
          const tbody = document.querySelector('#patternTable tbody');
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.colSpan = 3;
          td.textContent = 'データの読み込みに失敗しました。';
          td.style.color = 'red';
          tr.appendChild(td);
          tbody.appendChild(tr);
        });
    }
    
    // 新規勤怠パターン追加フォームの送信処理
    const addForm = document.getElementById('addKintaiPatternForm');
    addForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const patternNameInput = document.getElementById('patternName');
      const descriptionInput = document.getElementById('description');
    
      const patternName = patternNameInput.value.trim();
      const description = descriptionInput.value.trim();
    
      if (patternName === "") {
        alert("パターン名は必須です。");
        return;
      }
    
      // POST リクエストで新規勤怠パターンを追加
      fetch('/api/addKintaiPattern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern_name: patternName, description: description })
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => { throw new Error(text) });
        }
        return response.json();
      })
      .then(newPattern => {
        console.log('新規パターン追加成功:', newPattern);
        // 追加後、一覧を再読み込み
        loadKintaiPatterns();
        // 入力欄をクリア
        patternNameInput.value = "";
        descriptionInput.value = "";
      })
      .catch(error => {
        console.error('新規パターン追加に失敗しました:', error);
        alert("新規パターンの追加に失敗しました: " + error.message);
      });
    });
    
    // 初回読み込み
    loadKintaiPatterns();
  });
  