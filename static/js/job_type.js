document.addEventListener('DOMContentLoaded', function() {
    // DOM要素への参照を取得
    const addJobTypeForm = document.getElementById('addJobTypeForm');
    const jobTypeNameInput = document.getElementById('jobTypeName');
    const jobTypeTable = document.getElementById('jobTypeTable').querySelector('tbody');
    
    // 職種一覧を取得して表示
    fetchJobTypes();
    
    // 新規職種追加フォームの送信処理
    if (addJobTypeForm) {
      addJobTypeForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        // 入力値の取得と検証
        const name = jobTypeNameInput.value.trim();
        if (!name) {
          alert('職種名を入力してください');
          return;
        }
        
        // APIに新規職種を送信
        fetch('/api/job_types', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: name })
        })
        .then(response => {
          if (!response.ok) {
            return response.text().then(text => {
              throw new Error(`サーバーエラー (${response.status}): ${text}`);
            });
          }
          return response.json();
        })
        .then(jobType => {
          console.log('職種追加成功:', jobType);
          
          // フォームをリセット
          jobTypeNameInput.value = '';
          
          // 職種一覧を更新
          fetchJobTypes();
        })
        .catch(error => {
          console.error('職種追加エラー:', error);
          alert(`職種の追加に失敗しました: ${error.message}`);
        });
      });
    }
    
    // 職種一覧を取得する関数
    function fetchJobTypes() {
      fetch('/api/job_types')
        .then(response => {
          if (!response.ok) {
            throw new Error(`サーバーエラー (${response.status})`);
          }
          return response.json();
        })
        .then(jobTypes => {
          console.log('職種取得成功:', jobTypes);
          
          // テーブルをクリア
          jobTypeTable.innerHTML = '';
          
          // 各職種をテーブルに追加
          jobTypes.forEach(jobType => {
            const row = document.createElement('tr');
            
            // ID列
            const idCell = document.createElement('td');
            idCell.textContent = jobType.id;
            row.appendChild(idCell);
            
            // 職種名列
            const nameCell = document.createElement('td');
            nameCell.textContent = jobType.name;
            row.appendChild(nameCell);
            
            // 操作列
            const actionCell = document.createElement('td');
            
            // 編集ボタン
            const editButton = document.createElement('button');
            editButton.textContent = '編集';
            editButton.className = 'btn btn-sm btn-outline-primary mr-2';
            editButton.addEventListener('click', () => editJobType(jobType));
            actionCell.appendChild(editButton);
            
            // 削除ボタン
            const deleteButton = document.createElement('button');
            deleteButton.textContent = '削除';
            deleteButton.className = 'btn btn-sm btn-outline-danger';
            deleteButton.addEventListener('click', () => deleteJobType(jobType.id));
            actionCell.appendChild(deleteButton);
            
            row.appendChild(actionCell);
            
            // 行をテーブルに追加
            jobTypeTable.appendChild(row);
          });
        })
        .catch(error => {
          console.error('職種取得エラー:', error);
          jobTypeTable.innerHTML = `<tr><td colspan="3" class="text-center text-danger">職種の取得に失敗しました: ${error.message}</td></tr>`;
        });
    }
    
    // 職種を編集する関数
    function editJobType(jobType) {
      const newName = prompt('新しい職種名を入力してください:', jobType.name);
      
      // キャンセルまたは空の場合は何もしない
      if (newName === null || newName.trim() === '') {
        return;
      }
      
      // APIに更新リクエストを送信
      fetch(`/api/job_types/${jobType.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName })
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`サーバーエラー (${response.status}): ${text}`);
          });
        }
        return response.json();
      })
      .then(updatedJobType => {
        console.log('職種更新成功:', updatedJobType);
        // 職種一覧を更新
        fetchJobTypes();
      })
      .catch(error => {
        console.error('職種更新エラー:', error);
        alert(`職種の更新に失敗しました: ${error.message}`);
      });
    }
    
    // 職種を削除する関数
    function deleteJobType(id) {
      if (!confirm('この職種を削除してもよろしいですか？\nこの操作は取り消せません。')) {
        return;
      }
      
      // APIに削除リクエストを送信
      fetch(`/api/job_types/${id}`, {
        method: 'DELETE'
      })
      .then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`サーバーエラー (${response.status}): ${text}`);
          });
        }
        console.log('職種削除成功');
        // 職種一覧を更新
        fetchJobTypes();
      })
      .catch(error => {
        console.error('職種削除エラー:', error);
        alert(`職種の削除に失敗しました: ${error.message}`);
      });
    }
  });