const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '50mb' })); // Увеличиваем лимит для фото/видео
app.use(express.static(__dirname));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));

const users = {}; 
const messages = {}; 

app.post('/api/register', (req, res) => {
  const { username, pubkey, avatar } = req.body;
  if (!users[username]) {
    users[username] = { avatar: avatar || '', pubkey, chats: [] };
  } else {
    users[username].pubkey = pubkey;
    if (avatar) users[username].avatar = avatar;
  }
  res.json({ success: true, user: users[username] });
});

app.get('/api/user/:username', (req, res) => {
  const u = users[req.params.username];
  if (u) res.json({ avatar: u.avatar, pubkey: u.pubkey });
  else res.json(null);
});

app.post('/api/group', (req, res) => {
  const { groupName, creator } = req.body;
  const groupId = 'group_' + Date.now();
  users[creator].chats.push({ id: groupId, name: groupName, isGroup: true });
  messages[groupId] = [];
  res.json({ success: true, groupId, name: groupName });
});

app.get('/api/chats/:username', (req, res) => {
  res.json(users[req.params.username]?.chats || []);
});

app.post('/api/addChat', (req, res) => {
  const { username, chatId, name, isGroup } = req.body;
  const u = users[username];
  if (u && !u.chats.find(c => c.id === chatId)) {
    u.chats.push({ id: chatId, name, isGroup });
  }
  res.json({ success: true });
});

// Отправка сообщения (с временем и поддержкой файлов)
app.post('/api/message', (req, res) => {
  const { chatId, from, text, fileData, fileType } = req.body;
  if (!messages[chatId]) messages[chatId] = [];
  
  const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  messages[chatId].push({ 
    id: msgId, from, text: text || '', fileData: fileData || null, fileType: fileType || null, 
    time: Date.now(), readBy: [from] 
  });
  res.json({ success: true, id: msgId });
});

// Получение сообщений и отметка о прочтении
app.get('/api/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  const { reader } = req.query;
  
  const msgs = messages[chatId] || [];
  
  // Отмечаем прочитанным, если читает не отправитель
  if (reader) {
    msgs.forEach(m => {
      if (m.from !== reader && !m.readBy.includes(reader)) {
        m.readBy.push(reader);
      }
    });
  }
  res.json(msgs);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Сервер запущен на ' + PORT));
