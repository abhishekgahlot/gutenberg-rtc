const assert = require('assert');

const crypto = require('../crypto');

describe('Crypto', function() {
  describe('#generateKeys', function() {
    it('should return both public and private key', function(done) {
      crypto.generateKeys()
      .then((keys) => {
        assert.equal([ 'privateKey', 'publicKey' ].toString(), Object.keys(keys).toString());
        done();
      })
    });
  });
});