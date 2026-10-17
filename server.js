const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Разрешаем отдавать файл для проверки Android
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));

// Файлы для сохранения данных
const DB_USERS = path.join(__dirname, 'users.json');
const DB_MSGS = path.join(__dirname, 'messages.json');

// Загрузка данных при старте
let users = fs.existsSync(DB_USERS) ? JSON.parse(fs.readFileSync(DB_USERS)) : {};
let messages = fs.existsSync(DB_MSGS) ? JSON.parse(fs.readFileSync(DB_MSGS)) : {};

// Функция сохранения
function saveData() {
  fs.writeFileSync(DB_USERS, JSON.stringify(users, null, 2));
  fs.writeFileSync(DB_MSGS, JSON.stringify(messages, null, 2));
}

// Регистрация
app.post('/api/register', (req, res) => {
  const { username, avatar } = req.body;
  if (!users[username]) {
    users[username] = { avatar: avatar || '', chats: [] };
  } else if (avatar) {
    users[username].avatar = avatar;
  }
  saveData();
  res.json({ success: true, user: users[username] });
});

// Получить профиль
app.get('/api/user/:username', (req, res) => {
  res.json(users[req.params.username] || null);
});

// Создать группу
app.post('/api/group', (req, res) => {
  const { groupName, creator } = req.body;
  const groupId = 'group_' + Date.now();
  if (!users[creator]) return res.json({ success: false });
  users[creator].chats.push({ id: groupId, name: groupName, isGroup: true });
  messages[groupId] = [];
  saveData();
  res.json({ success: true, groupId, name: groupName });
});

// Получить чаты
app.get('/api/chats/:username', (req, res) => {
  res.json(users[req.params.username]?.chats || []);
});

// Добавить чат
app.post('/api/addChat', (req, res) => {
  const { username, chatId, name, isGroup } = req.body;
  const u = users[username];
  if (u && !u.chats.find(c => c.id === chatId)) {
    u.chats.push({ id: chatId, name, isGroup });
    saveData();
  }
  res.json({ success: true });
});

// Отправка сообщения
app.post('/api/message', (req, res) => {
  const { chatId, from, text, fileData, fileType } = req.body;
  if (!messages[chatId]) messages[chatId] = [];
  
  const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  messages[chatId].push({ 
    id: msgId, from, text: text || '', fileData: fileData || null, fileType: fileType || null, 
    time: Date.now(), readBy: [from] 
  });
  saveData();
  res.json({ success: true, id: msgId });
});

// Получение сообщений и отметка о прочтении
app.get('/api/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  const { reader } = req.query;
  const msgs = messages[chatId] || [];
  
  let updated = false;
  if (reader) {
    msgs.forEach(m => {
      if (m.from !== reader && !m.readBy.includes(reader)) {
        m.readBy.push(reader);
        updated = true;
      }
    });
    if (updated) saveData();
  }
  res.json(msgs);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Сервер запущен на ' + PORT));
