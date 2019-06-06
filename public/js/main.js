'use strict';

var receivedSize = 0;
var bytesToSend = 0;
var configuration = {
    iceServers: [{
        urls: ["stun:stun.l.google.com:19302"]
    }]
};

var userId = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 7);
var serverUrl = "http://" + location.host;
var fileHash = {};
var socket = io.connect();
var pc = null;
var peers = {};

function init() {
    $('#id').val(userId);
    $('#start').attr('disabled', true);
	$('#log').toggle();
	listen();
}

function listen(url) {
    if (!(url)) {
        url = serverUrl
    }
    // register socket on signal server
    socket.emit('webrtc-register', JSON.stringify({
        "uid": userId
    }));
    weblog("started file server at " + serverUrl + "/" + userId);
    //$("#url").html("<a href=" + serverUrl + "/" + userId + " target=_blank>" + serverUrl + "/" + userId + "</a>");
	$("#url").html("<p>" + serverUrl + '/' +userId + "</p>");
    $('#id').attr('disabled', true);
    $('#start').attr('disabled', true);
	$('#qrcode').qrcode(serverUrl + '/' + userId);
}

function connect(uid) {
    // get offer from remote peer with uid
    socket.emit('webrtc-connection-req', JSON.stringify({
        "uid": userId,
        "ruid": uid
    }));
}

// remote peer asking to open data channel through signal server.
socket.on('webrtc-connection', function(data) {
    //console.log(data);
    var jd = JSON.parse(data);
    // remote client user id
    var peerId = jd["uid"];
    weblog("connection request from " + peerId);
    var pc = new RTCPeerConnection(configuration);

    pc.onerror = function(error) {
        weblog(error, "error");
        trace(error);
    }

    // send any ice candidates to the other peer
    pc.onicecandidate = function(evt) {
        // what to do with a new candidate
        if (evt.candidate) {
            trace("pc.onicecandidate: " + JSON.stringify(evt.candidate));
            socket.emit("webrtc-candidate", JSON.stringify({
                "uid": userId,
                "ruid": peerId,
                "candidate": evt.candidate
            }));
            var candidate = new RTCIceCandidate(evt.candidate);
            pc.addIceCandidate(candidate).catch(logError);
        }
    };

    // var the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function(evt) {
        trace("pc.onnegotiationneeded ", evt);
        pc.createOffer().then(function(offer) {
                trace("createOffer" + JSON.stringify(offer));
                socket.emit('webrtc-dsp', JSON.stringify({
                    "uid": userId,
                    "ruid": peerId,
                    "webrtc": offer
                }));

                pc.setLocalDescription(offer);
            })
            .catch(logError);
    };
    console.log("creating data channel");
    // create a data channel
    var channel = pc.createDataChannel("channel" + peerId);
    // keep track of channel and connection
    peers[peerId] = {
        "pc": pc,
        "channel": channel
    };
    handleChannelServer(channel, peerId);
});

socket.on('connect', function() {
    socket.emit('details-req', "");
});

socket.on('details-res', function(data) {
    trace('config: ' + data);
    var jd = JSON.parse(data);
    configuration = jd;
});

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
            handleChannelClient(channel);
        }
    }
    if (message.type) {
        if (message.type == "candidate") {
            var candidate = new RTCIceCandidate(message.candidate);
            pc.addIceCandidate(candidate).catch(logError);
            trace("receiveed candidate: " + JSON.stringify(candidate));
        }
        // if we get an offer, we need to reply with an answer
        if (message.type == "offer") {
            trace("received offer: " + JSON.stringify(message));
            var desc = new RTCSessionDescription(message);
            pc.setRemoteDescription(desc).then(function() {
                    return pc.createAnswer();
                })
                .then(function(answer) {
                    socket.emit("webrtc-dsp", JSON.stringify({
                        "uid": userId,
                        "ruid": ruid,
                        "webrtc": answer
                    }));
                    trace("sending answer: " + JSON.stringify(answer));
                    return pc.setLocalDescription(answer);
                })
                .then(function() {
                    pc.onicecandidate = function(evt) {
                        if (evt.candidate) {
                            trace("pc.onicecandidate: " + JSON.stringify(evt.candidate));
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
            var desc = new RTCSessionDescription(message);
            pc.setRemoteDescription(desc).catch(logError);
        }
    }
});

function handleChannelServer(channel, peerId) {
    channel.onopen = function() {
        weblog("webrtc channel open to " + peerId);
    };

    channel.onerror = function(error) {
        weblog(error, "error");
    };

    channel.onmessage = function(evt) {
        trace("receiving msg");
        var msg = JSON.parse(evt.data);
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

function handleChannelClient(channel) {
    var receiveBuffer = [];
    var receivedSize = 0;
    var file = null;
    channel.onopen = function() {
        trace("channel open");
        $('#banner').html("<h2>Connected to: " + remote_peer_id + "</h2><h3>File list:-</h3>");
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
            var p = Math.floor((receivedSize / file.size) * 100);
			var ratioStr = getSizeUnits(receivedSize).size + "" + getSizeUnits(receivedSize).units + " / " + getSizeUnits(file.size).size + "" + getSizeUnits(file.size).units
            var progressText = "#PROG" + fileIdHash + "TEXT";
            var progressId = "#PROG" + fileIdHash + "PROG";
            trace("file download: " + p + "%");
            $(progressText).attr('data-label', ratioStr)
            $(progressId).css('width', p + "%")
            if (receivedSize === file.size) {
                var received = new window.Blob(receiveBuffer, {
                    type: file.type
                });
                var href = URL.createObjectURL(received)
                receiveBuffer = [];
                receivedSize = 0;
                var id = "#" + fileIdHash;
                $(id).text("download");
                $(id).attr('href', href);
                $(id).attr('download', file.name);
                var idView = "#" + fileIdHash + "VW";
                $(idView).text("view");
                $(idView).attr('href', href);
                file = null;
				receiveFile = false;
				var next = queue.pop();
				if (next) {
					console.log("next: " + next.t.id);
					requestFile(next.t, next.id);
				}
				
            }
        } else {
            msg = JSON.parse(evt.data);
            switch (msg.type) {
                case "file-list-rep":
                    var fileArray = Object.keys(msg.data);
					var fileList = msg.data;
					trace(fileHash);

                    var htmlStr = "<ul>";
                    fileArray.forEach(function(item) {
						//var item = decodeURIComponent(i);
						var fileSize = fileList[item].size;
                        var i1 = btoa(item);
                        var i2 = btoa(item + ".blob");
                        htmlStr += "<li><a id=" + item + " class='file-item' href=# onclick='requestFile(this,\"" + msg.uid + "\")'>" + decodeURIComponent(item) + 
							"</a><div class='progress' data-label='"+ getSizeUnits(fileSize).size +" " + getSizeUnits(fileSize).units +"' id=PROG" + item.hashCode() + "TEXT> <span class=value id=PROG" + item.hashCode() + "PROG style='width:0%;'></span> </div>" +
                        //htmlStr += "<li><a id=" + item + " class='file-item' href=# onclick='requestFile(this,\"" + msg.uid + "\")'>" + decodeURIComponent(item) + "</a><progress id=PROG" + item.hashCode() + "PROG max='100' value='0' />" +
                            "<a class='file-item' target='_blank' href=# id=" + item.hashCode() + "></a>" +
                            "<a class='file-item' target='_blank' href=# id=" + item.hashCode() + "VW></a></li>";

                    });
                    htmlStr += "</ul>";
                    $("#maindiv").html(htmlStr);
                    break;
                case "file-rep":
                    file = msg.data;
                    console.log(JSON.stringify(file));
                    break;


            }
        }
    };
}

var progress = {};
var receiveFile = false;
var queue = [];

function requestFile(t, peerId) {
	if (progress[t.id]) return;
	if (receiveFile) {
        var progressText = "#PROG" + t.id.hashCode() + "TEXT";
		queue.push({t: t, id: peerId});
		trace("queued " + t.id);
        $(progressText).attr('data-label', "Queued")
		return;
	}
    var fileName = t.id;
	progress[t.id] = true;
	receiveFile = true;
    console.log("peer" + peerId);
    var channel = peers[peerId]["channel"];

    channel.send(JSON.stringify({
        "uid": userId,
        "type": "file-request",
        "file-name": fileName
    }));
}

function sendData(fileName, channel) {
    var file = fileHash[fileName];
    trace('File is ' + [file.name, file.size, file.type, file.lastModifiedDate].join(' '));
    channel.send(JSON.stringify({
        "uid": userId,
        "type": "file-rep",
        "data": {
            "name": file.name,
            "size": file.size,
            "type": file.type
        }
    }));
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
        var slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
    };
    sliceFile(0);
}

function sendChatMessage(msg) {
    channel.send("[" + userId + "]" + msg);
}

function logError(error) {
    trace(error.name + ": " + error.message);
    weblog(error.message, "error");
}

function handleFileSelect(evt) {
    var files = evt.target.files; // FileList object

    // files is a FileList of File objects. List some properties.
    var output = [];
    for (var i = 0, f; f = files[i]; i++) {
        fileHash[escape(f.name)] = f;
        weblog("added: " + escape(f.name));
    }

    $('#start').attr('disabled', false);
}
