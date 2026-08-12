const path = require('path');
const protobuf = require("protobufjs");
protobuf.parse.defaults.keepCase = true;

const kStreamResponseTypeId = Symbol("streamResponseType");
const kStreamMethodCancelFor = Symbol("streamMethodCancelFor");
const kMethodResponseInterceptor = Symbol("responseInterceptor");
const kMethodRequestInterceptor = Symbol("requestInterceptor"); // unused (yet)

module.exports = {
	fromProto,
	defineMethodResponseInterceptor
}

/* 
	Base proxy rpc definiton
*/
const proxy_rpc_json_stub = (()=>{

	const proxy_rpc_stub = new protobuf.Namespace("proxy_rpc");

	const ProxyClientMessage = new protobuf.Type("ProxyClientMessage") // we receive this 
		.add(new protobuf.Field("id", 1, "uint32"))
		.add(new protobuf.Field("method_id", 2, "uint32")) // we build a second proto definition just so client and us agree on method_id indexing		 	
		.add(new protobuf.Field("payload", 3, "bytes"));

	const ProxyServerMessage = new protobuf.Type("ProxyServerMessage") // we send this
		.add(new protobuf.Field("id", 1, "uint32"))
		.add(new protobuf.Field("type", 2, "uint32"))
		.add(new protobuf.Field("payload", 3, "bytes"));

	proxy_rpc_stub.add( ProxyClientMessage );
	proxy_rpc_stub.add( ProxyServerMessage );
	
	proxy_rpc_stub.add( new protobuf.Service("UnSubscribeToStreams")  ); //  needed to allow clients to close stream
	proxy_rpc_stub.add( new protobuf.Type("ProxyNullValue") );
	
	return proxy_rpc_stub.toJSON();
	
})();

/*
	Building Gateway Definition from proto
	
*/
function fromProto( source_root ){
	
	// clone source_root to avoid mutation on source object 
	const json_clone = structuredClone( source_root.toJSON() );
	const cloned_root = protobuf.Root.fromJSON(json_clone);
	
	
	// list all services in root
	const discovered_services = (function findAllServices(ns, result = []) {
		if (ns instanceof protobuf.Service) result.push(ns);
		for (const child of ns.nestedArray ?? []) findAllServices(child, result);
		return result;
	})(cloned_root);
	
	
	// our own root
	const proto_root = new protobuf.Root();
	
	// namespace for our own definitions
	const proxy_rpc = protobuf.Namespace.fromJSON("proxy_rpc", proxy_rpc_json_stub);
	proto_root.add(proxy_rpc);
	
	// namespace for elements found in cloned_root
	const proxy_impl = new protobuf.Namespace("proxy_impl");
	Object.values(cloned_root.nested).forEach( x => proxy_impl.add(x) )
	proto_root.add(proxy_impl)
	
	// we want to build a flattened array with all methods that are defined in cloned_root
	const methods = [];		
	
	// and expose them to let a single ws client talk to multiple grpc services
	const discovered_services_enum = {};
	const server_message_types_enum = {};

	// so basically we just assign an id to everthing 
	let method_index = 1;
	let notif_index = 1;
	let service_index = 1;
	
	discovered_services.forEach( service =>{
		
		// expose this service through our own single-line rpc implementation 
		discovered_services_enum[ service.fullName ] = service_index++;
		
		Object.values(service.methods).forEach( method =>{
			
			method.options = method.options || {};
			const method_id = method_index++;
			method.options.method_id = method_id ; // Assign an id to each method via option property
			
			// Push it into array afterwards,
			// now client can send a ProxyClientMessage with a method_id 
			// and we can route it without actually decoding the method payload 
			methods.push(method); 
			
			// Gateway implementation is for single requests over one line so it cannot handle streams.
			// Instead it will execute a callback to let server implementation handle stream requests.
			// This requires extra logic.
			if(method.responseStream){
				
				// Because client will receive stream data through the proxy (one line), we also need to id all messages.
				// that can be emited via a stream. 
				// kStreamResponseTypeId symbol serves as a lazy weakmap so we can later create an encoder that 
				// automatically encode stream data into ProxyServerMessage and server can pipe them directly to clients.
				const notif_id = notif_index++;
				method[kStreamResponseTypeId] = notif_id;
				server_message_types_enum[method.responseType] = notif_id;
				 		
						
				// We are not managing the actual streams, so we also expose a method to unsubscribe to the stream.
				// Again when unsubscribe method is called, gateway will execute another callback to let server implementation handle the operation
						
				const json_method_clone = method.toJSON();
				json_method_clone.requestType = proxy_rpc.ProxyNullValue.name;
				json_method_clone.responseType = proxy_rpc.ProxyNullValue.name;
				
				const clonedMethod = protobuf.Method.fromJSON(
					method.name,
					json_method_clone
				);
				
				clonedMethod.options = structuredClone(clonedMethod.options || {});
				
				// unsubscribe method should be called over ProxyClientMessage so it needs its own id
				const cloned_method_id = method_index++;
				clonedMethod.options.method_id = cloned_method_id;
				methods.push(clonedMethod);
				
				// kStreamMethodCancelFor symbol holds a reference to the original method object
				// we show it to server when this unsubscribe method is called in order to help
				// it decide what it is actually supposed to cancel.
				clonedMethod[kStreamMethodCancelFor] = method;
				
				// unsubscribe method belong to a separate namespace "proxy_rpc" because it's 
				// not actually part of source_root but rather of our own transport definition
				proxy_rpc.UnSubscribeToStreams.add(clonedMethod);
				
			}

		});
	});
	
	proxy_rpc.add( new protobuf.Enum("ProxyServerMessageType", server_message_types_enum));
	proxy_rpc.add( new protobuf.Enum("ProxyImplementedServices", discovered_services_enum));

	proto_root.resolveAll();

	return {
		proto_root,
		methods,
		create,
		defineMethodResponseInterceptor
	}
}

/*
	Instantiate a gatweay proxy between clients and rpc_impl
*/
function create(){

	const methods = this.methods; // this is our flattened array of methods that we discovered before
	const proxy_root = this.proto_root.nested.proxy_rpc;
	
	const server_methods = []; // this is the actual method_id resolver

	const proxy = {
		proxy_root,
		handleClientUnaryMessageRequest, // should be implemented by server
		handleClientStreamRequest,	// should be implemented by server
		handleClientCancelStreamRequest, // should be implemented by server
		handleClientMessage, // we have a default implementation for this (but server can still override it)
		createStreamEncoder, // utility function for server when handling stream
	};

	// what to do when we receive a ProxyClientMessage with this method id ? 
	methods.forEach( method => {
		
		
		let server_data_handler;
		
		// Method called is one of our internal method to unsubscribe from a stream
		// We just call handleClientCancelStreamRequest and let server decide what to do
		if(method[kStreamMethodCancelFor]){  
			server_data_handler = (arg, usr_ctx)=> proxy.handleClientCancelStreamRequest(arg, method[kStreamMethodCancelFor], usr_ctx);
		}
	    else if(method.responseStream){  // default stream behavior : call handleClientStreamRequest and let server decide
			server_data_handler = (arg, usr_ctx)=> proxy.handleClientStreamRequest(arg, method, usr_ctx);
		}
		else{ // default unary request, just forward it directly to GRPC client
			server_data_handler = (arg)=> proxy.handleClientUnaryMessageRequest(arg, method);
		}
		
		//  we also assign the method to the function, useful for live inspection
		server_data_handler.proto = method; 
		
		server_methods[method.options.method_id] = server_data_handler;
		
	});

	proxy.server_methods = server_methods;
	return proxy;
	
}

async function handleClientMessage(buf, usr_ctx){
	
	const {ProxyServerMessage, ProxyClientMessage} = this.proxy_root;
	
	const decoded = ProxyClientMessage.decode(buf); // we decode the message outer layer 
	const method_id = decoded.method_id;
	
	const proxy_method = this.server_methods[method_id];
	
	let response = await proxy_method(decoded.payload, usr_ctx);


	// one may intercept response to check result asynchronously
	// either to verify effect or to await some predictable notification.
	// (can save bandwidth and CPU time for clients).
	
	const response_interceptor = proxy_method.proto[kMethodResponseInterceptor];
	if(response_interceptor){ 
		response = await response_interceptor(response, proxy_method.proto, usr_ctx);
	}
	if(!response) return;

	const serverMessage = ProxyServerMessage.create({
		id : decoded.id,
		type : ProxyServerMessage.ProxyResponse,
		payload : response
	});
	
	
	// the transaction has been completed, we return a response that server can send however it likes. 
	return ProxyServerMessage.encode(serverMessage).finish();
}

//warn if not set by user
function handleClientStreamRequest(binary_payload, usr_ctx){
	console.warn("unimplemented client stream request");
}

//warn if not set by user
function handleClientCancelStreamRequest(binary_payload, method, usr_ctx){
	console.warn("unimplemented client cancel stream request");
}

//warn if not set by user
function handleClientUnaryMessageRequest(binary_payload, method, usr_ctx){
	console.warn("unimplemented client unary request");
}

// some constant function definitions that will not change or get bound 
function createStreamEncoder(method){
	const {ProxyServerMessage} = this.proxy_root;
	const pipe =(binary_data)=>{
		const proxyServerMessage = ProxyServerMessage.create({
			type : method[kStreamResponseTypeId],
			payload : binary_data
		});
		return ProxyServerMessage.encode(proxyServerMessage).finish() ;
	}
	return pipe;
}

function defineMethodResponseInterceptor(method, callback){
	if(typeof callback !== "function") throw new TypeError("callback expected as second argument");
	method[kMethodResponseInterceptor] = callback;
}
