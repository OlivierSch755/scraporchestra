const {EventEmitter} = require("node:events");
const {passthrough} = require("./commons.js");

class AsyncValidator extends EventEmitter{
	
	constructor(proto){
		super();
		
		// Some types from sushi proto that we want to cache early
		const ASYNC_RESPONSE = proto.lookupType("CommandStatus").Status.ASYNC_RESPONSE;
		const AsyncCommandResponse = proto.lookupType("AsyncCommandResponse");
		const CommandResponse = proto.lookupType("CommandResponse");
		
		this.stubs = {
			proto,
			AsyncCommandResponse,
			CommandResponse,
			ASYNC_RESPONSE
		}
		
		// We will need a NotificationController.SubscribeToAsyncCommandUpdates() stream to validate async commands. 
		this.stream = null;
		
		
		this.pending_async_response = {};
		
		
		// we pre-bind those methods because they will get passed around. 
		this.processAsyncCommandResponse = this.processAsyncCommandResponse.bind(this);
		this.processRawAsyncCommandResponse = this.processRawAsyncCommandResponse.bind(this);
		this.processCommandResponse = this.processCommandResponse.bind(this);
		this.processRawCommandResponse = this.processRawCommandResponse.bind(this);
		
	}
	
	processAsyncCommandResponse(asyncCommandResponse){
		const {request_id} = asyncCommandResponse;
		const mine = this.pending_async_response[request_id];
		if(mine){
			const {commandResponse} = mine;
			commandResponse.status.status = asyncCommandResponse.status.status;
			mine.resolve(commandResponse);
		}
		// Cleanup
		delete this.pending_async_response[request_id];
	}
	
	processRawAsyncCommandResponse( encodedAsyncCommandResponse ){
		let asyncCommandResponse = this.stubs.AsyncCommandResponse.decode(encodedAsyncCommandResponse);
		this.processAsyncCommandResponse(asyncCommandResponse);
	}
	
	processCommandResponse( commandResponse ){
		if( commandResponse.status.status !== this.stubs.ASYNC_RESPONSE ) return Promise.resolve(commandResponse);
		return new Promise( ( resolve,reject )=>{
			this.pending_async_response[commandResponse.id] = {resolve,reject,commandResponse};
		})	
	}
	
	processRawCommandResponse( encodedCommandResponse ){
		let commandResponse = this.stubs.CommandResponse.decode(encodedCommandResponse);
		return this.processCommandResponse(commandResponse)
			.then( decoded => {
				return this.stubs.CommandResponse.encode(decoded).finish()
			})
	}
	
	rejectAll(err){
		Object.entries(this.pending_async_response).forEach( ([key,promise]) => {
			promise.reject(err);
			delete this.pending_async_response[key];
		})
	}

	attachToGrpcClient( grpc_client, mode = "raw" ){
		
		const method_stub = this.stubs.proto
			.lookupService("NotificationController")
			.methods
			.SubscribeToAsyncCommandUpdates;
		
		const encodedOpeningRequest = method_stub.resolvedRequestType.encode({}).finish();
		
		let serialize;
		let deserialize;
		let dataHandler;
		
		if(mode === "raw"){
			 serialize = passthrough;
			 deserialize = passthrough;
			 dataHandler = this.processRawAsyncCommandResponse;
		}
		else if(mode === "decode"){
			serialize = passthrough;
			deserialize =(encoded)=> this.stubs.AsyncCommandResponse.decode(encoded);
			dataHandler = this.processAsyncCommandResponse;
		}
		
		let stream = grpc_client.makeServerStreamRequest(
			method_stub.path,
			serialize,
			deserialize,
			encodedOpeningRequest
		);
		
		stream.on("data", dataHandler);
		stream.once("error", (err)=>{ 
			stream.off("data", dataHandler);
			this.stream = stream = null;
			this.rejectAll();
			if( this.tearing_down === true ) return;
			this.emit("error", err );
		});
	
		this.stream = stream;
		return stream;
	}
	
	// Utility to attach to gateway (this should not be in this class but at a higher level)
	hookToGrpcGatewayDefinition(gateway_definition){
		// Do async validation on methods that returns a CommandResponse.
		gateway_definition.methods.forEach(method => {
			if ( this.shouldIWatchThisMethod(method) ){
				gateway_definition.defineMethodResponseInterceptor(method, this.processRawCommandResponse);
			}
		});
	}
	
	shouldIWatchThisMethod(method){
		return ( method.resolvedResponseType === this.stubs.CommandResponse );
	}
	
	close(){
		this.tearing_down = true;
		this.stream.cancel();
		this.rejectAll();
	};
	
}

module.exports.AsyncValidator = AsyncValidator;
