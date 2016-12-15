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





ev.on('file-receive', function(data) {

	console.log("ev1: "+data.user)

});




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
		console.log("error: "+evt);
	});
	if(user != null){
		user = user[1];
		if(user in users){
			console.log("found user: "+user);
			var socket = users[user].socket;
		
			var delivery = 	users[user].delivery;
		        
			delivery.once('receive.success', function(file){
				res.writeHead(200);
				res.write(file.buffer);
				res.end();
			});

			socket.once('file-list-reply', function(data){
				console.log(JSON.stringify(data));
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
			console.log("requesting filename: "+file_name);
			if((file_name == "") | (file_name == user)){
				//file_name = "index.html"
				socket.emit("file-list-request", null);
			}else{
				finished_files[file_name] = false;
				socket.emit("file-request", file_name);
			}
		}else{
			console.log("404");
			res.writeHead(404);
			res.end("404");
		}
	}
	
	
}

var server = http.createServer(function(req, res) {
	var uri = url.parse(req.url).pathname;
    	var filename = path.join(process.cwd(), "public", uri);
	console.log(filename);
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
			console.log("Added user: "+user);
			var delivery = 	dl.listen(socket);
			users[user] = { socket: socket, delivery : delivery };
		}
		//ev.emit("file-receive", data);
	});
	//socket.on('hand-shake2', function(data){
	//	console.log("hs2: "+data);
	//});
});

/*io.sockets.on('connection', function(socket){
  var delivery = dl.listen(socket);
  delivery.on('receive.success',function(file){

    fs.writeFile(file.name,file.buffer, function(err){
      if(err){
        console.log('File could not be saved.');
      }else{
        console.log('File saved.');
      };
    });
  });
});*/

//////////////////////////////////////////////////////////////////

var serve2 = http.createServer(function(request, response) {
	
	var query = qs.parse(url.parse(request.url).query);
	var url_parts = url.parse(request.url);
	var url_file = url_parts["pathname"].slice(1);
	var servd = false;
	console.log(url_file);
	console.log(request.headers.referer);
	var url_ref = request.headers.referer;
	response.on('error', function(err){
		console.log(err);
	});
        
	if(url_ref != undefined){
		var query_ref = qs.parse(url.parse(url_ref).query);
		query = query_ref	
	}
	if(query["user"]){
		var user = query["user"];
		
		console.log(user)
		if(user in users){
			servd = true;
			console.log("found user "+user)
			var conn = users[user];
			conn.on('message', function(message) {
				//console.log("Message..."+message);
				//if (message.type === 'utf8') { // accept only text
					//var jdata = JSON.parse(htmlEntities(message.utf8Data));
					var jdata = JSON.parse(message.utf8Data);
					//console.log("Message2: "+message.utf8Data);
					if(url_ref != undefined){
						var payload64 = jdata["data"].replace(/^data:image\/png;base64,|^data:image\/jpeg;base64,|^data:image\/jpg;base64,|^data:image\/bmp;base64,/, '');
						var buf = new Buffer(payload64, 'base64');
						response.writeHead(200, {
							'Content-length': buf.length,
							'Content-Type': 'Image/jpeg'});
						console.log("Writing....1");	
						//var ret = response.write(jdata["data"], 'utf-8');
						var ret = response.write(buf);
						console.log("Writing....2" + ret);	
						//response.end(request.method);
						console.log("Ending....1");	
						response.end(function(evt){ console.log("Ended");});
					}else{
						response.writeHead(200);
						console.log("Writing....1");	
						var ret = response.write(jdata["data"], 'utf-8');
						console.log("Writing....2" + ret);	
						//response.end(request.method);
						console.log("Ending....1");	
						response.end(function(evt){ console.log("Ended");});
					}
					
					

				  //  }
			    });
			if(url_file == "frontend.html"){
				var json = JSON.stringify({ type:'message', data: "index.html" });
			}else{
				var json = JSON.stringify({ type:'message', data: url_file });
			}
			conn.sendUTF(json);
			
		}
		//serve browser page
		//conn = users[query["user"]]
		//var json = JSON.stringify({ type:'message', data: "test.html" });
		//connection.sendUTF(json);
		
	}


	if((url_file == "frontend.html") && (servd == false)){	
		//serve server page
		var done = finalhandler(request, response);
		serve(request,response, done);
		console.log("wewewewewewe");
	}else{

		
	}
});


