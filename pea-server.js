// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'pea-server';


// websocket and http servers
const http = require('http');
const https = require('https');
const express = require('express');
const fs = require('fs');
const serveStatic = require('serve-static');
const randezvous = require('./src/randezvous');


/**
 * global variables
 */
const args = process.argv.slice(2);
const httpPort = args.length > 0 && !isNaN(args[0]) ? args[0] : 8080;
const httpsPort = args.length > 0 && !isNaN(args[0]) ? args[1] : 8181;
const serveFolder = "public";
const app = express();
const server = https.createServer({
	key: fs.readFileSync('key.pem'),
	cert: fs.readFileSync('cert.pem')
}, app);

app.use(express.static(__dirname + '/' + serveFolder));

app.get('/:sessionId', (req, res) => {
	const sessionId = req.params.sessionId;
	if (sessionId) {
		res.redirect('client.html?sessionId=' + sessionId);
	}
});

/**
 * initiate HTTP server
 * redirect to HTTPS server
 */
http.createServer(function (req, res) {
	const host = req.headers['host'].split(":")[0] + ":" + httpsPort;
    res.writeHead(301, { "Location": "https://" + host + req.url});
    res.end();
}).listen(httpPort);

/**
 * initiate HTTPS server
 */
server.listen(httpsPort, function() {
    console.log((new Date()) + " Http server is listening on ports " + [httpPort, httpsPort]);
	randezvous.startWebSocket(server);
});

