let currentUser = "", currentPhone = "", currentAvatar = "", currentHidePhone = false;
let currentChatId = "", currentChatName = "", messageInterval, statusInterval;
let selectedFile = null, selectedFileType = null;
let mediaRecorder, audioChunks = [], isRecording = false;
let recordingTimer, recordingSeconds = 0;

// Переменные для звонков (WebRTC)
let localStream = null;
let peerConnection = null;
let callSignalInterval = null;
let isCallActive = false;

const servers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

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

  // Кнопки звонка
  document.getElementById('btn-call').addEventListener('click', startCall);
  document.getElementById('btn-decline').addEventListener('click', declineCall);
  document.getElementById('btn-accept').addEventListener('click', acceptCall);
  document.getElementById('btn-mute').addEventListener('click', toggleMute);

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
    setInterval(checkCallSignals, 2000); // Проверяем входящие звонки
  }
});

// ... (Функции switchTab, register, login, showProfile, editBio, closeProfile, toggleHidePhone, uploadAvatar, loadChats, findUser, openChat, closeChat, checkStatus, handleFileSelect, toggleRecording, loadMessages, sendMessage остаются БЕЗ ИЗМЕНЕНИЙ) ...

// Но чтобы не раздувать код, я вставлю их сокращенно (они точно такие же, как в прошлом app.js)
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

// === WEBRTC ЗВОНКИ ===
async function startCall() {
  if (!currentChatName) return;
  document.getElementById('call-screen').style.display = 'flex';
  document.getElementById('call-name').innerText = '@' + currentChatName;
  document.getElementById('call-status').innerText = 'Вызов...';
  document.getElementById('btn-mute').style.display = 'none';
  isCallActive = true;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    peerConnection = new RTCPeerConnection(servers);
    
    // Добавляем наш микрофон в соединение
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Когда получаем аудио от собеседника
    peerConnection.ontrack = (event) => {
      document.getElementById('remote-audio').srcObject = event.streams[0];
    };

    // Отправляем ICE-кандидатов через сервер
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(currentChatName, 'ice', event.candidate);
      }
    };

    // Создаем Offer (предложение)
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    sendSignal(currentChatName, 'offer', offer);
    
    // Начинаем слушать ответы
    callSignalInterval = setInterval(checkCallSignals, 2000);

  } catch (e) {
    alert("Ошибка доступа к микрофону: " + e.message);
    declineCall();
  }
}

function sendSignal(to, type, data) {
  fetch('/api/call/signal', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ to, from: currentUser, type, data })
  });
}

async function checkCallSignals() {
  if (!currentUser) return;
  
  try {
    const res = await fetch('/api/call/signal/' + currentUser);
    const signals = await res.json();
    
    for (let sig of signals) {
      if (sig.type === 'offer') {
        // Входящий звонок
        if (!isCallActive) {
          showIncomingCall(sig.from, sig.data);
        }
      } else if (sig.type === 'answer') {
        // Собеседник принял вызов
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sig.data));
        document.getElementById('call-status').innerText = 'Соединено!';
        document.getElementById('btn-mute').style.display = 'flex';
        document.getElementById('btn-accept').style.display = 'none';
      } else if (sig.type === 'ice') {
        // ICE-кандидаты для установки соединения
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(sig.data));
        }
      } else if (sig.type === 'decline') {
        // Собеседник отклонил
        alert("Собеседник отклонил звонок");
        endCall();
      }
    }
  } catch(e) {}
}

async function showIncomingCall(from, offer) {
  isCallActive = true;
  document.getElementById('call-screen').style.display = 'flex';
  document.getElementById('call-name').innerText = '@' + from;
  document.getElementById('call-status').innerText = 'Входящий звонок...';
  document.getElementById('btn-accept').style.display = 'flex';
  document.getElementById('btn-mute').style.display = 'none';

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(servers);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
      document.getElementById('remote-audio').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) sendSignal(from, 'ice', event.candidate);
    };

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    document.getElementById('btn-accept').onclick = async () => {
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendSignal(from, 'answer', answer);
      document.getElementById('call-status').innerText = 'Соединено!';
      document.getElementById('btn-accept').style.display = 'none';
      document.getElementById('btn-mute').style.display = 'flex';
    };
  } catch(e) { alert("Нет доступа к микрофону"); }
}

function declineCall() {
  if (currentChatName) sendSignal(currentChatName, 'decline', null);
  endCall();
}

function acceptCall() {
  // Эта функция вызывается кнопкой "Принять" (уже обрабатывается в showIncomingCall)
}

function toggleMute() {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    document.getElementById('btn-mute').innerText = localStream.getAudioTracks()[0].enabled ? '🎤' : '🔇';
  }
}

function endCall() {
  isCallActive = false;
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (callSignalInterval) clearInterval(callSignalInterval);
  document.getElementById('call-screen').style.display = 'none';
  document.getElementById('remote-audio').srcObject = null;
}
