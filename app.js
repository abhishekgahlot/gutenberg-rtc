'use strict';

const Peer = require( 'simple-peer' );
const uuidv1 = require( 'uuid/v1' );
const uuidv4 = require( 'uuid/v4' );
const EventEmitter = require( 'events' ).EventEmitter;

const crypto = require( './crypto' );

/**
 * Signal class that uses promise not event emitters and can be used standalone.
 * getSignal and updateSignal lets you update and fetch data regarding the shared key.
 */
class Signal {
	/**
	 * @param {string} url url to which signal should go.
	 * @param {string} grtcID global id shared by url
	 * @param {string} peerID global peerID that maps to username.
	 * @param {string} peerName global username that maps to peerID.
	 * @param {object} signalID signal generated by peer
	 * url is base url of page.
	 * grtcID is collaborate param from url.
	 * paramID is changing peerID on refresh or every new grtc instance.
	 * signalID is peer signal used to traverse and connect P2P.
	 */
	constructor( url, grtcID, peerID, peerName, signalID ) {
		const self = this;
		self.url = url;
		self.grtcID = grtcID;
		self.peerID = peerID;
		self.signalID = signalID;
		self.peerName = peerName;
	}

	/**
	 * Clear the key forcefully in kv.
	 * @return {promise} promise object
	 */
	clearSignal() {
		const self = this;
		return new Promise( ( resolve, reject ) => {
			const data = { peerID: self.peerID, peerName: self.peerName, type: 'initial', signal: self.signalID };
			jQuery.post( self.url + '/remove', { [ self.grtcID ]: window.btoa( JSON.stringify( data ) ) }, ( resp ) => {
				resolve( resp );
			} ).fail( ( e ) => {
				reject( e );
			} );
		} );
	}

	/**
	 * getSignal is called periodically in order to fetch the updated signal.
	 * @return {promise} promise object
	 */
	getSignal() {
		const self = this;
		return new Promise( ( resolve, reject ) => {
			jQuery.get( self.url + '/get/' + self.grtcID, ( resp ) => {
				resolve( resp );
			} ).fail( ( e ) => {
				reject( e );
			} );
		} );
	}

	/**
	 * Updates the server route so that peers can get the data.
	 * @return {promise} promise object
	 */
	updateSignal() {
		const self = this;
		return new Promise( ( resolve, reject ) => {
			const data = {
				peerID: self.peerID,
				signal: self.signalID,
				peerName: self.peerName,
				type: 'register',
			};
			jQuery.post( self.url + '/set', { [ self.grtcID ]: window.btoa( JSON.stringify( data ) ) }, ( resp ) => {
				resolve( resp );
			} ).fail( ( e) => {
				reject( e );
			} );
		} );
	}
}

/**
 * TransportLayer use a single key and provide the abstractions
 * to send data encrypted and receieve decrypted data using the key.
 */
class TransportLayer {
	constructor( key ) {
		const self = this;
		try {
			self.key = window.atob( key.replace( /\0/g, '' ) ); // remove null chars.
		} catch ( e ) {
			self.key = key;
		}
	}

	/**
	 * @param {string} data raw data
	 * encrypts using created key with pkcs5 module.
	 */
	encrypt( data ) {
		const iv = crypto.forge.random.getBytesSync( 16 );
		const cipher = crypto.forge.cipher.createCipher( 'AES-CBC', this.key );

		cipher.start( { iv } );
		cipher.update( crypto.forge.util.createBuffer( data ) );
		cipher.finish();

		const encrypted = cipher.output;
		const obj = { iv: crypto.forge.util.bytesToHex( iv ), encrypted: crypto.forge.util.bytesToHex( encrypted ) };

		return obj;
	}

	/**
	 * @param {string} encrypted data for decryption
	 * @return {string} decrypted data.
	 * decrypts using object which has IV.
	 */
	decrypt( encrypted ) {
		const iv = crypto.forge.util.createBuffer();
		const data = crypto.forge.util.createBuffer();
		iv.putBytes( crypto.forge.util.hexToBytes( encrypted.iv ) );
		data.putBytes( crypto.forge.util.hexToBytes( encrypted.encrypted ) );

		const decipher = crypto.forge.cipher.createDecipher( 'AES-CBC', this.key );
		decipher.start( { iv } );
		decipher.update( data );
		decipher.finish();
		return decipher.output;
	}
}

/**
 *  Main GRTC module
 */

class GRTC extends EventEmitter {
	/**
	 * @param {string} grtcID global id representing document.
	 * @param {string} url url of signal routes.
	 * @param {string} peerName name of user/ wordpress username.
	 * @param {bool} useTransport default false for encrypted session.
	 * uuid is uniquely generated id for collaboration to happen
	 */
	constructor( grtcID, url, peerName, useTransport ) {
		super();
		const self = this;
		self.peer = null;
		self.peerSignal = null;
		self.signalInstance = null;
		self.url = url;
		self.grtcID = grtcID;
		self.peerID = GRTC.uuid();
		self.peerName = peerName;
		self.otherPeers = new Set();
		self.listenSignalTimer = 0;
		self.listenSignalCount = 0;
		self.isConnected = false;
		self.keys = [];
		self.useTransport = useTransport;
		self.init();
	}

	/**
	 * @param {string} queryString parsed from url.
	 * @return {string} uuid from url.
	 * Returns the stripped out queryString that is used by peers.
	 */
	static queryParameter( queryString ) {
		const queryIndex = queryString.indexOf( 'collaborate' );
		return queryString.substring( queryIndex, queryIndex + 48 ).split( '=' ).pop();
	}

	/**
	 * Random color generate for peer.
	 * @return {string} random color.
	 */
	static randomColor() {
		const letters = '0123456789ABCDEF';
		let color = '#';
		for ( let i = 0; i < 6; i++ ) {
			color += letters[ Math.floor( Math.random() * 16 ) ];
		}
		return color;
	}

	/**
	 * Generates uuid which is used for url unique hash.
	 * @return {string} uuid.
	 */
	static uuid() {
		return uuidv1();
	}

	/**
	 * Used for AES encryption ( symmetric ) afterwards.
	 * @return {string} aes key base64 converted.
	 */
	static secret() {
		return window.btoa( crypto.forge.pkcs5.pbkdf2( uuidv4(), crypto.forge.random.getBytesSync( 128 ), 3, 16 ) );
	}

	/**
	 * Set difference API for calculating difference. Note: setA - setB != setB - setA
	 * @param {set} setA first set
	 * @param {set} setB second set
	 * @return {set} difference of two sets
	 */
	setDifference( setA, setB ) {
		const difference = new Set( setA );
		for ( const elem of setB ) {
			difference.delete( elem );
		}
		return difference;
	}

	/**
	 * Check if you are initiator or not.
	 */
	isInitiator() {
		const self = this;
		const data = { peerID: self.peerID, type: 'initial', peerName: self.peerName };
		jQuery.post( self.url + '/set', { [ self.grtcID ] : window.btoa( JSON.stringify( data ) ) }, ( resp ) => {
			self.emit( 'initiator', resp );
		} ).fail( () => {
			self.emit( 'initiator', false );
		} );
	}

	/**
	 * Listens for signals after finding initiator.
	 */
	listenSignal() {
		const self = this;
		self.listenSignalRoutine();
		self.listenSignalTimer = setInterval( () => {
			self.listenSignalCount++;
			self.listenSignalRoutine();
		}, 3000 );
	}

	/**
	 * signal routine to continue in loop
	 */
	listenSignalRoutine() {
		const self = this;
		self.signalInstance.getSignal().then( ( resp ) => {
			resp.forEach( ( peer ) => {
				if ( peer.peerID !== self.peerID && ! self.otherPeers.has( peer.peerID ) && peer.signal ) {
					self.otherPeers.add( peer.peerID );
					self.emit( 'peerFound', peer );
				}
			} );
		} );
	}

	/**
	 * Data handler for received data.
	 * Monitors data received, publicKey and sharedkey for authentication.
	 * @param {string} data encrypted data from channel.
	 */
	dataHandler( data ) {
		const self = this;
		const parsedData = JSON.parse( data );

		if ( typeof parsedData !== 'object' ) { 
			self.emit( 'peerData', parsedData );
			return;
		}

		if ( 'encrypted' in parsedData ) {
			self.emit( 'peerEncryptedData', parsedData );
		}

		if ( 'publicKey' in parsedData ) {
			self.emit( 'publicKey', parsedData.publicKey );
		} else if ( 'secret' in parsedData ) {
			self.emit( 'secret', parsedData.secret );
		} else if ( 'secretAck' in parsedData ) {
			self.emit( 'transport', parsedData );
			self.send( { secretAckConfirmed: true } );
		} else if ( 'secretAckConfirmed' in parsedData ) {
			self.emit( 'transport' );
		} else {
			self.emit( 'peerData', parsedData );
		}
	}

	/**
	 * peerHandler returns peer and signalReceived.
	 * signal received is immediate if initiator is true.
	 * signal received is not present if initiator is false it waits for initiator signal.
	 * @return {promise} promise object
	 */
	peerHandler() {
		const self = this;
		return new Promise( ( resolve, reject ) => {
			self.peer = new Peer( { 
				initiator: self.initiator === true,
				trickle: false,
			} );

			self.peer.on( 'signal', ( peerSignal ) => {
				self.peerSignal = peerSignal;
				resolve(); 
			} );

			self.on( 'peerFound', ( peer ) => {
				self.peer.signal( peer.signal );
			} );

			self.peer.on( 'signal', ( data ) => {
				self.emit( 'peerSignal', data );
			} );

			self.peer.on( 'connect', () => {
				self.emit( 'peerConnected' );
				self.isConnected = true;
			} );

			self.peer.on( 'data', ( data ) => {
				self.dataHandler( data );
			} );

			self.peer.on( 'close', ( peer ) => {
				self.isConnected = false;
				self.emit( 'peerClosed', peer );
				clearInterval( self.listenSignalTimer );
				delete self._events.initiator;
				delete self._events.peerFound;
				self.init();
			} );

			/**
			 * Override peer send to automatically convert json.
			 * @param {string} data json wrapper
			 */
			self.send = function( data ) {
				self.peer.send( JSON.stringify( data ) );
			};
		} );
	}

	/**
	 * Generates a public/private key pair with 1024 bit RSA.
	 * Send public key to other peers.
	 */
	securityHandler() {
		const self = this;
		self.on( 'peerConnected', () => {
			crypto.generateKeys().then( ( keys ) => {
				self.keys = keys;
				const payload = {
					publicKey: keys.publicKey,
				};
				/**
				 * Send public key to initiator only.
				 */
				if ( self.initiator === false ) {
					self.send( payload );
				}
			} );
		} );

		/**
		 * Listened on intiator.
		 */
		self.on( 'publicKey', ( publicKey ) => {
			const encryptedKey = { secret: crypto.encrypt( self.sharedSecret, publicKey ) };
			self.send( encryptedKey );
		} );

		/**
		 * Listened on other peers.
		 * Ack the initiator that secret is received and is converted from base64 to original string.
		 */
		self.on( 'secret', ( sharedKey ) => {
			self.sharedSecret = crypto.decrypt( sharedKey, self.keys.privateKey );
			self.emit( 'peerSecret', self.sharedSecret );
			self.send( { secretAck: true } );
		} );
	}

	/**
	 * Start the transport layer using TransportLayer Class.
	 */
	startTransportLayer() {
		const self = this;
		self.transportLayer = new TransportLayer( self.sharedSecret );

		/**
		 * Create new send API.
		 * @param {string} data decrypted data
		 */
		self.secureSend = function( data ) {
			const newData = self.transportLayer.encrypt( JSON.stringify( data ) );
			self.send( newData );
		};

		/**
		 * Listen of data received which is encrypted.
		 */
		self.on( 'peerEncryptedData', ( encrypted ) => {
			const decryptedData = self.transportLayer.decrypt( encrypted );
			self.emit( 'peerSecureData', decryptedData );
		} );
	}

	/**
	 * Called by contructor and main entry point of app.
	 */
	init() {
		const self = this;
		self.isInitiator();

		/**
		 * Server decides if you get to initiate or not.
		 * Because of persistance independent of peers.
		 */
		self.on( 'initiator', ( resp ) => {
			/**
			 * Shared secret is generated by initiator and passed to others.
			 * else if not initiator start listening for signals.
			 */
			self.initiator = resp.initiator;
			if ( self.initiator ) {
				self.sharedSecret = GRTC.secret();
			} else {
				self.signalInstance = new Signal( self.url, self.grtcID, self.peerID, self.peerName, self.peerSignal );
				self.listenSignal();
			}

			/**
			 * Will be resolved after initiator is set only.
			 */
			self.peerHandler().then( () => {
				self.signalInstance = new Signal( self.url, self.grtcID, self.peerID, self.peerName, self.peerSignal );
				self.signalInstance.updateSignal().then( () => {
					self.listenSignal();
				} );
			} );
		} );

		/**
		 * Use transport layer for more security.
		 * Default is false.
		 */
		if ( self.useTransport ) {
			self.securityHandler();
			self.on( 'transport', self.startTransportLayer );
		}
	}
}

module.exports = { GRTC };
