'use strict';

const Peer = require('simple-peer');
const uuidv1 = require('uuid/v1');


class GRTC {
	constructor(uuid, joinee) {
        this.peer = null;
        this.signal = null;
        this.joinee = joinee;
        this.start();
    }

    static uuid() {
        return uuidv1()
    }

    peerHandler() {
        this.peer.on('signal', (signal) => {
            this.signal = signal;
        });
    }

    start() {
        let peerInterface = new Peer({ 
            initiator: this.joinee === true,
            trickle: false
        });
        this.peer = peerInterface;
        this.peerHandler();
    }

    send(data) {
        this.peer.send(data);
    }
}


if (Peer.WEBRTC_SUPPORT) {
    global.GRTC = GRTC;
} else {
    global.GRTC = null;
}