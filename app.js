'use strict';

const Peer = require('simple-peer');
const uuidv1 = require('uuid/v1');
const uuidv4 = require('uuid/v4');

const crypto = require('./crypto');

class Signal {
    constructor() {
        
    }
}

class GRTC {
	constructor(uuid, joinee) {
        this.peer = null;
        this.signal = null;
        this.joinee = joinee;
        this.init();
    }

    static queryParameter(queryString) {
        let queryIndex = queryString.indexOf('collaborate');
        return queryString.substring(queryIndex, queryIndex + 48).split('=').pop();
    }

    static uuid() {
        return uuidv1();
    }

    static secret() {
        return uuidv4();
    }

    peerHandler() {
        this.peer = new Peer({ 
            initiator: this.joinee === true,
            trickle: false
        });
        this.peer.on('signal', (receivedSignal) => {
            this.signal = receivedSignal;
        });
    }

    securityHandler() {
        return new Promise((resolve, reject) => {
            crypto.generateKeys()
            .then((keys) => {
                this.publicKey = keys['publicKey'];
                this.privateKey = keys['privateKey'];
                resolve(true);
            })
            .catch(reject);
        });
    }

    init() {
        this.peerHandler();
        this.securityHandler().then(() => {
            console.log(this.publicKey, this.privateKey);
        }).catch((e) => {

        });
    }
}


if (Peer.WEBRTC_SUPPORT) {
    global.GRTC = GRTC;
} else {
    global.GRTC = null;
}