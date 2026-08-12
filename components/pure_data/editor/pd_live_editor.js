const dgram = require('node:dgram');
const net = require("node:net");
const path = require("node:path");
const {EventEmitter} = require('node:events');

class PdEditorProxyError{
	constructor(message){
		this.message = message;
	}
}

class PdEditorProxyNoPortError extends PdEditorProxyError{};

const States = {
	AWAITING_PD_REQUEST : 1,
	AWAITING_GUI_CONNECTION : 2,
	READY : 3,
	CLOSED : 4
}

class PdEditorProxy extends EventEmitter{
	
	_state;
	gui_client;
	gui_server;
	pd_client;
	pd_server_port;
	gui_cmd_path = path.resolve ( path.join( __dirname , "guicmd.js"  ) );
	
	static udp_port = 58032;
	static gui_port = 58033;
	
	set state(state){
		this._state = state;
		this.emit("state",state);
	}
	
	get state(){
		return this._state;
	}
	
	async start(){
		
		const port_receiver = dgram.createSocket('udp4');
	
		this.state = States.AWAITING_PD_REQUEST;
		
		port_receiver.once('error', (err) => {
		  port_receiver.close();
		  let err2 = new PdEditorProxyNoPortError("Cannot get expected GUI port from Pure Data");
		  err2.cause = err;
		  this.emit( 'error', err2 );
		});

		port_receiver.once('message', (msg, rinfo) => {
			
			port_receiver.close(); // we no longer need this
			
			
			// Here pd is running & expecting a connection from a gui instance thru this port
			let pd_server_port = msg.toString();
			this.pd_server_port = pd_server_port;
			
			// Pd expects gui instance to connect over localhost.
			// So we fire our own server that will receive from LAN (remote gui will connect to that)
			const remote_gui_server = net.createServer( (remote_gui_client) => {
			
				if(	this.gui_client ){ 
					remote_gui_client.destroy(); // we only accept one client at a time
					return;
				}
			
				this.gui_client = remote_gui_client;
				
				const gui_close =()=>{ this.close(); }			
			
				remote_gui_client.once("close", gui_close)
				remote_gui_client.once("end",   gui_close)
				remote_gui_client.once("error", (err)=>{
					console.log("remote_gui_client error", err)
					gui_close();
				});
				
				// ONLY once we got remote gui client online, we connect to pd via the port we intercepted
				const pd_client = net.createConnection({ port: pd_server_port }, () => {
					this.pd_client = pd_client;


					let pd_client_open = true;
					
					function handlePdClose(){
						pd_client_open = false;
					}

					pd_client.on("end", handlePdClose);
					pd_client.on("close", handlePdClose);
					pd_client.on("error", err => {
						console.log("pd_client error", err)
						handlePdClose();
					});
					
					
					pd_client.on("data", data => {
						if (!remote_gui_client.destroyed) {
							remote_gui_client.write(data);
						}
					});

					remote_gui_client.on("data", data => {
						if (!pd_client.destroyed && pd_client_open) {
							pd_client.write(data);
						}
					});
					
					this.state = States.READY;
					
					
				});

	
			});
			
			remote_gui_server.listen( PdEditorProxy.gui_port, ()=>{
				this.state = States.AWAITING_GUI_CONNECTION;
			});
			
			this.gui_server = remote_gui_server;
		});

		port_receiver.bind( PdEditorProxy.udp_port );

		
	}
	
	close(){
		
		if( this.state === States.CLOSED ) return;
		
		console.log("closing pd editor backend")
		
		this.state = States.CLOSED;
		process.nextTick( ()=>{
			try{
				this.pd_client?.destroy();
				this.gui_client?.destroy();
				this.gui_server?.close();
			}
			catch(err){
				console.warn(err)
			}
		})
		

	}

}


module.exports = {
	PdEditorProxy,
	EditorStates : States,
	stateHr : (state)=> Object.entries(States).find( ([k,v])=> v === state )?.[0], 
}