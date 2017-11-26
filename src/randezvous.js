// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

const common = require('./common');
const websocket = require('socket.io');
const cron = require('node-schedule');
const events = require('events');
const querystring = require('querystring');
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

/**
 * run once a day at 2:17am
 *
 */
cron.scheduleJob('17 2 * * *', function(){
	getData(common.details);
});
getData(common.details);

module.exports.startWebSocket = function(server) {
	const io = websocket.listen(server);
	io.on('connection', startSocketEvents);
};

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
    socket.emit('connect', null);	

	socket.on('webrtc-register', function(data){
		const jd = JSON.parse(data);
		const uid = jd["uid"];
		socks[uid] = socket;
		timers[uid] = new Date().getTime();
		//console.log(uid+" registerd.");
	});
	
	socket.on('webrtc-connection-req', function(data){
		//console.log(data)
		const jd = JSON.parse(data);
		const uid = jd["uid"];
		socks[uid] = socket;
		timers[uid] = new Date().getTime();
		//console.log(uid+" registerd.");
		
		if(jd.ruid in socks){
		  const s = socks[jd.ruid];
		  s.emit("webrtc-connection", data);
		}
		
	});

    socket.on('details-req', function(data){
        //console.log("details req");
		if(details != null)	socket.emit('details-res', JSON.stringify(details));
	});

	socket.on('webrtc-candidate', function(data){
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
		//console.log(JSON.stringify(data));
		const jd = JSON.parse(data);
		const uid = jd["uid"];
		const ruid = jd["ruid"];
		const dsp = jd["webrtc"];
		//dsps[uid] = dsp;
		//socks[uid] = socket;
		//console.log(ruid);
		if(ruid in socks){
		  const s = socks[ruid];
		  s.emit('webrtc-message', JSON.stringify({"uid" : ruid, "ruid": uid, "webrtc" : dsp}));
		}
	});
	
	socket.on('get-offer', function(data){
	        const jd = JSON.parse(data);
		const ruid = jd["ruid"];	
		if(ruid in dsps){
			socket.emit('webrtc-message', JSON.stringify(dsps[ruid]));
			//console.log(JSON.stringify(dsps[ruid]));
		}
		if(ruid in candidates){
			candidates[ruid].forEach( function(val, index, array) {
				if(val){
					socket.emit('webrtc-message', JSON.stringify(val));
					//console.log("CAND: "+JSON.stringify(val));
				}
			});	
		}
		//console.log(JSON.stringify(data));
		
	});
	/*socket.on("answer", function(data){
		console.log("ANSWER: "+JSON.stringify(data));
		const jd = JSON.parse(data);
		const ruid = jd["ruid"];
		const dsp = jd["webrtc"];
		const s = socks[ruid];
		s.emit("webrtc-message", JSON.stringify(dsp));
		
	});*/
}

function getData(postDetails){
		if(postDetails.host == null){
			return null;
		}
		//console.log(JSON.stringify(postDetails));
        
		const data = querystring.stringify(postDetails.data);

        const options = {
                host: postDetails.host,
                port: postDetails.port,
                path: postDetails.path,
                method: 'POST',
                headers: {
                        'User-Agent': postDetails.useragent,
                        'origin' : postDetails.origin,
                        'Referer' : postDetails.referer,
                        'DNT' : postDetails.dnt,
                        'Accept' : postDetails.accept,
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(data)
                }
        }

        const req = https.request(options, function(res) {
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
 						//console.log(chunk);
                        const jd = JSON.parse(chunk);
                        details = jd;
                });
        });

        req.write(data);
        req.end();
}








