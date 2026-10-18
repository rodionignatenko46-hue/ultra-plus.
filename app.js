let currentUser = "", currentChatId = "", msgInterval;
let mediaRecorder, audioChunks = [], isRecording = false;

document.addEventListener('DOMContentLoaded', () => {
  // ВХОД
  document.getElementById('btn-reg').onclick = async () => {
    const u = document.getElementById('u').value, p = document.getElementById('p').value, ph = document.getElementById('ph').value, msg = document.getElementById('msg');
    if(!u || !p || !ph) return msg.innerText = "Заполните все поля!";
    const res = await fetch('/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: u, phone: ph, password: p }) });
    const data = await res.json();
    msg.innerText = data.success ? "УСПЕХ! Аккаунт создан." : "ОШИБКА: " + data.error;
  };

  document.getElementById('btn-log').onclick = async () => {
    const u = document.getElementById('u').value, p = document.getElementById('p').value, msg = document.getElementById('msg');
    if(!u || !p) return msg.innerText = "Заполните поля!";
    const res = await fetch('/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ login: u, password: p }) });
    const data = await res.json();
    if(data.success) {
      localStorage.setItem('ultra_user', data.user.username);
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('main-screen').style.display = 'flex';
      loadChats();
    } else msg.innerText = "ОШИБКА: " + data.error;
  };

  // ГЛАВНЫЙ ЭКРАН
  document.getElementById('btn-find').onclick = async () => {
    const user = localStorage.getItem('ultra_user');
    const choice = prompt("1 - по номеру, 2 - по @логину:");
    if(!choice) return;
    let query = prompt(choice === '1' ? "Номер друга:" : "Логин друга:");
    if(!query) return;
    const url = choice === '1' ? '/api/find-by-phone/' + encodeURIComponent(query) : '/api/user/' + encodeURIComponent(query);
    const res = await fetch(url);
    const data = await res.json();
    if(!data) return alert("Не найден.");
    const chatId = [user, data.username].sort().join('_');
    await fetch('/api/addChat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: user, chatId, name: data.username }) });
    await fetch('/api/addChat', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: data.username, chatId, name: user }) });
    loadChats();
  };

  document.getElementById('btn-profile').onclick = () => {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('profile-screen').style.display = 'flex';
    document.getElementById('prof-name').innerText = '@' + localStorage.getItem('ultra_user');
  };

  document.getElementById('btn-back-profile').onclick = () => {
    document.getElementById('profile-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
  };

  // ЧАТ
  document.getElementById('btn-back').onclick = () => {
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    clearInterval(msgInterval);
    loadChats();
  };

  document.getElementById('btn-attach').onclick = () => document.getElementById('file-input').click();
  document.getElementById('btn-send').onclick = async () => {
    const user = localStorage.getItem('ultra_user');
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if(!text) return;
    input.value = '';
    await fetch('/api/message', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ chatId: currentChatId, from: user, text }) });
    loadMessages();
  };

  // ПРОФИЛЬ
  document.getElementById('btn-avatar-upload').onclick = () => document.getElementById('avatar-upload').click();
  document.getElementById('btn-change-photo').onclick = () => document.getElementById('avatar-upload').click();
  document.getElementById('avatar-upload').onchange = async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const res = await fetch('/api/upload', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ fileName: 'avatar.jpg', fileData: ev.target.result, fileType: file.type }) });
      const data = await res.json();
      if(data.success) {
        document.getElementById('prof-avatar-img').src = data.url;
        await fetch('/api/updateProfile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: localStorage.getItem('ultra_user'), avatar: data.url }) });
      }
    };
    reader.readAsDataURL(file);
  };

  document.getElementById('btn-edit-bio').onclick = async () => {
    const bio = prompt("Ваш статус:");
    if(bio === null) return;
    document.getElementById('prof-bio').innerText = bio;
    await fetch('/api/updateProfile', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ username: localStorage.getItem('ultra_user'), bio }) });
  };

  document.getElementById('btn-logout').onclick = () => { localStorage.clear(); location.reload(); };
});

async function loadChats() {
  const user = localStorage.getItem('ultra_user');
  const res = await fetch('/api/chats/' + user);
  const chats = await res.json();
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  chats.forEach(chat => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.innerHTML = `<div class="chat-avatar">${chat.name[0].toUpperCase()}</div><div>@${chat.name}</div>`;
    div.onclick = () => openChat(chat.id, chat.name);
    list.appendChild(div);
  });
}

function openChat(id, name) {
  currentChatId = id;
  document.getElementById('chat-title').innerText = '@' + name;
  document.getElementById('main-screen').style.display = 'none';
  document.getElementById('chat-screen').style.display = 'flex';
  loadMessages();
  if(msgInterval) clearInterval(msgInterval);
  msgInterval = setInterval(loadMessages, 1500);
}

async function loadMessages() {
  const user = localStorage.getItem('ultra_user');
  const res = await fetch('/api/messages/' + currentChatId);
  const msgs = await res.json();
  const box = document.getElementById('messages');
  box.innerHTML = '';
  msgs.forEach(m => {
    const div = document.createElement('div');
    div.className = m.sender === user ? 'msg-me' : 'msg-their';
    div.innerText = m.text;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}
