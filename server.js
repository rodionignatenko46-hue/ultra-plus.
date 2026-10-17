const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));

// База данных в памяти
const users = {}; // { username: { avatar, pubkey, chats: [] } }
const messages = {}; // { chatId: [ {from, text, time} ] }

// Регистрация / Вход
app.post('/api/register', (req, res) => {
  const { username, pubkey, avatar } = req.body;
  if (!users[username]) {
    users[username] = { avatar: avatar || '', pubkey, chats: [] };
  } else {
    // Обновляем данные при повторном входе
    users[username].pubkey = pubkey;
    if (avatar) users[username].avatar = avatar;
  }
  res.json({ success: true, user: users[username] });
});

// Получить профиль другого юзера
app.get('/api/user/:username', (req, res) => {
  const u = users[req.params.username];
  if (u) res.json({ avatar: u.avatar, pubkey: u.pubkey });
  else res.json(null);
});

// Создать группу
app.post('/api/group', (req, res) => {
  const { groupName, creator } = req.body;
  const groupId = 'group_' + Date.now();
  users[creator].chats.push({ id: groupId, name: groupName, isGroup: true });
  messages[groupId] = [];
  res.json({ success: true, groupId, name: groupName });
});

// Получить список чатов юзера
app.get('/api/chats/:username', (req, res) => {
  res.json(users[req.params.username]?.chats || []);
});

// Добавить чат в список
app.post('/api/addChat', (req, res) => {
  const { username, chatId, name, isGroup } = req.body;
  const u = users[username];
  if (!u.chats.find(c => c.id === chatId)) {
    u.chats.push({ id: chatId, name, isGroup });
  }
  res.json({ success: true });
});

// Отправка сообщения (в чат или группу)
app.post('/api/message', (req, res) => {
  const { chatId, from, text } = req.body;
  if (!messages[chatId]) messages[chatId] = [];
  messages[chatId].push({ from, text, time: Date.now() });
  res.json({ success: true });
});

// Получение сообщений
app.get('/api/messages/:chatId', (req, res) => {
  res.json(messages[req.params.chatId] || []);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Сервер запущен на ' + PORT));
