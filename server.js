/*
  These are dummy routes which stores data in memory for a key/value.
 */

const express = require('express');
const path = require('path');
const kv = require('./kv');

const app = express();

app.use(express.static('static'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/set/:key/:val', (req, res) => {
  let key = req.params.key;
  let val = req.params.val;
  let force = req.query.force;
  
  let dbValue = kv.get(key);

  if (force || !dbValue) {
    kv.put(key, val);
    res.send(kv.get(key));
  } else {
    res.send(dbValue);
  }
});

app.get('/get/:key', (req, res) => {
  res.send(kv.get(req.params.key));
});

app.listen(3000, () => {
  console.log('App is running on port 3000');
});