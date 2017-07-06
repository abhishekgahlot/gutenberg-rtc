/**
 * These are dummy routes which stores data in memory/file for a key/value.
 */

const express = require('express');
const path = require('path');
const kv = require('./kv');

const app = express();

app.use(express.static('static'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/editor', (req, res) => {
  res.sendFile(path.join(__dirname + '/static/editor.html'));
});

app.get('/tinymce', (req, res) => {
  res.sendFile(path.join(__dirname + '/static/tinymce.html'));
});

app.get('/set/:key/:val', (req, res) => {
  let key = req.params.key;
  let val = [];
  try {
    val = JSON.parse(new Buffer(req.params.val, 'base64').toString('ascii'));
  } catch(e) {}

  let force = req.query.force;
  let peerID = val.peerID;
  let type = val.type;
  let store = kv.get(key) || [];
  
  /**
   * If key doesn't exist and its initial request return initiator.
   */
  if (!store.length && type === 'initial') {
    let data = {
      peerID,
      type,
      initiator: true
    }
    kv.put(key, [data]);
    res.send(data);
  } else if (store.length && type === 'initial') {
    let exists = false;
    store.forEach((peer) => {
      if (peer.peerID == peerID) {
        res.send(peer);
        exists = true;
      }
    });

    if (exists) { return; }

    let data = {
      peerID,
      type,
      initiator: false
    }

    kv.get(key).push(data);
    kv.put(key, kv.get(key));
    res.send(data);
  } else if (type === 'register') {
    store.forEach((peer) => {
      if (peer.peerID === peerID) {
        peer.signal = val.signal;
      }
    });
    kv.put(key, kv.get(key));
    res.send(kv.get(key));
  }
});

app.get('/remove/:key/:val', (req, res) => {
  let val = [];
  try {
    val = JSON.parse(new Buffer(req.params.val, 'base64').toString('ascii'));
  } catch(e) {}

  let peerID = val.peerID;
  let type = val.type;
  let key = req.params.key;
  let data = {
      peerID,
      type,
      initiator: true,
      signal: val.signal
  }
  kv.put(key, [data]);
  res.send(data);
});

app.get('/get/:key', (req, res) => {
  res.send(kv.get(req.params.key));
});

app.listen(3000, () => {
  console.log('App is running on port 3000');
});