'use strict';

const Peer = require('simple-peer');
const uuidv1 = require('uuid/v1');


class GRTC {
	constructor() {
		this.uuid = uuidv1();
	}
}

module.exports = GRTC;