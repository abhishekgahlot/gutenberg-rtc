# Gutenberg Collaborative Editing Plugin
## Based on WebRTC
---

### Installation
```
npm install
```


### Building
```
npm run build
```

### Local Server
```
npm start
```


### Testing
```
npm test
```

---

### Starting App
**Peer starting collaboration has to generate a uuid using**
```
var grtcID = GRTC.uuid(); // static function
```

**After that pass that to GRTC module**

```
// window.history.pushState('', '', '?collaborate=' + grtcID); // optional to add to url so can share with others.
var grtc = new GRTC(grtcID, window.location.origin,  true);
```

**Peer not starting collaboration has to join and get that grtcID somehow possibly by sharing url**

___

## API

**Events**

* 'peerFound'
* Checked via long polling to /get/grtcID route to server
```
grtc.on('peerFound', function(peer){
  // peer => peer signal used for connection establishment
});
```

* 'peerSignal'
* Received from other peer as offer.
```
grtc.on('peerSignal', function(signal){
  // signal => signal that is received from another peer.
});
```

* 'peerConnected'
* Emitted after peerSignal and connection is established. 
```
grtc.on('peerConnected', function(){
  // peer is connected.
});
```

* 'peerData'
* when data is received. 
```
grtc.on('peerData', function(data){
  //data is always json stringified
});
```

**Miscellaneous Events**
* 'publicKey'
* when other peer publicKey is fetched. 
```
grtc.on('publicKey', function(pubKey){
  //pubKey => encrypt shared token using this and send that to peer.
});
```


## Data Format

**Payload should always be JSON object which can be sent directly using grtc.send without stringify**


