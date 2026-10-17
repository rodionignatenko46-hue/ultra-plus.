const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

// Хранилище сообщений и ключей
const messages = {}; 
const keys = {};

// 1. Регистрация ключа
app.post('/api/register', (req, res) => {
  const { id, pubkey } = req.body;
  keys[id] = pubkey;
  res.json({ success: true });
});

// 2. Получение ключа собеседника
app.get('/api/key/:id', (req, res) => {
  res.json({ pubkey: keys[req.params.id] || null });
});

// 3. Отправка сообщения
app.post('/api/send', (req, res) => {
  const { to, from, key, nonce, ciphertext } = req.body;
  if (!messages[to]) messages[to] = [];
  messages[to].push({ from, key, nonce, ciphertext, timestamp: Date.now() });
  res.json({ success: true });
});

// 4. Получение новых сообщений
app.get('/api/messages/:id', (req, res) => {
  const id = req.params.id;
  const userMessages = messages[id] || [];
  messages[id] = []; // Очищаем после прочтения
  res.json(userMessages);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Сервер запущен на порту ' + PORT));
