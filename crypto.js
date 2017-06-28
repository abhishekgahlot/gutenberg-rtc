const forge = require('node-forge');
const rsa = forge.pki.rsa;

const crypto = {
  generateKeys: () => {
    return new Promise((resolve, reject) => {
      // generate an RSA key pair asynchronously (uses web workers if available)
      // use workers: -1 to run a fast core estimator to optimize # of workers
      rsa.generateKeyPair({bits: 2048, workers: 2}, (err, keypair) => {
        if (err) {
          return reject(err);
        }
        resolve(keypair);
      });
    });
  }
}

module.exports = crypto;