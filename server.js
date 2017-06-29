/*
  These are dummy routes which stores data in memory/file for a key/value.
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

  let set = new Set();
  let keyValue = kv.get(key);

  /*
    if force query parameter or keyValue doesn't exist
    Add value to new set and update the kv store.
  */
  if (force || !keyValue) {
    set.add(val);
    kv.put(key, set);
    res.send([...kv.get(key)]);
  } else {
    keyValue.add(val);
    res.send([...keyValue]);
  }
});

app.get('/get/:key', (req, res) => {
  res.send(kv.get(req.params.key));
});

app.listen(3000, () => {
  console.log('App is running on port 3000');
});