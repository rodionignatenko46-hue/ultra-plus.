const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://dhlvlbmjhkrpqsqatpwh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRobHZsYm1qaGtycHFzcWF0cHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNDY4MDIsImV4cCI6MjEwNzgyMjgwMn0.x7AY8aNbamKBwhJiNu0XLP0JKaqK1oUdR2tr2SUd7Dc';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.use('/.well-known', express.static(path.join(__dirname, '.well-known')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client.html')));

let onlineUsers = {}; 
let typingUsers = {};

app.post('/api/register', async (req, res) => {
  const { username, phone, avatar, hidePhone } = req.body;
  const { data: existing } = await supabase.from('users').select('*').eq('username', username).single();
  if (!existing) {
    await supabase.from('users').insert([{ username, phone, avatar: avatar || '', hide_phone: hidePhone || false }]);
  } else {
    let updateData = {};
    if (phone) updateData.phone = phone;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (hidePhone !== undefined) updateData.hide_phone = hidePhone;
    await supabase.from('users').update(updateData).eq('username', username);
  }
  res.json({ success: true });
});

app.get('/api/find-by-phone/:phone', async (req, res) => {
  const { data } = await supabase.from('users').select('username, avatar').eq('phone', req.params.phone).single();
  res.json(data || null);
});

app.get('/api/user/:username', async (req, res) => {
  const { data } = await supabase.from('users').select('*').eq('username', req.params.username).single();
  if (data) res.json({ username: data.username, phone: data.hide_phone ? 'Скрыт' : data.phone, avatar: data.avatar });
  else res.json(null);
});

app.get('/api/chats/:username', async (req, res) => {
  const { data } = await supabase.from('users').select('chats').eq('username', req.params.username).single();
  res.json(data?.chats || []);
});

app.post('/api/addChat', async (req, res) => {
  const { username, chatId, name, isGroup } = req.body;
  const { data } = await supabase.from('users').select('chats').eq('username', username).single();
  let chats = data?.chats || [];
  if (!chats.find(c => c.id === chatId)) {
    chats.push({ id: chatId, name, isGroup });
    await supabase.from('users').update({ chats }).eq('username', username);
  }
  res.json({ success: true });
});

app.post('/api/upload', async (req, res) => {
  try {
    const { fileName, fileData, fileType } = req.body;
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const { data, error } = await supabase.storage.from('ultra-filse').upload(`chat/${Date.now()}_${fileName}`, buffer, { contentType: fileType, upsert: true });
    if (error) throw error;
    const finalUrl = supabase.storage.from('ultra-filse').getPublicUrl(data.path).data.publicUrl;
    res.json({ success: true, url: finalUrl });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/pulse', (req, res) => {
  const { username, typing } = req.body;
  onlineUsers[username] = Date.now();
  if (typing) typingUsers[username] = Date.now();
  res.json({ success: true });
});

app.get('/api/status/:username', (req, res) => {
  const user = req.params.username;
  const now = Date.now();
  const isOnline = onlineUsers[user] && (now - onlineUsers[user] < 15000);
  const isTyping = typingUsers[user] && (now - typingUsers[user] < 5000);
  res.json({ isOnline, isTyping });
});

app.post('/api/message', async (req, res) => {
  const { chatId, from, text, fileUrl, fileType, replyTo } = req.body;
  const msgId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
  await supabase.from('messages').insert([{ id: msgId, chat_id: chatId, sender: from, text: text || '', file_url: fileUrl || null, file_type: fileType || null, reply_to: replyTo || null, time: Date.now(), read_by: [from] }]);
  res.json({ success: true, id: msgId });
});

app.delete('/api/message/:chatId/:msgId', async (req, res) => {
  await supabase.from('messages').delete().eq('id', req.params.msgId);
  res.json({ success: true });
});

app.get('/api/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  const { reader } = req.query;
  const { data: msgs } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('time', { ascending: true });
  if (reader && msgs) {
    for (let m of msgs) {
      if (m.sender !== reader && !m.read_by.includes(reader)) {
        m.read_by.push(reader);
        await supabase.from('messages').update({ read_by: m.read_by }).eq('id', m.id);
      }
    }
  }
  res.json(msgs || []);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Сервер запущен на ' + PORT));
