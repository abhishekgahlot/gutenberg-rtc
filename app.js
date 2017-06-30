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
    static clearSignal(key) {
        return new Promise((resolve, reject) => {

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
 *  Main GRTC module
 */

class GRTC extends EventEmitter {
    /**
     * @param {string} uuid 
     * @param {boolean} joinee 
     * uuid is uniquely generated id for collaboration to happen
     * joinee is true if initiator else false
     */
	constructor(grtcID, url, joinee) {
        super();
        let self = this;
        self.peer = null;
        self.peerSignal = null;
        self.signalInstance = null;
        self.joinee = joinee;
        self.url = url;
        self.grtcID = grtcID;
        self.otherPeers = new Set();
        self.listenSignalTimer = 0;
        self.listenSignalCount = 0;
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
        return uuidv4();
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
     * Generates a public/private key pair with 1024 bit RSA.
     */
    securityHandler() {
        return crypto.generateKeys();
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
            self.setDifference(new Set(resp), self.otherPeers).forEach((element) => {
                if (element !== JSON.stringify(self.peerSignal)) {
                    self.emit('peerFound', element);
                    self.otherPeers.add(element);
                }
            });
        });
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
        });
    }

    /**
     * Called by contructor and main entry point of app.
     */
    init() {
        let self = this;

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
            self.signalInstance.updateSignal();
            self.listenSignal();
        });

        /**
         * Generate public/private key pair for sharing secret key to peers.
         */
        self.securityHandler().then((keys) => {
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