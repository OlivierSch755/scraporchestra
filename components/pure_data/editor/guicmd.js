#!/usr/bin/env node
const dgram = require('node:dgram');
const {PdEditorProxy} = require("./pd_live_editor.js")
const UDP_PORT = PdEditorProxy.udp_port;


if( process.argv[2] ){
	let pd_server_port = process.argv[2];
	const port_sender = dgram.createSocket('udp4');
	port_sender.send(pd_server_port, UDP_PORT, 'localhost', (err) => {
		port_sender.close();
		process.exit(0);
	});
}