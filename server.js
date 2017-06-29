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

app.get('/set/:key/:val', (req, res) => {
  let key = req.params.key;
  let val = new Buffer(req.params.val, 'base64').toString('ascii');
  let force = req.query.force;

  let firstSet = new Set();
  let keyValue = kv.getSet(key);

  /**
   * if force query parameter or keyValue doesn't exist
   * Add value to new set and update the kv store.
   * else add to set you got and update kv.
   */
  if (force || !keyValue) {
    firstSet.add(val);
    res.send(kv.updateSet(key, firstSet));
  } else {
    keyValue.add(val);
    res.send(kv.updateSet(key, keyValue));
  }
});

app.get('/get/:key', (req, res) => {
  res.send(Array.from(kv.getSet(req.params.key)));
});

app.listen(3000, () => {
  console.log('App is running on port 3000');
});