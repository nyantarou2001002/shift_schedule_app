document.addEventListener('DOMContentLoaded', function() {
    // 従業員一覧の取得
    function loadEmployees() {
      fetch('/api/employees')
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          const tbody = document.querySelector('#employeesTable tbody');
          tbody.innerHTML = ""; // 一旦クリア
          data.forEach(employee => {
            const tr = document.createElement('tr');
            // data属性に従業員IDを設定（並び順保存や memo 更新に利用）
            tr.setAttribute('data-id', employee.id);
    
            // 名前セル
            const tdName = document.createElement('td');
            tdName.textContent = employee.name;
            tr.appendChild(tdName);
    
            // メモセル（クリックで直接編集）
            const tdMemo = document.createElement('td');
            tdMemo.textContent = employee.memo || '';
            tdMemo.style.cursor = 'pointer';
            tdMemo.addEventListener('click', function() {
              if (tdMemo.querySelector('input')) return;
              const currentMemo = tdMemo.textContent;
              const input = document.createElement('input');
              input.type = 'text';
              input.className = 'form-control';
              input.value = currentMemo;
              tdMemo.innerHTML = "";
              tdMemo.appendChild(input);
              input.focus();
    
              input.addEventListener('keydown', function(e) {
                if (e.key === "Enter") {
                  input.blur();
                }
              });
    
              input.addEventListener('blur', function() {
                const newMemo = input.value;
                if (newMemo !== currentMemo) {
                  fetch('/api/saveMemo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: employee.id, memo: newMemo })
                  })
                  .then(response => {
                    if (!response.ok) {
                      return response.text().then(text => { throw new Error(text) });
                    }
                    return response.json();
                  })
                  .then(result => {
                    console.log('メモ更新成功:', result);
                    tdMemo.textContent = newMemo;
                  })
                  .catch(error => {
                    console.error('メモ更新エラー:', error);
                    alert("メモの更新に失敗しました: " + error.message);
                    tdMemo.textContent = currentMemo;
                  });
                } else {
                  tdMemo.textContent = currentMemo;
                }
              }, { once: true });
            });
            tr.appendChild(tdMemo);
    
            // 操作セル（削除ボタンを追加）
            const tdActions = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '削除';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteButton.addEventListener('click', function() {
              if (confirm("この従業員を削除してもよろしいですか？")) {
                fetch('/api/deleteEmployee', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: employee.id })
                })
                .then(response => {
                  if (!response.ok) {
                    return response.text().then(text => { throw new Error(text) });
                  }
                  return response.json();
                })
                .then(result => {
                  console.log('削除成功:', result);
                  // DOMから該当の行を削除
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
          console.error('従業員データの取得に失敗しました:', error);
          const tbody = document.querySelector('#employeesTable tbody');
          const errorRow = document.createElement('tr');
          const errorCell = document.createElement('td');
          errorCell.colSpan = 3;
          errorCell.textContent = 'データの読み込みに失敗しました。';
          errorCell.style.color = 'red';
          errorRow.appendChild(errorCell);
          tbody.appendChild(errorRow);
        });
    }
    
    loadEmployees();
    
    // 従業員追加フォームの処理（既存の実装と同様）
    const addEmployeeForm = document.getElementById('addEmployeeForm');
    addEmployeeForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const nameInput = document.getElementById('employeeName');
      const memoInput = document.getElementById('employeeMemo');
    
      const name = nameInput.value.trim();
      const memo = memoInput.value.trim();
    
      if (name === "") {
        alert("名前は必須です。");
        return;
      }
    
      fetch('/api/addEmployee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, memo: memo })
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => { throw new Error(text) });
        }
        return response.json();
      })
      .then(newEmployee => {
        const tbody = document.querySelector('#employeesTable tbody');
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', newEmployee.id);
    
        const tdName = document.createElement('td');
        tdName.textContent = newEmployee.name;
        tr.appendChild(tdName);
    
        const tdMemo = document.createElement('td');
        tdMemo.textContent = newEmployee.memo || '';
        tdMemo.style.cursor = 'pointer';
        tdMemo.addEventListener('click', function() {
          if (tdMemo.querySelector('input')) return;
          const currentMemo = tdMemo.textContent;
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'form-control';
          input.value = currentMemo;
          tdMemo.innerHTML = "";
          tdMemo.appendChild(input);
          input.focus();
    
          input.addEventListener('keydown', function(e) {
            if (e.key === "Enter") {
              input.blur();
            }
          });
    
          input.addEventListener('blur', function() {
            const newMemo = input.value;
            if (newMemo !== currentMemo) {
              fetch('/api/saveMemo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: newEmployee.id, memo: newMemo })
              })
              .then(response => {
                if (!response.ok) {
                  return response.text().then(text => { throw new Error(text) });
                }
                return response.json();
              })
              .then(result => {
                console.log('メモ更新成功:', result);
                tdMemo.textContent = newMemo;
              })
              .catch(error => {
                console.error('メモ更新エラー:', error);
                alert("メモの更新に失敗しました: " + error.message);
                tdMemo.textContent = currentMemo;
              });
            } else {
              tdMemo.textContent = currentMemo;
            }
          }, { once: true });
        });
        tr.appendChild(tdMemo);
    
        const tdActions = document.createElement('td');
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '削除';
        deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
        deleteButton.addEventListener('click', function() {
          if (confirm("この従業員を削除してもよろしいですか？")) {
            fetch('/api/deleteEmployee', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: newEmployee.id })
            })
            .then(response => {
              if (!response.ok) {
                return response.text().then(text => { throw new Error(text) });
              }
              return response.json();
            })
            .then(result => {
              console.log('削除成功:', result);
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
    
        if (tbody.firstChild) {
          tbody.insertBefore(tr, tbody.firstChild);
        } else {
          tbody.appendChild(tr);
        }
    
        nameInput.value = "";
        memoInput.value = "";
      })
      .catch(error => {
        console.error('従業員の追加に失敗しました:', error);
        alert("従業員の追加に失敗しました: " + error.message);
      });
    });
    
    // ドラッグ＆ドロップ処理（従来通り）
    var tbody = document.querySelector('#employeesTable tbody');
    new Sortable(tbody, {
      animation: 150,
      onStart: function (evt) {
        evt.item.classList.add('dragging');
      },
      onEnd: function (evt) {
        evt.item.classList.remove('dragging');
        console.log('行が移動されました: ', evt.oldIndex, '→', evt.newIndex);
        
        const rows = document.querySelectorAll('#employeesTable tbody tr');
        const newOrder = Array.from(rows).map(row => Number(row.getAttribute('data-id')));
        
        fetch('/api/updateEmployeeOrder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: newOrder })
        })
        .then(response => {
          if (!response.ok) {
            return response.text().then(text => { throw new Error(text) });
          }
          return response.json();
        })
        .then(result => {
          console.log('並び順更新成功:', result);
        })
        .catch(error => {
          console.error('並び順更新エラー:', error);
          alert("並び順の更新に失敗しました: " + error.message);
        });
      }
    });
  });
  