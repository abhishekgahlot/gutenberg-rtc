'use strict';

const Peer = require('simple-peer');
const uuidv1 = require('uuid/v1');
const uuidv4 = require('uuid/v4');
const EventEmitter = require('events').EventEmitter;

const crypto = require('./crypto');

class Signal {
    /**
     * @param {string} url 
     * @param {string} grtcID 
     * @param {object} signalID 
     * url is base url of page.
     * grtcID is collaborate param from url.
     * signalID is peer signal used to traverse and connect P2P.
     */
    constructor(url, grtcID, signalID) {
        let self = this;
        self.url = url;
        self.grtcID = grtcID;
        self.signalID = signalID;
    }

    /**
     * Clear the key forcefully in kv.
     */
    clearSignal() {
        let self = this;
        return new Promise((resolve, reject) => {
            $.get(self.url + '/set/' + self.grtcID + '/' + btoa(JSON.stringify(self.signalID)) + '?force=true', (resp) => {
                resolve(resp);
            }).fail((e) => {
                reject(e);
            });
        });
    }

    /**
     * getSignal is called periodically in order to fetch the updated signal.
     */
    getSignal() {
        let self = this;
        return new Promise((resolve, reject) => {
            $.get(self.url + '/get/' + self.grtcID, (resp) => {
                resolve(resp);
            }).fail((e) => {
                reject(e);
            });
        });
    }

    /**
     * Updates the server route so that peers can get the data.
     */
    updateSignal() {
        let self = this;
        return new Promise((resolve, reject) => {
            $.get(self.url + '/set/' + self.grtcID + '/' + btoa(JSON.stringify(self.signalID)), (resp) => {
                resolve(resp);
            }).fail((e) => {
                reject(e);
            });
        });
    }
}

/**
 * TransportLayer use a single key and provide the abstractions
 * to send data encrypted and receieve decrypted data using the key.
 */
class TransportLayer {
    constructor(key) {
        let self = this;
        try {
            self.key = atob(key.replace(/\0/g, '')); // remove null chars.
        } catch(e) {
            self.key = key;
        }
    }

    /**
     * @param {string} data 
     * encrypts using created key with pkcs5 module.
     */
    encrypt(data) {
        let iv = crypto.forge.random.getBytesSync(16);
        let cipher = crypto.forge.cipher.createCipher('AES-CBC', this.key);
        
        cipher.start({iv: iv});
        cipher.update(crypto.forge.util.createBuffer(data));
        cipher.finish();
        
        let encrypted = cipher.output;
        let obj = {'iv': crypto.forge.util.bytesToHex(iv), 'encrypted': crypto.forge.util.bytesToHex(encrypted) };

        return obj;
    }

    /**
     * @param {string} encrypted 
     * 
     * decrypts using object which has IV.
     */
    decrypt(encrypted) {
        let iv = crypto.forge.util.createBuffer();
        let data = crypto.forge.util.createBuffer();
        iv.putBytes(crypto.forge.util.hexToBytes(encrypted.iv));
        data.putBytes(crypto.forge.util.hexToBytes(encrypted.encrypted));
        
        let decipher = crypto.forge.cipher.createDecipher('AES-CBC', this.key);
        decipher.start({iv: iv});
        decipher.update(data);
        decipher.finish();
        return decipher.output;
    }
}

/** 
 *  Main GRTC module
 */

class GRTC extends EventEmitter {
    /**
     * @param {string} uuid 
     * @param {boolean} joinee 
     * uuid is uniquely generated id for collaboration to happen
     * joinee is true if initiator else false
     */
    constructor(grtcID, url, joinee, reload) {
        super();
        let self = this;
        self.peer = null;
        self.peerSignal = null;
        self.signalInstance = null;
        self.joinee = joinee;
        self.reload = reload;
        self.url = url;
        self.grtcID = grtcID;
        self.otherPeers = new Set();
        self.listenSignalTimer = 0;
        self.listenSignalCount = 0;
        self.keys = [];
        self.init();
    }

    /**
     * Returns the stripped out queryString that is used by peers.
     */
    static queryParameter(queryString) {
        let queryIndex = queryString.indexOf('collaborate');
        return queryString.substring(queryIndex, queryIndex + 48).split('=').pop();
    }

    /**
     * Generates uuid which is used for url unique hash.
     */
    static uuid() {
        return uuidv1();
    }

    /**
     * Used for AES encryption ( symmetric ) afterwards.
     */
    static secret() {
        return btoa(crypto.forge.pkcs5.pbkdf2(uuidv4(), crypto.forge.random.getBytesSync(128), 3, 16));
    }

    /**
     * Set difference API for calculating difference. Note: setA - setB != setB - setA
     */
    setDifference(setA, setB) {
        let difference = new Set(setA);
        for (let elem of setB) {
            difference.delete(elem);
        }
        return difference;
    }

    /**  
     * Listens for signals by initiator.
     */
    listenSignal() {
        let self = this;
        self.listenSignalRoutine();
        self.listenSignalTimer = setInterval(() => {
            self.listenSignalCount++;
            self.listenSignalRoutine();
        }, 5000);
    }

    /** 
     * signal routine to continue in loop
     */
    listenSignalRoutine() {
        let self = this;
        self.signalInstance.getSignal().then((resp) => {
            self.setDifference(new Set(resp), self.otherPeers).forEach((signal) => {
                if (signal !== JSON.stringify(self.peerSignal)) {
                    self.emit('peerFound', signal);
                    self.otherPeers.add(signal);
                }
            });
        });
    }

    /**
     * Data handler for received data.
     * Monitors data received, publicKey and sharedkey for authentication.
     */
    dataHandler(data) {
        let self = this;
        let parsedData = JSON.parse(data);

        if (typeof parsedData !== 'object') { 
            return self.emit('peerData', parsedData);
        }

        if ('encrypted' in parsedData) {
            self.emit('peerEncryptedData', parsedData);
        }

        if ('publicKey' in parsedData) {
            self.emit('publicKey', parsedData['publicKey']);
        } else if ('secret' in parsedData) {
            self.emit('secret', parsedData['secret']);
        } else if ('secretAck' in parsedData) {
            self.emit('transport', parsedData);
            self.send({'secretAckConfirmed': true});
        } else if ('secretAckConfirmed' in parsedData) {
            self.emit('transport');
        }
    }

    /**
     * peerHandler returns peer and signalReceived.
     * signal received is immediate if initiator is true.
     * signal received is not present if initiator is false it waits for initiator signal.
     */
    peerHandler() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.peer = new Peer({ 
                initiator: self.joinee === true,
                trickle: false
            });

            self.peer.on('signal', (peerSignal) => {
                self.peerSignal = peerSignal;
                resolve();
            });

            self.on('peerFound', (signal) => {
                self.peer.signal(signal);
            });

            self.peer.on('signal', (data) => {
                self.emit('peerSignal', data);
            });

            self.peer.on('connect', () => {
                self.emit('peerConnected');
            });
        
            self.peer.on('data', (data) => {
                self.dataHandler(data);
            });

            /**
             * Override peer send to automatically convert json.
             */
            self.send = function(data) {
                self.peer.send(JSON.stringify(data));
            }
        });
    }

    /**
     * Generates a public/private key pair with 1024 bit RSA.
     * Send public key to other peers.
     */
    securityHandler() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.on('peerConnected', () => {
                crypto.generateKeys().then((keys) => {
                    self.keys = keys;
                    let payload = {
                        publicKey: keys['publicKey']
                    }
                    /**
                     * Send public key to initiator only.
                     */
                    if (self.joinee == false) {
                        self.send(payload);
                    }
                });
            });

            /**
             * Listened on intiator.
             */
            self.on('publicKey', (publicKey) => {
                let encryptedKey = { 'secret': crypto.encrypt(self.sharedSecret, publicKey) };
                self.send(encryptedKey);
            });

            /**
             * Listened on other peers.
             * Ack the initiator that secret is received and is converted from base64 to original string.
             */
            self.on('secret', (sharedKey) => {
                self.sharedSecret = crypto.decrypt(sharedKey, self.keys.privateKey);
                self.emit('peerSecret', self.sharedSecret);
                self.send({ 'secretAck': true });
            });
        });
    }

    /**
     * Start the transport layer using TransportLayer Class.
     */
    startTransportLayer() {
        let self = this;
        console.log('starting transport layer', self.sharedSecret);
        self.transportLayer = new TransportLayer(self.sharedSecret);
        /**
         * Create new send API
         */
        self.secureSend = function(data) {
            let newData = self.transportLayer.encrypt(JSON.stringify(data));
            self.send(newData);
        }

        self.on('peerEncryptedData', (encrypted) => {
            let decryptedData = self.transportLayer.decrypt(encrypted);
            self.emit('peerSecureData', decryptedData);
        });
    }

    /**
     * Called by contructor and main entry point of app.
     */
    init() {
        let self = this;

        /**
         * Shared secret is generated by initiator and passed to others.
         */
        if (self.joinee) {
            self.sharedSecret = GRTC.secret();
        }

        /** 
         * if not initiator start listening for signals.
         */
        if (self.joinee == false) {
            self.signalInstance = new Signal(self.url, self.grtcID, self.peerSignal);
            self.listenSignal();
        }

        /**
         * Will be resolved by initiator only.
         */
        self.peerHandler().then(() => {
            self.signalInstance = new Signal(self.url, self.grtcID, self.peerSignal);
            self.signalInstance.updateSignal().then(() => {
                self.listenSignal();
            })
        });

        self.securityHandler();
        self.on('transport', self.startTransportLayer);
    }
}

/**
 * If webrtc is not supported by browser make grtc null.
 */
if (Peer.WEBRTC_SUPPORT) {
    global.GRTC = GRTC;
} else {
    global.GRTC = null;
}