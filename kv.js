const Storage = require('node-storage');
// left empty for future dependencies
const kv = new Storage('./keys.db');

kv.getSet = function(key) {
  try {
    let val = new Set(JSON.parse(kv.get(key)));
    return val;
  } catch (e) {
    return new Set();
  }
}

kv.updateSet = function(key, set) {
  let setArray = JSON.stringify(Array.from(set));
  kv.put(key, setArray);
  return setArray;
}

module.exports = kv;