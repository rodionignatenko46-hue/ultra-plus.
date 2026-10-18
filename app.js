let currentUser = "", currentPhone = "", currentAvatar = "", currentHidePhone = false;
let currentChatId = "", currentChatName = "", messageInterval, statusInterval;
let selectedFile = null, selectedFileType = null;
let mediaRecorder, audioChunks = [], isRecording = false;
let recordingTimer, recordingSeconds = 0;

// --- ПРИВЯЗКА КНОПОК ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tab-login').addEventListener('click', () => switchTab('login'));
  document.getElementById('tab-register').addEventListener('click', () => switchTab('register'));
  document.getElementById('btn-login').addEventListener('click', login);
  document.getElementById('btn-register').addEventListener('click', register);

  document.getElementById('btn-find').addEventListener('click', findUser);
  document.getElementById('btn-fab').addEventListener('click', findUser);
  document.getElementById('btn-profile').addEventListener('click', showProfile);
  document.getElementById('nav-profile').addEventListener('click', showProfile);

  document.getElementById('btn-back').addEventListener('click', closeChat);
  document.getElementById('btn-attach').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('btn-mic').addEventListener('click', toggleRecording);
  document.getElementById('btn-send').addEventListener('click', sendMessage);
  document.getElementById('file-input').addEventListener('change', handleFileSelect);
  document.getElementById('msg-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });
  document.getElementById('msg-input').addEventListener('input', () => sendPulse(true));

  document.getElementById('btn-back-profile').addEventListener('click', closeProfile);
  document.getElementById('btn-avatar-upload').addEventListener('click', () => document.getElementById('avatar-upload').click());
  document.getElementById('btn-change-photo').addEventListener('click', () => document.getElementById('avatar-upload').click());
  document.getElementById('avatar-upload').addEventListener('change', uploadAvatar);
  document.getElementById('btn-edit-bio').addEventListener('click', editBio);
  document.getElementById('btn-hide-phone').addEventListener('click', toggleHidePhone);
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Проверка авторизации
  const savedUser = localStorage.getItem('ultra_user');
  if(savedUser) {
    currentUser = savedUser;
    currentPhone = localStorage.getItem('ultra_phone') || '';
    currentAvatar = localStorage.getItem('ultra_avatar') || '';
    currentHidePhone = localStorage.getItem('ultra_hide') === 'true';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    loadChats();
    setInterval(() => sendPulse(false), 10000);
  }
});

function switchTab(tab) {
  document.getElementById('form-login').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'flex' : 'none';
  document.getElementById('tab-login').style.color = tab === 'login' ? 'white' : '#888';
  document.getElementById('tab-register').style.color = tab === 'register' ? 'white' : '#888';
}

async function register() {
  const username = document.getElementById('reg-username').value.trim().replace('@', '');
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-pass').value;
  const statusEl = document.getElementById('status-msg');
  if(!username || !phone || !password) { statusEl.innerText = "Заполните все поля!"; return; }
  
  statusEl.innerText = "Отправка...";
  try {
    const res = await fetch('/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username, phone, password }) });
    const data = await res.json();
    if(data.success) {
      statusEl.innerText = "УСПЕХ! Аккаунт создан.";
      switchTab('login');
    } else { statusEl.innerText = "ОШИБКА: " + data.error; }
  } catch (e) { statusEl.innerText = "ОШИБКА СЕТИ: " + e.message; }
}

async function login() {
  const loginVal = document.getElementById('login-name').value.trim().replace('@', '');
  const password = document.getElementById('login-pass').value;
  const statusEl = document.getElementById('status-msg');
  if(!loginVal || !password) { statusEl.innerText = "Заполните все поля!"; return; }
  
  statusEl.innerText = "Вход...";
  try {
    const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ login: loginVal, password }) });
    const data = await res.json();
    if(data.success) {
      statusEl.innerText = "УСПЕХ!";
      currentUser = data.user.username; currentPhone = data.user.phone; currentAvatar = data.user.avatar;
      localStorage.setItem('ultra_user', currentUser);
      localStorage.setItem('ultra_phone', currentPhone);
      localStorage.setItem('ultra_avatar', currentAvatar || '');
      
      setTimeout(() => {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('main-screen').style.display = 'flex';
        loadChats();
        setInterval(() => sendPulse(false), 10000);
      }, 500);
    } else { statusEl.innerText = "ОШИБКА: " + data.error; }
  } catch (e) { statusEl.innerText = "ОШИБКА СЕТИ: " + e.message; }
}

function logout() { if(confirm("Выйти?")) { localStorage.clear(); location.reload(); } }
function sendPulse(typing) { if(currentUser) fetch('/api/pulse', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: currentUser, typing }) }); }

async function showProfile() {
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('profile-screen').style.display = 'flex';
  document.getElementById('prof-name').innerText = '@' + currentUser;
  document.getElementById('prof-phone').innerText = currentHidePhone ? 'Номер скрыт' : currentPhone;
  document.getElementById('hide-phone-status').innerText = currentHidePhone ? 'Вкл' : 'Выкл';
  if(currentAvatar) document.getElementById('prof-avatar-img').src = currentAvatar;
  const res = await fetch('/api/user/' + currentUser);
  const data = await res.json();
  document.getElementById('prof-bio').innerText = (data && data.bio) ? data.bio : 'Напишите что-нибудь о себе...';
}

async function editBio() {
  const newBio = prompt("Ваш новый статус:");
  if(newBio === null) return;
  await fetch('/api/updateProfile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: currentUser, bio: newBio }) });
  document.getElementById('prof-bio').innerText = newBio || 'Напишите что-нибудь о себе...';
}

function closeProfile() { document.getElementById('profile-screen').style.display = 'none'; document.getElementById('main-screen').style.display = 'flex'; }

function toggleHidePhone() {
  currentHidePhone = !currentHidePhone;
  localStorage.setItem('ultra_hide', currentHidePhone);
  document.getElementById('hide-phone-status').innerText = currentHidePhone ? 'Вкл' : 'Выкл';
  document.getElementById('prof-phone').innerText = currentHidePhone ? 'Номер скрыт' : currentPhone;
  fetch('/api/updateProfile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: currentUser, hidePhone: currentHidePhone }) });
}

async function uploadAvatar(event) {
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64 = e.target.result;
    const res = await fetch('/api/upload', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fileName: 'avatar.jpg', fileData: base64, fileType: file.type }) });
    const data = await res.json();
    if(data.success) {
      currentAvatar = data.url;
      localStorage.setItem('ultra_avatar', currentAvatar);
      document.getElementById('prof-avatar-img').src = currentAvatar;
      await fetch('/api/updateProfile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: currentUser, avatar: currentAvatar }) });
    }
  };
  reader.readAsDataURL(file);
}

async function loadChats() {
  const res = await fetch('/api/chats/' + currentUser);
  const chats = await res.json();
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  
  if(chats.length === 0) {
    list.innerHTML = `<div style="text-align:center; margin-top: 40px;"><h3 style="color: #fff;">Здесь пока пусто</h3><button id="btn-empty-find" style="background: #3390ec; color: white; border: none; padding: 12px 24px; border-radius: 12px; margin-top: 15px; cursor:pointer;">Найти друга</button></div>`;
    document.getElementById('btn-empty-find').addEventListener('click', findUser);
    return;
  }

  chats.sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));

  chats.forEach(chat => {
    const div = document.createElement('div'); div.className = 'chat-item';
    div.addEventListener('click', () => openChat(chat.id, chat.name, chat.isGroup));
    
    let timeStr = chat.lastTime ? new Date(chat.lastTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
    let lastMsgText = chat.lastMessage || 'Нет сообщений';
    if (chat.lastSender === currentUser) lastMsgText = 'Вы: ' + lastMsgText;
    let unreadBadge = chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : '';
    
    div.innerHTML = `
      <div class="chat-avatar"><img src="https://cdn-icons-png.flaticon.com/512/149/149071.png"></div>
      <div class="chat-info">
        <div class="chat-name">@${chat.name}</div>
        <div class="chat-preview">${lastMsgText}</div>
      </div>
      <div class="chat-meta">
        <div class="chat-time">${timeStr}</div>
        ${unreadBadge}
      </div>
    `;
    list.appendChild(div);
  });
}

async function findUser() {
  const choice = prompt("1 - по номеру, 2 - по @логину:");
  if(!choice) return;
  let query = prompt(choice === '1' ? "Номер друга:" : "Логин друга:");
  if(!query) return;
  const url = choice === '1' ? '/api/find-by-phone/' + encodeURIComponent(query) : '/api/user/' + encodeURIComponent(query);
  const res = await fetch(url);
  const data = await res.json();
  if(!data) return alert("Не найден.");
  if(data.username === currentUser) return alert("Это вы!");
  const chatId = [currentUser, data.username].sort().join('_');
  await fetch('/api/addChat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: currentUser, chatId, name: data.username, isGroup: false }) });
  await fetch('/api/addChat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: data.username, chatId, name: currentUser, isGroup: false }) });
  alert("Чат создан!"); loadChats();
}

function openChat(id, name, isGroup) {
  currentChatId = id; currentChatName = name;
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('chat-screen').style.display = 'flex';
  document.getElementById('chat-title').innerText = '@' + name;
  loadMessages();
  if(messageInterval) clearInterval(messageInterval);
  messageInterval = setInterval(loadMessages, 1000);
  if(statusInterval) clearInterval(statusInterval);
  statusInterval = setInterval(checkStatus, 2000);
}

function closeChat() { document.getElementById('chat-screen').style.display = 'none'; document.getElementById('main-screen').style.display = 'flex'; clearInterval(messageInterval); clearInterval(statusInterval); loadChats(); }

async function checkStatus() {
  if(!currentChatName) return;
  const res = await fetch('/api/status/' + currentChatName);
  const data = await res.json();
  const statusEl = document.getElementById('chat-status');
  if(data.isTyping) { statusEl.innerText = 'печатает...'; statusEl.className = 'typing'; }
  else if(data.isOnline) { statusEl.innerText = 'в сети'; statusEl.className = ''; statusEl.style.color = '#00ff88'; }
  else { statusEl.innerText = 'был(а) недавно'; statusEl.className = ''; statusEl.style.color = '#888'; }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(event) { selectedFile = event.target.result; selectedFileType = file.type; document.getElementById('msg-input').placeholder = "Файл готов!"; };
  reader.readAsDataURL(file);
}

async function toggleRecording() {
  const micBtn = document.getElementById('btn-mic');
  const inputField = document.getElementById('msg-input');
  if(!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async function(event) {
          inputField.placeholder = "Отправка...";
          const res = await fetch('/api/upload', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fileName: 'voice.webm', fileData: event.target.result, fileType: 'audio/webm' }) });
          const data = await res.json();
          if(data.success) {
            await fetch('/api/message', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chatId: currentChatId, from: currentUser, text: '', fileUrl: data.url, fileType: 'audio/webm', replyTo: null }) });
            loadMessages();
            inputField.placeholder = "Написать сообщение...";
          } else { alert("Ошибка: " + data.error); inputField.placeholder = "Написать сообщение..."; }
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start(); isRecording = true; recordingSeconds = 0;
      micBtn.style.color = 'red'; micBtn.innerText = '⏹️';
      inputField.placeholder = "Идет запись... 0:00"; inputField.disabled = true;
      recordingTimer = setInterval(() => {
        recordingSeconds++;
        inputField.placeholder = `Идет запись... ${Math.floor(recordingSeconds/60)}:${(recordingSeconds%60).toString().padStart(2,'0')}`;
      }, 1000);
    } catch(e) { alert("Нет доступа к микрофону."); }
  } else {
    mediaRecorder.stop(); isRecording = false; clearInterval(recordingTimer);
    micBtn.style.color = '#3390ec'; micBtn.innerText = '🎤';
    inputField.disabled = false; inputField.placeholder = "Написать сообщение...";
  }
}

async function loadMessages() {
  if(!currentChatId) return;
  try {
    const res = await fetch(`/api/messages/${currentChatId}?reader=${currentUser}`);
    const msgs = await res.json();
    const box = document.getElementById('messages');
    if(box.children.length === msgs.length && box.dataset.lastMsg === (msgs[msgs.length-1]?.id || '')) return;
    box.innerHTML = ''; box.dataset.lastMsg = msgs[msgs.length-1]?.id || '';
    msgs.forEach(m => {
      const isMe = m.sender === currentUser;
      const div = document.createElement('div'); div.className = `msg-container ${isMe ? 'my' : 'their'}`;
      const time = new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      let content = '';
      if(m.file_url) {
        if(m.file_type.startsWith('image/')) content += `<img src="${m.file_url}" style="max-width:100%; border-radius:10px; margin-bottom:5px;"><br>`;
        else if(m.file_type.startsWith('video/')) content += `<video src="${m.file_url}" controls style="max-width:100%; border-radius:10px; margin-bottom:5px;"></video><br>`;
        else if(m.file_type.startsWith('audio/')) content += `<audio src="${m.file_url}" controls style="max-width:100%; margin-bottom:5px;"></audio><br>`;
        else content += `<a href="${m.file_url}" target="_blank" style="color:#fff;">📄 Скачать</a><br>`;
      }
      content += m.text;
      div.innerHTML = `<div class="msg-bubble ${isMe ? 'msg-my' : 'msg-their'}">${content}<div style="font-size:10px; text-align:right; opacity:0.7; margin-top:5px;">${time}</div></div>`;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  } catch(e) {}
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if(!text && !selectedFile) return;
  let fileUrl = null, fileTypeToSend = null;
  if(selectedFile) {
    input.placeholder = "Загрузка...";
    const res = await fetch('/api/upload', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fileName: 'file', fileData: selectedFile, fileType: selectedFileType }) });
    const data = await res.json();
    if(data.success) { fileUrl = data.url; fileTypeToSend = selectedFileType; }
    else { alert('Ошибка загрузки'); return; }
  }
  input.value = ''; selectedFile = null; selectedFileType = null; input.placeholder = "Написать сообщение...";
  await fetch('/api/message', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chatId: currentChatId, from: currentUser, text, fileUrl, fileType: fileTypeToSend }) });
  loadMessages();
}
