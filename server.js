const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Настройки Supabase
const SUPABASE_URL = 'https://dhlvlbmjhkrpqsqatpwh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobHZsYm1qaGtycHFzcWF0cHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDY4MDIsImV4cCI6MjEwNzgyMjgwMn0.x7AY8aNbamKBwhJiNu0XLP0JKaqK1oUdR2tr2SUd7Dc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));

const DB_USERS = path.join(__dirname, 'users.json');
const DB_MSGS = path.join(__dirname, 'messages.json');

let users = fs.existsSync(DB_USERS) ? JSON.parse(fs.readFileSync(DB_USERS)) : {};
let messages = fs.existsSync(DB_MSGS) ? JSON.parse(fs.readFileSync(DB_MSGS)) : {};

function saveData() {
  fs.writeFileSync(DB_USERS, JSON.stringify(users, null, 2));
  fs.writeFileSync(DB_MSGS, JSON.stringify(messages, null, 2));
}

app.post('/api/register', (req, res) => {
  const { username, phone, avatar, hidePhone } = req.body;
  if (!users[username]) {
    users[username] = { phone: phone || '', avatar: avatar || '', hidePhone: hidePhone || false, chats: [] };
  } else {
    if (phone) users[username].phone = phone;
    if (avatar !== undefined) users[username].avatar = avatar;
    if (hidePhone !== undefined) users[username].hidePhone = hidePhone;
  }
  saveData();
  res.json({ success: true, user: users[username] });
});

app.get('/api/find-by-phone/:phone', (req, res) => {
  const phone = req.params.phone;
  for (const [username, data] of Object.entries(users)) {
    if (data.phone === phone) return res.json({ username, avatar: data.avatar });
  }
  res.json(null);
});

app.get('/api/user/:username', (req, res) => {
  const u = users[req.params.username];
  if (u) res.json({ username: req.params.username, phone: u.hidePhone ? 'Скрыт' : u.phone, avatar: u.avatar });
  else res.json(null);
});

app.get('/api/chats/:username', (req, res) => {
  res.json(users[req.params.username]?.chats || []);
});

app.post('/api/addChat', (req, res) => {
  const { username, chatId, name, isGroup } = req.body;
  const u = users[username];
  if (u && !u.chats.find(c => c.id === chatId)) {
    u.chats.push({ id: chatId, name, isGroup });
    saveData();
  }
  res.json({ success: true });
});

// ЗАГРУЗКА ФАЙЛА В SUPABASE
app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, fileData, fileType } = req.body;
    // Декодируем Base64 в бинарные данные
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Загружаем в Supabase (папка ultra-files)
    const { data, error } = await supabase.storage
      .from('ultra-files')
      .upload(`chat/${Date.now()}_${fileName}`, buffer, {
        contentType: fileType,
        upsert: true
      });

    if (error) throw error;

    // Получаем публичную ссылку
    const { data: publicUrlData } = supabase.storage
      .from('ultra-files')
      .getPublicUrl(`chat/${Date.now()}_${fileName}`); // Внимание: имя должно совпадать с загрузкой

    // ВАЖНО: getPublicUrl использует то же имя, поэтому лучше сохранить его
    const finalUrl = supabase.storage.from('ultra-files').getPublicUrl(data.path).data.publicUrl;
    res.json({ success: true, url: finalUrl });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/message', (req, res) => {
  const { chatId, from, text, fileUrl, fileType } = req.body;
  if (!messages[chatId]) messages[chatId] = [];
  
  const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  messages[chatId].push({ id: msgId, from, text: text || '', fileUrl: fileUrl || null, fileType: fileType || null, time: Date.now(), readBy: [from] });
  saveData();
  res.json({ success: true, id: msgId });
});

app.get('/api/messages/:chatId', (req, res) => {
  const { chatId } = req.params;
  const { reader } = req.query;
  const msgs = messages[chatId] || [];
  let updated = false;
  if (reader) {
    msgs.forEach(m => {
      if (m.from !== reader && !m.readBy.includes(reader)) { m.readBy.push(reader); updated = true; }
    });
    if (updated) saveData();
  }
  res.json(msgs);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Сервер запущен на ' + PORT));
