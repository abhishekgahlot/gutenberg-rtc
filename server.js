/**
 * These are dummy routes which stores data in memory/file for a key/value.
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const kv = require('./kv');

const app = express();

app.use(express.static('static'));
app.use(bodyParser());


app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/editor', (req, res) => {
  res.sendFile(path.join(__dirname + '/static/editor.html'));
});

app.get('/tinymce', (req, res) => {
  res.sendFile(path.join(__dirname + '/static/tinymce.html'));
});

app.post('/set', (req, res) => {
  let key = Object.keys(req.body)[0];
  let val = [];
  try {
    val = JSON.parse(new Buffer(req.body[key], 'base64').toString('ascii'));
  } catch(e) {}

  let force = req.query.force;
  let peerID = val.peerID;
  let peerName = val.peerName;
  let type = val.type;
  let store = kv.get(key) || [];
  
  /**
   * If key doesn't exist and its initial request return initiator.
   */
  if (!store.length && type === 'initial') {
    let data = {
      peerID,
      type,
      peerName,
      initiator: true
    }
    kv.put(key, [data]);
    res.send(data);
  } else if (store.length && type === 'initial') {
    let exists = false;
    let data = {};

    store.forEach((peer) => {
      if (peer.peerName === peerName) {
        peer.peerID = peerID;
        exists = true;
        peer.signal = false;
        data = peer;
      }
    });

    if (exists) {
      kv.put(key, store);
      res.send(data);
      return;
    }

    data = {
      peerID,
      type,
      peerName,
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

app.post('/remove', (req, res) => {
  let key = Object.keys(req.body)[0];
  let val = [];
  try {
    val = JSON.parse(new Buffer(req.body[key], 'base64').toString('ascii'));
  } catch(e) {}

  let peerID = val.peerID;
  let type = val.type;
  let peerName = val.peerName;
  let data = {
      peerID,
      type,
      initiator: true,
      signal: val.signal,
      peerName,
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