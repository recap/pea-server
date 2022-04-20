"use strict";

const websocket = require('socket.io');

/**
 * global variables
 */
// track websocket open sockets
const socks = {};
const timers = {};
// 1 hr cache time;
const maxCacheTime = 3700000; 

module.exports.startWebSocket = function(server) {
	const io = websocket(server);
	io.on('connection', startSocketEvents);
};


/**
 * internal house keeping. keep minimum state as possible.
 */
setInterval(() => {
	const t2 = new Date().getTime();
	const purgeIds = [];
	Object.keys(timers).forEach((id) => {
		const t1 = timers[id];
		if (t2 - t1 > maxCacheTime) {
			purgeIds.push(id);	
		}
	});
	purgeIds.forEach((id) => {
		if (socks[id]) {
			delete socks[id];
		}
		if (timers[id]) {
			delete timers[id];
		}
	});
}, 10000);

/**
 * handle communication events between server and browser
 */
function startSocketEvents(socket) {
	console.log("starting websocket.");
    socket.emit('iconnect', null);	

	// new browser client registers uid
	socket.on('webrtc-register', function(data){
		console.log('webrtc-register> ', data)
		try {
			const jd = JSON.parse(data);
			const uid = jd["uid"];
			socks[uid] = socket;
			timers[uid] = new Date().getTime();
		} catch(err) {
			console.log('error> ', err);
			socket.emit('error', err);
		}
	});
	
	// initialize a peer 2 peer request to exchange 
	// endpoints between peers.
	socket.on('webrtc-connection-req', function(data){
		console.log('webrtc-connection-req> ', data)
		try{
			const jd = JSON.parse(data);
			const uid = jd["uid"];
			socks[uid] = socket;
			timers[uid] = new Date().getTime();
		
			// check if remote peer has an open web socket with server.
			if(jd.ruid in socks){
				const s = socks[jd.ruid];
				s.emit("webrtc-connection", data);
			} else {
				throw new Error(`Peer ${jd.ruid} not found!`);
			}
		} catch(err) {
			console.log('error> ', err);
			socket.emit('error', err);
		}
		
	});

	// peer sends updated local endpoints (ip, port)
	// to be sent to other peers 
	socket.on('webrtc-candidate', function(data){
		console.log('webrtc-candidate> ', data)
		try{
			const jd = JSON.parse(data);
			const uid = jd["uid"]
			const ruid = jd["ruid"];
			const cand = jd["candidate"];
			if (ruid in socks) {
				const s = socks[ruid];
				s.emit("webrtc-message", JSON.stringify({
					"uid": ruid,
					"ruid": uid,
					"webrtc": {
						"type" : "candidate",
						"candidate": cand
					}
				}));
			} else {
				throw new Error(`Peer ${ruid} not found!`);
			}
		} catch(err) {
			console.log('error> ', err);
			socket.emit('error', err);
		}
	});

	// peer sends offer (list of endpoints) and send it to 
	// remote peer
	socket.on('webrtc-dsp', function(data){
		console.log('webrtc-dsp> ', data)
		try{
			const jd = JSON.parse(data);
			const uid = jd["uid"];
			const ruid = jd["ruid"];
			const dsp = jd["webrtc"];
			if(ruid in socks){
				const s = socks[ruid];
				s.emit('webrtc-message', JSON.stringify({"uid" : ruid, "ruid": uid, "webrtc" : dsp}));
			} else {
				throw new Error(`Peer ${ruid} not found!`);
			}
		} catch(err) {
			console.log('error> ', err);
			socket.emit('error', err);
		}
	});
	
	// TODO delete
	/*socket.on('get-offer', function(data){
		console.log('get-offer> ', data)
		try{
			const jd = JSON.parse(data);
			const ruid = jd["ruid"];	
			if(ruid in dsps){
				socket.emit('webrtc-message', JSON.stringify(dsps[ruid]));
			}
			if(ruid in candidates){
				candidates[ruid].forEach( function(val) {
					if(val){
						socket.emit('webrtc-message', JSON.stringify(val));
					}
				});	
			}
		} catch(err) {
			console.log('error> ', err);
			socket.emit('error', err);
		}
		
	});*/
}
