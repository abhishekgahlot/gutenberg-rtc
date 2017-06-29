'use strict';

const Peer = require('simple-peer');
const uuidv1 = require('uuid/v1');
const uuidv4 = require('uuid/v4');

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
        this.url = url;
        this.grtcID = grtcID;
        this.signalID = signalID;
    }

    /**
     * getSignal is called periodically in order to fetch the updated signal.
     */
    getSignal() {
        return new Promise((resolve, reject) => {
            
        });
    }

    /**
     * Updates the server route so that peers can get the data.
     */
    updateSignal() {
        return new Promise((resolve, reject) => {
            $.get(this.url + '/set/' + this.grtcID + '/' + this.signalID, (resp) => {
                resolve(resp);
            }).fail((e) => {
                reject(e);
            });
        });
    }
}

class GRTC {
    /**
     * @param {string} uuid 
     * @param {boolean} joinee 
     * uuid is uniquely generated id for collaboration to happen
     * joinee is true if initiator else false
     */
	constructor(uuid, joinee) {
        this.peer = null;
        this.signal = null;
        this.joinee = joinee;
        this.init();
    }

    /**
     * returns the stripped out queryString that is used by peers.
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
        return uuidv4();
    }

    /**
     * peerHandler returns peer and signalReceived.
     * signal received is immediate if initiator is true.
     * signal received is not present if initiator is false it waits for initiator signal.
     */
    peerHandler() {
        return new Promise((resolve, reject) => {
            let peer = new Peer({ 
                initiator: this.joinee === true,
                trickle: false
            });
            peer.on('signal', (receivedSignal) => {
                resolve([peer, receivedSignal]);
            });
        });
    }

    /**
     * Generates a public/private key pair with 1024 bit RSA.
     */
    securityHandler() {
        return crypto.generateKeys();
    }

    /**
     * Called by contructor and main entry point of app.
     */
    init() {
        this.peerHandler().then(([peer, signal]) => {
            console.log(peer, signal);
        });
        this.securityHandler().then((keys) => {
            console.log(keys);
        }).catch((e) => {

        });
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