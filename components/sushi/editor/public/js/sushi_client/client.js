let isLeaving = false;
window.addEventListener("beforeunload", () => {
	console.log("leaving")
  isLeaving = true;
});

import '/js/lib/protobuf.js';

const protoRoot = await ( async ()=>{
	const proto_request = await fetch("./proto.json");
	const proto_json = await proto_request.json();
	return protobuf.Root.fromJSON(proto_json);
})();

window.protoRoot = protoRoot;


const sushi_rpc = protoRoot.nested.proxy_impl.nested.sushi_rpc 
const proxy_rpc = protoRoot.nested.proxy_rpc;

const ClientMessage = proxy_rpc.nested.ProxyClientMessage;
const ServerMessage = proxy_rpc.nested.ProxyServerMessage;
const ProxyResponse = 0;

const notificationTypes = {};
Object.entries( proxy_rpc.nested.ProxyServerMessageType.values ).forEach(([name,id])=>{
	notificationTypes[id] = sushi_rpc.nested[name]
})
	
class GrpcBridgeClient extends EventTarget {
	
	constructor() {
		super();

		this._request_id = 0;
		this._pending_cmds = {};
		this.offline = true;
		
		let url = new URL( window.location);
		url.protocol = "ws:"
		this.ws = new WebSocket(url);
		this.ws.binaryType = "arraybuffer";
		
		this.ready = new Promise((resolve, reject) => {
			this.ws.addEventListener("open", resolve, { once: true });
		})
		
		this.ready.then(() => {
			this.offline = false;
			this.dispatchEvent(new Event("ready"));
		});
				
		this.ws.addEventListener("error", e=>{this.signalOffline(e)}, { once: true });
		this.ws.addEventListener("close", e=>{this.signalOffline(e)}, { once: true });
		
		this.ws.addEventListener("message", (event) => {
			this.handleMessageEvent(event);
		});
	}
	
	signalOffline(e){
		if(this.offline || isLeaving ) return;
		this.offline = true;
		let detail = e.reason || "SushiGrpcClient proxy closed unexpectedly."; // blame proxy if no reason was provided
		this.dispatchEvent(new CustomEvent("offline", {detail}))
	}
	
	handleMessageEvent(event){
		const bytes = new Uint8Array(event.data);
		const serverMessage = ServerMessage.decode(bytes);
		const verif = ServerMessage.verify(serverMessage);
		if( verif !== null ) throw {message : "serverMessage failed verification", serverMessage, verif, bytes, ClassType : ServerMessage };
		if( serverMessage.type === ProxyResponse ){
			this.handleResponse(serverMessage);
		}
		else{
			this.handleBroadcast(serverMessage);
		}
	}
	
	handleResponse(response){
		const id = response?.id;
		if( !Number.isInteger(id) ) throw {message : "sushiResponse has no valid id ???", response };
		
		const cmd = this._pending_cmds[id];
		if(!cmd) throw {message : "SushiResponse points to no pending cmd ???", response };
		cmd.resolve(response.payload);
		delete this._pending_cmds[id];
	}
	
	handleBroadcast(msg){
		const Stub = notificationTypes[msg.type];
		const notification = Stub.decode(msg.payload);
		const broadcastEvent = new CustomEvent(Stub.name, {detail: {notification, Stub} });
		this.dispatchEvent(broadcastEvent);

	}
	
	generateRequestId(){
		this._request_id = (this._request_id + 1) % Number.MAX_SAFE_INTEGER;
		return this._request_id ;
	}
	
	async _sendProtobufCmd( method_id, payload ){
		await this.ready;
		const id = this.generateRequestId();
		const request = ClientMessage.create({id,method_id,payload});
		const promise = new Promise((resolve,reject)=>{
			this._pending_cmds[id] = {resolve,reject, request};
		})
		const encoded = ClientMessage.encode(request).finish();
		this.ws.send(encoded);
		return promise;
	}
	
	sendProtobufCmd( method_id, payload ){
		// return grpcLimiter.run( ()=> this._sendProtobufCmd(controller_id, method_id, payload) );
		return this._sendProtobufCmd( method_id, payload);
	}
}

const proxyClient = new GrpcBridgeClient();

/*
Build commandInterface
we want to create a reflection object such as : 

var commandInterface = {
	TransportController : {
		setTempo : function(){...} // <==  function will send the protobuf command over websocket and return its protobuf response 
		// ... other TransportController methods... 
	}
	// ... other ImplementedControllers & their methods 
}

And that's exactly what protobuf.js service API does. 
See https://github.com/protobufjs/protobuf.js/#services

So basically it's just a regular js object where all keys map to an implemented service.
We assign it instances of protobuf.js RPC implementation of the corresponsing RPC service.
	+ We mapped and identifier to each controller (proxy.RequestController) 
	and to each of its methods (using the option field).
	-> This mapping is server generated, so ws only has to pass those ids and server will 
	know how to route the message.
	
	 
Streams are handled by server and should not be used in web context for now

After importing commandInterface, other parts of app can do stuff like : 
```
	const response = await CommandInterface.TransportController.setTempo({value:40}) 
	// arg must be a protobuf object or plain js object equivalent.
```	
The whole thing will be encoded and sent over websocket and the return value will be populated with the server response.
*/

const commandInterface = {};

function rpcImpl(method, requestData, callback){
	proxyClient.sendProtobufCmd(method.options.method_id, requestData)  // <==  we retrieve the id directly from the method stub here to generate the ClientMessage object. 
	.then( res => callback(null,res) )
}


Object.entries(proxy_rpc.ProxyImplementedServices)
.forEach(([service_identifier,controller_id]) =>{
	let target_service = sushi_rpc.lookupService(service_identifier)
	commandInterface[target_service.name] = target_service.create(rpcImpl);
});

const unsubscribeRpc = proxy_rpc.UnSubscribeToStreams.create(rpcImpl);

async function is_sushi_ok(){
	const response = await fetch("./status.json");
	const json = await response.json();
	return json.online;
}

function notifyWhenOnlineAgain(delay = 2_500, timeout = 3_600_000 ){
	return new Promise((resolve,reject)=>{
		let retry_timeout, abandon_timeout, done = false;
		if(timeout > 0 ){
			abandon_timeout = setTimeout( x=>{
				if(done) return;
				done = true;
				reject();
				clearTimeout(retry_timeout);
			}, timeout )
		}
		async function retry(){
			if(done) return;
			try{
				const online = await is_sushi_ok()
				if( online ){
					done = true;
					clearTimeout(abandon_timeout);
					resolve();
				} 
				else {
					retry_timeout = setTimeout(retry, delay );
				}
			} catch(err){console.warn("Still offline")}
		}
		retry();
	});
}


export { protoRoot, notifyWhenOnlineAgain, commandInterface, unsubscribeRpc, proxyClient as sushiClient, sushi_rpc as sushiStub };



// debug
window.is_sushi_ok = is_sushi_ok;
window.notifyWhenOnlineAgain = notifyWhenOnlineAgain;
window.notificationTypes = notificationTypes;
window.protoRoot = protoRoot;
window.sushi_rpc = sushi_rpc;
window.proxy_rpc = proxy_rpc;
window.CommandInterface = commandInterface
window.sushiClient = proxyClient
window.unsubscribeRpc = unsubscribeRpc