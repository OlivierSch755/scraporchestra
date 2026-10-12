const {createServer} = require ("http");
const path = require ("node:path");

const express = require("express");
const { WebSocketServer, WebSocket } = require("ws"); 

const engine_controller = require( "./controllers/engine.js" );
const project_controller = require( "./controllers/project.js" );
const components_controller = require( "./controllers/components.js" );
const front_libs_controller = require( "./controllers/front_libs.js" );


const options_template = {
	log_requests : false,
	log_ws_connections : false,
	log_app_errors : true,
	port : 3000
}



async function startWebAppServer( application, options = options_template ){
	
	options = {
		...options_template,
		...options,
	};


	const app = express();
	const server = createServer(app);
	const wss = new WebSocketServer({ server });
	
	try{
		wss.on('connection', function connection(ws, req) {
			const url = new URL(req.url, "ws://base.url");
			const { pathname } = url;
			const subscriptions = Object.keys( Object.fromEntries(url.searchParams) ); 
			
			ws.context = {pathname, subscriptions}
			if(options.log_ws_connections){ 
				console.log("ws connected",  ws.context )
				ws.once("close", ()=>console.log("ws disconnected",  ws.context) )
			}
		});
		
		application.web = { 
			server, 
			wss, 
			wssRouteBroadcast : wssRouteBroadcast.bind(wss), 
			wssNotifyToSubscribed : wssNotifyToSubscribed.bind(wss), 
		}
		
		if(options.log_requests){
			app.use( ( req, res, next ) => {
				console.log("http req", req.originalUrl)
				next();
			});
		}
		
		app.use(express.json());
		
		app.use( '/projects', project_controller( application, wss ) );
		app.use( '/engine', engine_controller( application, wss ) );

		// this one does directory listing, hence await
		const components_ctrler = await components_controller( application, wss );
		app.use( '/components', components_ctrler );

		app.use( '/js/lib', front_libs_controller() );
		
		app.use( express.static(__dirname + '/public') );		
		
		// simple express error handler
		app.use((err, req, res, next) => {
			
			if(err instanceof Error ){
				console.error(err);
			} else if( options.log_app_errors ){
				console.log("APP ERROR");
				console.dir(err,  {depth:null});
			}
			
			if(res.headerSent){
				return next(err);
			}
			
			 res.status(500);
			 res.send(err.message)
		});	

		await new Promise((resolve, reject) => {
			server.once("error", reject);
			server.listen(options.port, resolve);
		});

		return { app, server, wss };
		
	}
	catch (err) {
		for (const client of wss.clients) {
			client.terminate();
		}

		wss.close();

		if (server.listening) {
			server.close();
		}

		throw err;
	}
}


function wssRouteBroadcast(route,data, options = undefined){
	
	this.clients.forEach( client => {
		if (
			client.readyState === WebSocket.OPEN 
			&& client.context.pathname === route
		){
			client.send(data, options);
		}
	});
	
}

function wssNotifyToSubscribed( notification_type ,data, options = undefined){
	
	const message = {
		notif : notification_type,
		data
	}
	
	this.clients.forEach( client => {
		if (
			client.readyState === WebSocket.OPEN 
			&& client.context.subscriptions.some( sub => sub === notification_type)
		){
			client.send(JSON.stringify(message), options);
		}
	});
	
}


module.exports = { startWebAppServer };


