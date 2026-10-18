const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dhlvlbmjhkrpqsqatpwh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobHZsYm1qaGtycHFzcWF0cHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDY4MDIsImV4cCI6MjEwNzgyMjgwMn0.x7AY8aNbamKBwhJiNu0XLP0JKaqK1oUdR2tr2SUd7Dc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));

let onlineUsers = {}; 

app.post('/api/register', async (req, res) => {
  try {
    const { username, phone, password } = req.body;
    const { data: exUser } = await supabase.from('users').select('*').eq('username', username).single();
    const { data: exPhone } = await supabase.from('users').select('*').eq('phone', phone).single();
    if (exUser) return res.json({ success: false, error: "Логин занят!" });
    if (exPhone) return res.json({ success: false, error: "Номер занят!" });
    await supabase.from('users').insert([{ username, phone, password }]);
    res.json({ success: true });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    const { data: user } = await supabase.from('users').select('*').or(`username.eq.${login},phone.eq.${login}`).single();
    if (!user) return res.json({ success: false, error: "Не найден." });
    if (user.password && user.password !== password) return res.json({ success: false, error: "Неверный пароль." });
    res.json({ success: true, user: { username: user.username, phone: user.phone, avatar: user.avatar, bio: user.bio } });
  } catch (err) { res.json({ success: false, error: "Ошибка сервера." }); }
});

app.post('/api/updateProfile', async (req, res) => {
  const { username, avatar, bio } = req.body;
  let updateData = {};
  if (avatar !== undefined) updateData.avatar = avatar;
  if (bio !== undefined) updateData.bio = bio;
  await supabase.from('users').update(updateData).eq('username', username);
  res.json({ success: true });
});

app.get('/api/user/:username', async (req, res) => {
  const { data } = await supabase.from('users').select('*').eq('username', req.params.username).single();
  if (data) res.json({ username: data.username, phone: data.phone, avatar: data.avatar, bio: data.bio });
  else res.json(null);
});

app.get('/api/chats/:username', async (req, res) => {
  const { data: userData } = await supabase.from('users').select('chats').eq('username', req.params.username).single();
  let chats = userData?.chats || [];
  for (let chat of chats) {
    const { data: msgs } = await supabase.from('messages').select('*').eq('chat_id', chat.id).order('time', { ascending: false }).limit(1);
    if (msgs && msgs.length > 0) {
      chat.lastMessage = msgs[0].text || '📎 Файл';
      chat.lastTime = msgs[0].time;
    }
  }
  res.json(chats);
});

app.post('/api/addChat', async (req, res) => {
  const { username, chatId, name } = req.body;
  const { data } = await supabase.from('users').select('chats').eq('username', username).single();
  let chats = data?.chats || [];
  if (!chats.find(c => c.id === chatId)) {
    chats.push({ id: chatId, name });
    await supabase.from('users').update({ chats }).eq('username', username);
  }
  res.json({ success: true });
});

app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, fileData, fileType } = req.body;
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const { data, error } = await supabase.storage.from('ultra-filse').upload(`chat/${Date.now()}_${fileName}`, buffer, { contentType: fileType });
    if (error) throw error;
    const finalUrl = supabase.storage.from('ultra-filse').getPublicUrl(data.path).data.publicUrl;
    res.json({ success: true, url: finalUrl });
  } catch (err) { res.json({ success: false, error: err.message }); }
});

app.post('/api/pulse', (req, res) => {
  const { username } = req.body;
  onlineUsers[username] = Date.now();
  res.json({ success: true });
});

app.post('/api/message', async (req, res) => {
  const { chatId, from, text, fileUrl, fileType } = req.body;
  const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  await supabase.from('messages').insert([{ id: msgId, chat_id: chatId, sender: from, text: text || '', file_url: fileUrl || null, file_type: fileType || null, time: Date.now(), read_by: [from] }]);
  res.json({ success: true });
});

app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  const { data: msgs } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('time', { ascending: true });
  res.json(msgs || []);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Сервер запущен на ' + PORT));
