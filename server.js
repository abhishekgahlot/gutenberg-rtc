/*
  These are dummy routes which stores data in memory for a key/value.
 */

const express = require('express');
const path = require('path');

const app = express();

app.use(express.static('static'));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/index.html'));
});

app.listen(3000, function () {
  console.log('App is running on port 3000');
});