'use strict';

const Peer = require('simple-peer');
const uuidv1 = require('uuid/v1');

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

    peerHandler() {
        this.peer = new Peer({ 
            initiator: this.joinee === true,
            trickle: false
        });
        this.peer.on('signal', (receivedSignal) => {
            this.signal = receivedSignal;
        });
    }

    init() {
        this.peerHandler();
    }
}


if (Peer.WEBRTC_SUPPORT) {
    global.GRTC = GRTC;
} else {
    global.GRTC = null;
}