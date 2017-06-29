const Storage = require('node-storage');
// left empty for future dependencies
const kv = new Storage('./keys.db');
module.exports = kv;