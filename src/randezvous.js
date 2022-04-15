"use strict";

const websocket = require('socket.io');
const cron = require('node-schedule');
const events = require('events');
const https = require('https');

/**
 * global variables
 */
let  details = null;
const ev = new events.EventEmitter();
// track ICE DSP offers/answers
const dsps = {}
// track ICE candidates
const candidates = {}
// track websocket open sockets
const socks = {};
const timers = {};
// 1 hr cache time;
const maxCacheTime = 3600000; 

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

	socket.on('webrtc-register', function(data){
		console.log('webrtc-register> ', data)
		const jd = JSON.parse(data);
		const uid = jd["uid"];
		socks[uid] = socket;
		timers[uid] = new Date().getTime();
	});
	
	socket.on('webrtc-connection-req', function(data){
		console.log('webrtc-connection-req> ', data)
		const jd = JSON.parse(data);
		const uid = jd["uid"];
		socks[uid] = socket;
		timers[uid] = new Date().getTime();
		
		if(jd.ruid in socks){
		  const s = socks[jd.ruid];
		  s.emit("webrtc-connection", data);
		}
		
	});

    socket.on('details-req', function(data){
		console.log('details-req> ', data)
		if(details != null)	socket.emit('details-res', JSON.stringify(details));
	});

	socket.on('webrtc-candidate', function(data){
		console.log('webrtc-candidate> ', data)
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
		}
	});

	socket.on('webrtc-dsp', function(data){
		console.log('webrtc-dsp> ', data)
		const jd = JSON.parse(data);
		const uid = jd["uid"];
		const ruid = jd["ruid"];
		const dsp = jd["webrtc"];
		if(ruid in socks){
		  const s = socks[ruid];
		  s.emit('webrtc-message', JSON.stringify({"uid" : ruid, "ruid": uid, "webrtc" : dsp}));
		}
	});
	
	socket.on('get-offer', function(data){
		console.log('get-offer> ', data)
	    const jd = JSON.parse(data);
		const ruid = jd["ruid"];	
		if(ruid in dsps){
			socket.emit('webrtc-message', JSON.stringify(dsps[ruid]));
		}
		if(ruid in candidates){
			candidates[ruid].forEach( function(val, index, array) {
				if(val){
					socket.emit('webrtc-message', JSON.stringify(val));
				}
			});	
		}
		
	});
}
