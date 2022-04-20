/*global weblog, trace, io*/
'use strict';

var configuration = {
    iceServers: [{
        urls: ["stun:stun.l.google.com:19302"]
    }]
};

//var userId = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 7);
//var serverUrl = "http://" + location.host;
var fileHash = {};
var socket = io.connect();
var peers = {};
var callbacks = {}

/*
 * Register new user id on signal server.
 * This allows other peers to find us.
 */
events.on('init', function(uid, serverUrl) {
	// register new user with signal server
    socket.emit('webrtc-register', JSON.stringify({
        "uid": uid
    }));
})


/*
 * Client to server connection request through signal server.
 */
function connect(myId, remoteId, cb) {
	callbacks[remoteId] = cb;
    socket.emit('webrtc-connection-req', JSON.stringify({
        "uid": myId,
        "ruid": remoteId
    }));
}

/*
 * Remote peer asking to open data channel through signal server.
 */
socket.on('webrtc-connection', function(data) {
    trace(`webrtc-connection> ${data}`);
    var jd = JSON.parse(data);
    var peerId = jd["uid"];
    weblog("connection request from " + peerId);
    var pc = new RTCPeerConnection(configuration);

    pc.onerror = function(error) {
        weblog(error, "error");
        trace(error);
    }

    // send any ice candidates to the other peer.
    pc.onicecandidate = function(evt) {
        // what to do with a new candidate
        if (evt.candidate) {
			trace(`icecandidate> ${evt.candidate}`);
            trace(`pc.onicecandidate: ${JSON.stringify(evt.candidate)}`);
            socket.emit("webrtc-candidate", JSON.stringify({
                "uid": userId,
                "ruid": peerId,
                "candidate": evt.candidate
            }));


			//TODO: this might not be needed check and delete!
			/*var interval = setInterval(function(){
				if(pc.currentRemoteDescription){
					var candidate = new RTCIceCandidate(evt.candidate);
					// hack around to fix ufrag errors
					evt.candidate.usernameFragment = null;
					pc.addIceCandidate(candidate).catch(logError);
					clearInterval(interval);
				}
			});*/
        }
    };

    // var the "negotiationneeded" event trigger offer generation.
    pc.onnegotiationneeded = function(evt) {
        trace(`pc.onnegotiationneeded ${evt}`);
        pc.createOffer().then(function(offer) {
                trace(`createOffer ${JSON.stringify(offer)}`);
                socket.emit('webrtc-dsp', JSON.stringify({
                    "uid": userId,
                    "ruid": peerId,
                    "webrtc": offer
                }));

                pc.setLocalDescription(offer);
            })
            .catch(logError);
    };
    // create a data channel
    var channel = pc.createDataChannel("channel" + peerId);
    trace(`data channel created with peer ${peerId}`);

    // keep track of channel and connection
    peers[peerId] = {
        "pc": pc,
        "channel": channel
    };
	// hand off communication to peers. 
    handleChannelServer(channel, peerId);
});

/*
 * Initial web socket connection.
 */
socket.on('iconnect', function() {
	trace("websocket connected.");
});

/*
 * ICE connection handshake takes sever steps. 
 * Peers exchange offers and answers of their candidate lists.
 * Candidates are endpoint connections IP and port.
 */
socket.on('webrtc-message', function(data) {
    var jd = JSON.parse(data);
    var ruid = jd.ruid;
    var message = jd.webrtc;
    var pc = null;
    if (ruid in peers) {
        pc = peers[ruid]["pc"];
    } else {
        pc = new RTCPeerConnection(configuration);
		pc.onerror = function(error) {
			weblog(error, "error");
			trace(error);
		}
        pc.ondatachannel = function(evt) {
            var channel = evt.channel;
            peers[ruid] = {
                "pc": pc,
                "channel": channel
            };
            handleChannelClient(channel, ruid);
        }
    }
    if (message.type) {
        if (message.type == "candidate") {
			// remote peer sends new ICE candidate. This get added locally to the peer description.
			var interval = setInterval(function(){
				if(pc.currentRemoteDescription){
					// deal with out of order messages.
					// first an offer needs to be received.
					var candidate = new RTCIceCandidate(message.candidate);
					pc.addIceCandidate(candidate).catch(logError);
					trace(`receiveed candidate: ${JSON.stringify(candidate)}`);
					clearInterval(interval);
				}
			}, 100);
        }
        // if we get an offer, we need to reply with an answer
        if (message.type == "offer") {
            trace(`received offer: ${JSON.stringify(message)}`);
            var descOffer = new RTCSessionDescription(message);
            pc.setRemoteDescription(descOffer).then(function() {
                    return pc.createAnswer();
                })
                .then(function(answer) {
                    socket.emit("webrtc-dsp", JSON.stringify({
                        "uid": userId,
                        "ruid": ruid,
                        "webrtc": answer
                    }));
                    trace(`sending answer: ${JSON.stringify(answer)}`);
                    return pc.setLocalDescription(answer);
                })
                .then(function() {
                    pc.onicecandidate = function(evt) {
                        if (evt.candidate) {
                            trace(`pc.onicecandidate: ${JSON.stringify(evt.candidate)}`);
                            var candidate = new RTCIceCandidate(evt.candidate);
                            pc.addIceCandidate(candidate);
                            socket.emit("webrtc-candidate", JSON.stringify({
                                "uid": userId,
                                "ruid": ruid,
                                "candidate": evt.candidate
                            }));
                        }
                    }
                })
                .catch(logError);
        }
        if (message.type == "answer") {
            var descAnswer = new RTCSessionDescription(message);
            pc.setRemoteDescription(descAnswer).catch(logError);
        }
    }
});

/*
 * Peer to peer communication, server not involved from here on.
 * After handshake a channel is opened directly between peers.
 * We use this channel to transfer a file.
 */
function handleChannelServer(channel, peerId) {
    channel.onopen = function() {
        weblog("webrtc channel open to " + peerId);
    };

    channel.onerror = function(error) {
        weblog(error, "error");
    };

	// peer to peer message types: file-list and file-request.
    channel.onmessage = function(evt) {
        var msg = JSON.parse(evt.data);
        trace(`channel message: ${JSON.stringify(msg)}`);
        switch (msg.type) {
            case "file-list":
                var fileList = {};
                Object.keys(fileHash).forEach(function(key) {
                    fileList[key] = {
						size: fileHash[key].size,
						name: key
					}
                });
                weblog("file list requested by " + peerId);
                channel.send(JSON.stringify({
                    "uid": userId,
                    "type": "file-list-rep",
                    "data": fileList
                }));
                break;
            case "file-request":
                weblog("sending file " + msg["file-name"] + " to " + peerId);
                sendData(msg["file-name"], channel);
                break;
        }
    };
}

/*
 * Helper function to get file size.
 */
function getSizeUnits(size) {
		var units = null;
		var s = size;
		if (s < 1024) {
			units = 'B'
		}
		if ((s < 1024*1024) && (!units)){
			s = Math.round(s /1024)
			units = 'KB'
		}
		if ((s < 1024*1024*1024) && (!units)) {
			s = Math.round(s /(1024*1024))
			units = 'MB'
		}
		if ((s < 1024*1024*1024*1024) && (!units)) {
			s = Math.round(s /(1024*1024*1024))
			units = 'GB'
		}

	return {
		size: s,
		units: units
	}
}

/*
 * Handle client side logic.
 */
function handleChannelClient(channel, ruid) {
    var receiveBuffer = [];
    var receivedSize = 0;
    var file = null;

    channel.onopen = function() {
        trace(`channel open with peer: ${ruid}`);
		//var cb = callbacks[remote_peer_id];
		var cb = callbacks[ruid];
		if (cb) {
			cb();
		}
		// request file-list from server peer.
        channel.send(JSON.stringify({
            "uid": userId,
            "type": "file-list"
        }));
    };

    channel.onmessage = function(evt) {
        var msg;
        if (file) {
			var fileIdHash = encodeURIComponent(file.name).hashCode();
            var d = evt.data;
            receiveBuffer.push(d);
            if ($.browser.webkit) {
                receivedSize += d.byteLength;
            } else {
                receivedSize += d.size;
            }
			trace(`downloading: ${encodeURIComponent(file.name)} idHash: ${fileIdHash}.`);
			events.emit('fileDownloadProgress', fileIdHash, receivedSize, file.size);
            if (receivedSize === file.size) {
                var received = new window.Blob(receiveBuffer, {
                    type: file.type
                });
                var href = URL.createObjectURL(received)
				events.emit('fileDownload', fileIdHash, file.name, href);
                receiveBuffer = [];
                receivedSize = 0;
                file = null;
				receiveFile = false;
				// download next in queue
				var next = queue.pop();
				if (next) {
					trace(`next: ${next.t.id}`);
					requestFile(next.t, next.id);
				}
				
            }
        } else {
            msg = JSON.parse(evt.data);
            switch (msg.type) {
                case "file-list-rep":
					events.emit('fileListReceived', msg.uid, msg.data);
                    break;
                case "file-rep":
                    file = msg.data;
                    trace(JSON.stringify(file));
                    break;


            }
        }
    };
}


/*
 * Request a file from peer.
 */
var progress = {};
var receiveFile = false;
var queue = [];
function requestFile(t, peerId) {
	if (progress[t.id]) return;

	// only download one at a time. Queue other requests.
	if (receiveFile) {
        var progressText = "#PROG" + t.id.hashCode() + "TEXT";
		queue.push({t: t, id: peerId});
		trace(`queued file  ${t.id}`);
        $(progressText).attr('data-label', "Queued")
		return;
	}

    var fileName = t.id;
	progress[t.id] = true;
	receiveFile = true;
    var channel = peers[peerId]["channel"];

    channel.send(JSON.stringify({
        "uid": userId,
        "type": "file-request",
        "file-name": fileName
    }));
}

/*
 * Send file data over webrtc channel.
 */
function sendData(fileName, channel) {
    var file = fileHash[fileName];
    trace(`file is ${[file.name, file.size, file.type, file.lastModifiedDate].join(' ')}`);
    channel.send(JSON.stringify({
        "uid": userId,
        "type": "file-rep",
        "data": {
            "name": file.name,
            "size": file.size,
            "type": file.type
        }
    }));
	// send chunks of data.
    var chunkSize = 16384;
    var sliceFile = function(offset) {
        var reader = new window.FileReader();
        reader.onload = (function() {
            return function(e) {
                channel.send(e.target.result);
				var progress = offset + e.target.result.byteLength;
				var percentage = Math.round( (progress * 100) / file.size);
				weblog(percentage + "% " + file.name +" sent " + Math.round(progress/1024) + "KB of " + Math.round(file.size/1024) +"KB");
                if (file.size > offset + e.target.result.byteLength) {
                    window.setTimeout(sliceFile, 0, offset + chunkSize);
                }
            };
        })(file);
		// calculate file slice to read.
        var slice = file.slice(offset, offset + chunkSize);
		// read file chunk. Triggers reader.onload event with the actual file data.
        reader.readAsArrayBuffer(slice);
    };
	// start reading a file at offset 0
    sliceFile(0);
}

/*
 * Error logging wrapper
 */
function logError(error) {
    weblog(error.message, "error");
	throw new Error(error);
}

/*
 * Add files
 */
events.on('addedFiles', function(files) {
	files.forEach(function(f) {
		fileHash[escape(f.name)] = f;
		weblog(`added file: ${escape(f.name)}.`);
	})
})
