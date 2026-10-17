const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: process.env.PORT || 8080 });
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
          type: 'msg',
          from: myKey,
          nonce: msg.nonce,
          ciphertext: msg.ciphertext
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

console.log('Ультра+ relay запущен на ws://localhost:' + (process.env.PORT || 8080))

