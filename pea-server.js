// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'pea-server';


// websocket and http servers
var http = require('http');
var url = require('url');
var path = require('path');
var qs = require('querystring');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
//var dl = require('./delivery.server');
var fs = require('fs');
var serve = serveStatic("./public/");
var events = require('events');
var ev = new events.EventEmitter();

/**
 * global variables
 */
var users = {};
var httpPort = 8080;
var serve_folder = "public";
var clientHtml = fs.readFileSync("./public/indexc.html").toString();
// track ICE DSP offers/answers
var dsps = {}
// track ICE candidates
var candidates = {}
// track websocket open sockets
var socks = {}

/**
 * main HTTP server. Serving files from serve_folder.
 * If file does not exist handle HTTP request programatically through
 * handleUserSite()
 */
var server = http.createServer(function(req, res) {
	var uri = url.parse(req.url).pathname;
    	var filename = path.join(process.cwd(), serve_folder, uri);
	fs.stat(filename, function(err, stat){
		if(err == null){
			var done = finalhandler(req, res);
			serve(req,res, done);
		}else{
			handleUserSite(req, res);
		}
	});
});

/**
 * initiate HTTP server
 */
server.listen(httpPort, function() {
    console.log((new Date()) + " Http server is listening on port " + httpPort);
});

/**
 * handel HTTP gets to server. If no user is defined in the URL return the default 
 * index.html else parse and replace the id in client html (indexc.html) and return that
 * e.g. client URL: http://<server>/<user>/
 */
function handleUserSite(req, res){
	var rePattern = new RegExp(/^\/(.*?)\/.*/);
	var query = qs.parse(url.parse(req.url).query);
	var url_parts = url.parse(req.url);
	var url_file = url_parts["pathname"].slice(1);
	var url_pathname = url_parts["pathname"];
	var url_ref = req.headers.referer;
	var user = url_pathname.match(rePattern);
	var finished_files={};
	res.on('error', function(evt){
		console.log(evt);
	});
	if(user != null){
		user = user[1];
		// set remote peer id in client html file
		var ret_html = clientHtml.replace("333444PQR", user);
		res.writeHead(200);
		res.write(ret_html);
		res.end();
	}
}

/**
 * handle communication events between server and browser
 */
var io = require('socket.io').listen(server);
io.on('connection', function(socket){

	socket.on('webrtc-register', function(data){
		var jd = JSON.parse(data);
		var uid = jd["uid"];
		socks[uid] = socket;
		console.log(uid+" registerd.");
	});
	
	socket.on('webrtc-connection-req', function(data){
		console.log(data)
		var jd = JSON.parse(data);
		var uid = jd["uid"];
		socks[uid] = socket;
		console.log(uid+" registerd.");
		
		if(jd.ruid in socks){
		  var s = socks[jd.ruid];
		  s.emit("webrtc-connection", data);
		}
		
	});

	socket.on('candidate', function(data){
		var jd = JSON.parse(data);
		var uid = jd["uid"]
		var cand = jd["webrtc"]
		if(uid in candidates){
			candidates[uid].push(cand);
		}else{
			candidates[uid] = []
			candidates[uid].push(cand);
		}
		console.log(JSON.stringify(data));
	});

	socket.on('webrtc-dsp', function(data){
		console.log(JSON.stringify(data));
		var jd = JSON.parse(data);
		var uid = jd["uid"];
		var ruid = jd["ruid"];
		var dsp = jd["webrtc"];
		//dsps[uid] = dsp;
		//socks[uid] = socket;
		console.log(ruid);
		if(ruid in socks){
		  var s = socks[ruid];
		  s.emit('webrtc-message', JSON.stringify({"uid" : ruid, "ruid": uid, "webrtc" : dsp}));
		}
	});
	
	socket.on('get-offer', function(data){
	        var jd = JSON.parse(data);
		var ruid = jd["ruid"];	
		if(ruid in dsps){
			socket.emit('webrtc-message', JSON.stringify(dsps[ruid]));
			console.log(JSON.stringify(dsps[ruid]));
		}
		if(ruid in candidates){
			candidates[ruid].forEach( function(val, index, array) {
				if(val){
					socket.emit('webrtc-message', JSON.stringify(val));
					console.log("CAND: "+JSON.stringify(val));
				}
			});	
		}
		console.log(JSON.stringify(data));
		
	});
	/*socket.on("answer", function(data){
		console.log("ANSWER: "+JSON.stringify(data));
		var jd = JSON.parse(data);
		var ruid = jd["ruid"];
		var dsp = jd["webrtc"];
		var s = socks[ruid];
		s.emit("webrtc-message", JSON.stringify(dsp));
		
	});*/
});


var user_log = function(user, message){
		if(user == undefined){
			user = "nouser";
		}
		console.log("["+user+"] "+message);
	};
