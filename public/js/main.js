//'use strict';


var receivedSize = 0;
var bytesToSend = 0;
var configuration = {
    iceServers: [{
        urls: ["stun:stun.l.google.com:19302"]
    }]
};

var user_id = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
var server_url = "https://" + location.host;
var file_hash = {};
var socket = io.connect(server_url);
//var channel;
var pc;
var peers = {};


function init() {
    $('#id').val(user_id);
    $('#start').attr('disabled', true);
}



function listen(url) {
    if (!(url)) {
        url = server_url
    }
    // register socket on signal server
    socket.emit('webrtc-register', JSON.stringify({
        "uid": user_id
    }));
    weblog("started file server at " + server_url + "/" + user_id);
    $("#url").html("<a href=" + server_url + "/" + user_id + " target=_blank>client: " + server_url + "/" + user_id + "</a>");
    $('#id').attr('disabled', true);
    $('#start').attr('disabled', true);
}

function connect(uid) {
    //if(client == true){
    //	user_id = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
    //}
    // get offer from remote peer with uid
    socket.emit('webrtc-connection-req', JSON.stringify({
        "uid": user_id,
        "ruid": uid
    }));
}

// remote peer asking to open data channel through signal server.
socket.on('webrtc-connection', function(data) {
    //console.log(data);
    var jd = JSON.parse(data);
    // remote client user id
    var peer_id = jd["uid"];
    weblog("connection request from " + peer_id);
    var pc = new RTCPeerConnection(configuration);

    pc.onerror = function(error) {
        weblog(error, "error");
        console.log(error);
    }

    // send any ice candidates to the other peer
    pc.onicecandidate = function(evt) {
        // what to do with a new candidate
        //socket.emit('candidate', JSON.stringify({"uid": user_id, "webrtc": evt.candidate}));
        if (evt.candidate) {
			trace("pc.onicecandidate: " + evt.candidate);
            var candidate = new RTCIceCandidate(evt.candidate);
            pc.addIceCandidate(candidate).catch(logError);
        } else {
            trace("sending offer: " + JSON.stringify(pc.localDescription));
            // send the offer to the other peer
            socket.emit('webrtc-dsp', JSON.stringify({
                "uid": user_id,
                "ruid": peer_id,
                "webrtc": pc.localDescription
            }));
        }
    };

    // var the "negotiationneeded" event trigger offer generation
    pc.onnegotiationneeded = function(evt) {
        pc.createOffer().then(function(offer) {
                pc.setLocalDescription(offer);
            })
            .catch(logError);
    };
    console.log("creating data channel");
    // create a data channel
    var channel = pc.createDataChannel("channel" + peer_id);
    // keep track of channel and connection
    peers[peer_id] = {
        "pc": pc,
        "channel": channel
    };
    handleChannelServer(channel, peer_id);
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
        // if we get an offer, we need to reply with an answer
        if (message.type == "offer") {
			trace("received offer: " + JSON.stringify(message));
            var desc = new RTCSessionDescription(message);
            pc.setRemoteDescription(desc).then(function() {
                    return pc.createAnswer();
                })
                .then(function(answer) {
                    return pc.setLocalDescription(answer);
                })
                .then(function() {
                    pc.onicecandidate = function(evt) {
                        if (evt.candidate) {
                            trace("pc.onicecandidate: " + JSON.stringify(evt.candidate));
                            var candidate = new RTCIceCandidate(evt.candidate);
                            pc.addIceCandidate(candidate);
                        } else {
                            var str = JSON.stringify({
                                "uid": user_id,
                                "ruid": ruid,
                                "webrtc": pc.localDescription
                            });
                            trace("sending answer: " + str);
                            socket.emit("webrtc-dsp", str);
                        }
                    }
                })
                .catch(logError);
        } else {
            var desc = new RTCSessionDescription(message);
            pc.setRemoteDescription(desc).catch(logError);
        }
    } else {
        var candidate = new RTCIceCandidate(message);
        pc.addIceCandidate(candidate).catch(logError);
    }
});

function handleChannelServer(channel, peer_id) {
    channel.onopen = function() {
        weblog("webrtc channel open to " + peer_id);
    };

    channel.onerror = function(error) {
        weblog(error, "error");
    };

    channel.onmessage = function(evt) {
        trace("receiving msg");
        msg = JSON.parse(evt.data);
        switch (msg.type) {
            case "file-list":
                var file_array = [];
                Object.keys(file_hash).forEach(function(key) {
                    file_array.push(key);
                });
                weblog("file list requested by " + peer_id);
                channel.send(JSON.stringify({
                    "uid": user_id,
                    "type": "file-list-rep",
                    "data": file_array
                }));
                break;
            case "file-request":
                //alert(msg["file-name"]);
                weblog("sending file " + msg["file-name"] + " to " + peer_id);
                sendData(msg["file-name"], channel);
                break;
        }
    };
}

function handleChannelClient(channel) {
    var receiveBuffer = [];
    var receivedSize = 0;
    var file = null;
    channel.onopen = function() {
        trace("channel open");
        $('#banner').html("<h2>Connected to: " + remote_peer_id + "</h2><h3>File list:-</h3>");
        channel.send(JSON.stringify({
            "uid": user_id,
            "type": "file-list"
        }));
    };

    channel.onmessage = function(evt) {
        var msg;
        if (file) {
            var d = evt.data;
            receiveBuffer.push(d);
            if ($.browser.webkit) {
                receivedSize += d.byteLength;
            } else {
                receivedSize += d.size;
            }
            var p = Math.floor((receivedSize / file.size) * 100);
            var progressId = "#PROG" + file.name.hashCode() + "PROG";
            trace("file download: " + p + "%");
            $(progressId).attr('value', p)
            if (receivedSize === file.size) {
                var received = new window.Blob(receiveBuffer, {
                    type: file.type
                });
                var href = URL.createObjectURL(received)
                receiveBuffer = [];
                receivedSize = 0;
                var id = "#" + file.name.hashCode();
                $(id).text("download");
                $(id).attr('href', href);
                $(id).attr('download', file.name);
                var idView = "#" + file.name.hashCode() + "VW";
                $(idView).text("view");
                $(idView).attr('href', href);
                file = null;
            }
        } else {
            msg = JSON.parse(evt.data);


            switch (msg.type) {
                case "file-list-rep":
                    var file_list = msg.data;
                    var html_str = "<ul>";
                    file_list.forEach(function(item) {
                        var i1 = btoa(item);
                        var i2 = btoa(item + ".blob");
                        html_str += "<li><a id=" + item + " class='file-item' href=# onclick='requestFile(this,\"" + msg.uid + "\")'>" + item + "</a><progress id=PROG" + item.hashCode() + "PROG max='100' value='0'/>" +
                            "<a class='file-item' target='_blank' href=# id=" + item.hashCode() + "></a>" +
                            "<a class='file-item' target='_blank' href=# id=" + item.hashCode() + "VW></a></li>";

                    });
                    html_str += "</ul>";
                    $("#maindiv").html(html_str);
                    break;
                case "file-rep":
                    file = msg.data;
                    console.log(JSON.stringify(file));
                    break;


            }
        }
        //alert(evt.data);
    };
}


function requestFile(t, peer_id) {
    var file_name = t.id;
    console.log("peer" + peer_id);
    channel = peers[peer_id]["channel"];

    channel.send(JSON.stringify({
        "uid": user_id,
        "type": "file-request",
        "file-name": file_name
    }));
}

function sendData(file_name, channel) {
    var file = file_hash[file_name];
    trace('File is ' + [file.name, file.size, file.type, file.lastModifiedDate].join(' '));
    channel.send(JSON.stringify({
        "uid": user_id,
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
                //channel.send(JSON.stringify({"uid": user_id, "data" : btoa(e.target.result)}));
                channel.send(e.target.result);
                if (file.size > offset + e.target.result.byteLength) {
                    window.setTimeout(sliceFile, 0, offset + chunkSize);
                }
                //sendProgress.value = offset + e.target.result.byteLength;
            };
        })(file);
        var slice = file.slice(offset, offset + chunkSize);
        reader.readAsArrayBuffer(slice);
    };
    sliceFile(0);
}

function sendChatMessage(msg) {
    channel.send("[" + user_id + "]" + msg);
}

function logError(error) {
    trace(error.name + ": " + error.message);
    weblog("error", error.message);
}



function handleFileSelect(evt) {
    var files = evt.target.files; // FileList object

    // files is a FileList of File objects. List some properties.
    var output = [];
    for (var i = 0, f; f = files[i]; i++) {

        //output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
        //        f.size, ' bytes, last modified: ',
        //        f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
        //        '</li>');
        file_hash[escape(f.name)] = f;
        weblog("added: " + escape(f.name));
    }

    $('#start').attr('disabled', false);
}
