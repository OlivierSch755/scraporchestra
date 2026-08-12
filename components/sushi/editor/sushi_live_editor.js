#!/usr/bin/env node

const path = require("path");

const WebSocket = require("ws"), { WebSocketServer } = WebSocket;
const express = require("express");
const {createServer} = require ("http");

const {SushiWebProxyServer} = require("./lib/proxy.js");
const {RequestLimiter} = require("./lib/request_limiter");

// proto is whatever protobuf.loadSync(...) returned
function startSushiWebEditorBackend( proto, wss ){

	const cleanUp = [];
	
	// create gateway proxy server
	const sushiWebProxyServer = new SushiWebProxyServer(proto, "localhost:51051");

	cleanUp.push( () => { 
		sushiWebProxyServer.close();
	})

	// add a bit of limiter to not spam Sushi 
	const requestLimiter = new RequestLimiter(400);
	requestLimiter.addEventListener( "saturated", () => { console.warn( "Sushi Editor Bridge limiter saturated" ) } )
	requestLimiter.addEventListener( "not_saturated", () => { console.log( "Sushi Editor Bridge limiter no longer saturated" ) } )

	// expose our limited handler (should be bound to ws client)
	
	
	
	async function WsclientMessageHandler( buf ){ 
		// should close this ws is sushiWebProxyServer is not connected
		const response = await requestLimiter.run ( ()=> sushiWebProxyServer.handleClientMessage(buf, this) );
		this.send(response, { binary: true })	
	}

	// all the wss stuff should not belong here
	function wssConnectionhandler( ws ){
		if( ws.context.pathname === "/components/sushi/editor/" ){
			ws.on('message', WsclientMessageHandler );
		}
	}

	wss.on('connection', wssConnectionhandler );

	cleanUp.push( () => { 
		wss.off('connection', wssConnectionhandler );
	})

	function close(){
		console.log("closing sushi editor")
		cleanUp.forEach( task => task() );
	}

	return {
		proxy : sushiWebProxyServer,
		WsclientMessageHandler,
		close
	}
	
}

module.exports = {
	startSushiWebEditorBackend
}

