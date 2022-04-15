"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'pea-server';
const http = require('http');
const express = require('express');
const randezvous = require('./src/randezvous');


/**
 * global variables
 */
const args = process.argv.slice(2);
const httpPort = args.length > 0 && !isNaN(args[0]) ? args[0] : 80;
const serveFolder = "public";
const app = express();
const server = http.createServer(app);


app.use(express.static(__dirname + '/' + serveFolder));

app.get('/:sessionId', (req, res) => {
	const sessionId = req.params.sessionId;
	if (sessionId) {
		res.redirect('client.html?sessionId=' + sessionId);
	}
});

randezvous.startWebSocket(server);

/*
 * start our server
 */
server.listen(httpPort, () => {
    console.log(`Server started on port ${server.address().port} :)`);
});
