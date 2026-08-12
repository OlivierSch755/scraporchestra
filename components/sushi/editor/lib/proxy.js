const {EventEmitter} = require("node:events");

const grpc = require("@grpc/grpc-js");

const {passthrough} = require("./commons.js");
const Gateway = require("./gateway.js");
const {AsyncValidator} = require("./async_validation.js");
const StreamWsMultiplexer = require("./stream_ws_multiplexer.js");

const EXPECTED_API_VERSION = "1.2.0";

const emptyMetadata = new grpc.Metadata();

class SushiWebProxyServer extends EventEmitter{
	
	static EXPECTED_API_VERSION = EXPECTED_API_VERSION;
	
	constructor(sushi_proto, remote_address){
		
		super();
		
		this.why_app_is_offline = "Gateway proxy is not connected to Sushi yet.";
		this.auto_reconnect = false;
		this.ok = false
		
		const gateway_definition = Gateway.fromProto(sushi_proto);
		
		const asyncValidator = new AsyncValidator(gateway_definition.proto_root);
		asyncValidator.hookToGrpcGatewayDefinition(gateway_definition);
		
		const grpc_client = new grpc.Client( remote_address, grpc.credentials.createInsecure() );		
	
		const gateway_proxy = gateway_definition.create();	
		
	
		this.proto_json = gateway_definition.proto_root.toJSON();
		this.gateway_definition = gateway_definition;
		this.grpc_client = grpc_client;
		this.gateway_proxy = gateway_proxy;
		this.asyncValidator = asyncValidator;
		
		this.stream_multiplexer = null;
		
		gateway_proxy.handleClientStreamRequest =(encoded_client_message, method, ws)=>{
			this.stream_multiplexer.subscribe( ws, method )
			return encoded_client_message;
		}

		gateway_proxy.handleClientCancelStreamRequest =(encoded_client_message, method, ws)=>{
			this.stream_multiplexer.unsubscribe( ws, method.options.method_id )
			return encoded_client_message;
		}


		this.rawUnaryMessage = this.rawUnaryMessage.bind(this);
		gateway_proxy.handleClientUnaryMessageRequest = this.rawUnaryMessage;

		this.handleAsyncValidatorError = this.handleAsyncValidatorError.bind(this);
		this.handleClientMessage = this.handleClientMessage.bind(this);
		
		this.stubs = {
			GetSushiApiVersion : gateway_definition.methods.find( method => method.name === "GetSushiApiVersion" )
		}
		
		
	}
	
	handleClientMessage(buf,usr_ctx){
		return this.gateway_proxy.handleClientMessage(buf,usr_ctx);
	}
	
	createStreamMultiplexer(){
		this.stream_multiplexer = new StreamWsMultiplexer(this.gateway_proxy, this.grpc_client, grpc.status);
	}
	
	rawUnaryMessage(binary_payload, method){
		binary_payload = binary_payload || Buffer.alloc(0);
		return new Promise( (resolve,reject)=>{
			this.grpc_client.makeUnaryRequest(
				method.path,
				passthrough,
				passthrough,
				binary_payload,
				emptyMetadata,
				{},
				(err, res) => { 
					if (err) return reject(err);
					resolve(res);
				}
			);
		});
	}
	
	async connect(){
		console.log("Attempt to connect to Sushi...")
			

			
			// verify api version (and check if sushi is running)
			let api_version_response = null;
			try{
				// bug : client will lag a lot sometimes when reconnecting, maybe should renew client
				api_version_response = await this.rawUnaryMessage(Buffer.alloc(0), this.stubs.GetSushiApiVersion );
			}
			catch(err){
				if(err.code === grpc.status.UNAVAILABLE){
					console.warn("Sushi not found");
					this.why_app_is_offline = `Gateway proxy is not connected to Sushi GRPC server. Check if Sushi is running (and at correct address).`;
					this.reconnect_if_needed();
					return;
				}
				throw err;	// TODO : maybe should watch more error codes ? 
			}
			
			console.log("Sushi found");
			
			const remote_api_version = this.stubs.GetSushiApiVersion
				.resolvedResponseType
				.decode(api_version_response)
				.value;
			
			if(remote_api_version !== EXPECTED_API_VERSION){
				console.error("Wrong API version (will not try to reconnect)")
				this.why_app_is_offline = `Sushi was found but its API version (${remote_api_version}) does not match the gateway_proxy version (${EXPECTED_API_VERSION}).`;
				return;
			}
			
			// catch asyncCommandResponse and resolve them on the fly 
			this.asyncValidator.attachToGrpcClient( this.grpc_client );
			this.asyncValidator.once("error", this.handleAsyncValidatorError  );
			
			// we create a fresh multiplexer on each connection
			this.createStreamMultiplexer();
			
			console.log("Sushi OK");
			this.ok = true;
		
	}
	
	handleAsyncValidatorError(error){
		
		if(this.closing || this.closed ){
			return;
		}
		
		this.ok = false;
		console.log("Sushi lost");
		// Inform future clients that we are unfortunately broken.
		this.why_app_is_offline = `Gateway is no longer connected to Sushi GRPC server. Probable cause is Sushi was closed.`;
	
		// (important) cleanup opened_streams 
		this.stream_multiplexer.shutdown();
		
		this.emit("error", error );
		
		this.reconnect_if_needed();
	
	}
	
	reconnect_if_needed(){
		if(!this.auto_reconnect) return;
		setTimeout(()=>{this.connect()}, 2000);
	}

	close(){
		
		if(this.closing || this.closed) return;
		this.closing = true;
		
		this.ok = false;
		this.why_app_is_offline = `Editor was closed.`;
		
		this.asyncValidator.close();
		this.stream_multiplexer.shutdown();
		
		this.closing = false;
		this.closed = true;
	}
	

}

module.exports = {
	SushiWebProxyServer
}
