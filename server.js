const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(__dirname)); 

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

const peers = new Map();

wss.on('connection', (ws) => {
  let myKey = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'register') {
      myKey = msg.pubkey;
      peers.set(myKey, ws);
      ws.send(JSON.stringify({ type: 'registered', pubkey: myKey }));
      return;
    }

    if (msg.type === 'send') {
      const target = peers.get(msg.to);
      if (target && target.readyState === 1) {
        target.send(JSON.stringify({
          type: 'msg', from: myKey, nonce: msg.nonce, ciphertext: msg.ciphertext
        }));
        ws.send(JSON.stringify({ type: 'delivered' }));
      } else {
        ws.send(JSON.stringify({ type: 'offline' }));
      }
    }
  });

  ws.on('close', () => {
    if (myKey && peers.get(myKey) === ws) peers.delete(myKey);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Сервер Ультра+ запущен на порту ' + PORT);
});
