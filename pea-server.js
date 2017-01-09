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
var dl = require('./delivery.server');
var fs = require('fs');
var serve = serveStatic("./public/");
var events = require('events');
var ev = new events.EventEmitter();

/**
 * Global variables
 */
var users = {};
var httpPort = 80;







function handleUserSite(req, res){
	var rePattern = new RegExp(/^\/(.*?)\/.*/);
	var query = qs.parse(url.parse(req.url).query);
	var url_parts = url.parse(req.url);
	var url_file = url_parts["pathname"].slice(1);
	var url_pathname = url_parts["pathname"];
	var url_ref = req.headers.referer;
	var user = url_pathname.match(rePattern);
	//console.log(user);
	var finished_files={};
	res.on('error', function(evt){
		console.log(evt);
	});
	if(user != null){
		user = user[1];
		if(user in users){
			//console.log("found user: "+user);
			var socket = users[user].socket;
		
			var delivery = 	users[user].delivery;
		        
			delivery.once('receive.success', function(file){
				res.writeHead(200);
				res.write(file.buffer);
				res.end();
			});

			socket.once('file-list-reply', function(data){
				//console.log(JSON.stringify(data));
				if(data.indexOf("index.html") != -1){
					socket.emit("file-request", "index.html");
					return;
				}
				var html_str = "<html><title>Directory listing for "+user+"</title>";
				html_str += "<body><h2>Directory listing for "+user+"</h2><hr>";
				html_str += "<ul>";
				data.forEach(function(item) {
					html_str += "<li><a href="+item+">"+item+"</a>";
				});
				html_str += "</ul><hr></body></html>";

				res.writeHead(200);
				res.write(html_str);
				res.end();
			});

			var file_name = path.basename(url_pathname);
			if((file_name == "") | (file_name == user)){
				user_log(user, "requesting filelist.");
				socket.emit("file-list-request", null);
			}else{
				user_log(user, "requesting filename: "+file_name);
				finished_files[file_name] = false;
				socket.emit("file-request", file_name);
			}
		}else{
			//console.log("404");
			res.writeHead(404);
			res.end("404");
		}
	}
	
	
}

var user_log = function(user, message){
		if(user == undefined){
			user = "nouser";
		}
		console.log("["+user+"] "+message);
	};

var server = http.createServer(function(req, res) {
	var uri = url.parse(req.url).pathname;
    	var filename = path.join(process.cwd(), "public", uri);
	//console.log(filename);
	fs.stat(filename, function(err, stat){
		if(err == null){
			//console.log("exists");
			var done = finalhandler(req, res);
			serve(req,res, done);
		}else{
			//console.log("!exists");
			handleUserSite(req, res);
		}
	});



});

server.listen(httpPort, function() {
    console.log((new Date()) + " Http server is listening on port " + httpPort);
});


var io = require('socket.io').listen(server);

io.on('connection', function(socket){

	socket.on('hand-shake', function(data){
		//console.log("hs1: "+data["user"]);
		var user = data["user"];
		if(user != null){
			console.log("added user: "+user);
			var delivery = 	dl.listen(socket);
			users[user] = { socket: socket, delivery : delivery };
			socket.emit('hand-shake-ack', null);
		}
	});
});

