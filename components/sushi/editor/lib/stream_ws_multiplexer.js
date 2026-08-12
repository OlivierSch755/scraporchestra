
/* ----------------------------------------------------------------------------------------------------
	Stream management. 

	Avoid openening a single GRPC stream per WebSocket client.
	Instead we lazily open / close them and keep them alive as long as there remains at least one 
	subscribed WS client.
	
---------------------------------------------------------------------------------------------------- */
const {passthrough} = require("./commons.js");
const kSubscription = Symbol("ws_stream_subscriptions");
class StreamWsMultiplexer {
	
	constructor(gateway, grpc_client, grpc_status) {
		this.gateway = gateway;
		this.streams = new Map(); // method_id -> stream state
		this.active = true; 
		this.grpc_status = grpc_status; 
		this.grpc_client = grpc_client; 
	}
	
	open(method) {
		
		if (!this.active) throw new Error("StreamWsMultiplexer is closed");
		
		const id = method.options.method_id;

		if (this.streams.has(id)) return this.streams.get(id);

		const stream = this.createStream(method);
		const encoder = this.gateway.createStreamEncoder(method);

		// console.log("created stream", method.name);

		const entry = {
			stream,
			encoder,
			subscribers: new Set(),
			closing : false
		};

		entry.onData = (data) => {
			
			for (const ws of entry.subscribers) {
				if (ws.readyState !== WebSocket.OPEN) continue;
				// use this if desperate for debug
				// console.log("update", method.resolvedResponseType.decode(data)) 
				ws.send(encoder(data));
			}
		};

		
		stream.on("data", entry.onData);

		stream.once("error", (err) => {
			this.teardown(id);
			if(
				err.code === this.grpc_status.CANCELLED 
				|| err.code === this.grpc_status.UNAVAILABLE  // <-- Should not handle that here, instead should use a shared health monitor for app
			){
				// console.log("stream terminated", method.name);
				return;
			}
			const otherError = new Error("Unhandled GRPC stream error");
			otherError.cause = err;
			throw otherError;
		});

		this.streams.set(id, entry);
		return entry;
	}

	createStream(method){
		const encoded = method.resolvedRequestType.encode({}).finish();
		const stream = this.grpc_client.makeServerStreamRequest(
			method.path,
			passthrough,
			passthrough,
			encoded
		);
		return stream;
	}



	subscribe(ws, method) {
		
		const id = method.options.method_id;

		let subscriptions = ws[kSubscription];

		if (!subscriptions) {
			subscriptions = {
				streams: new Set(),
			};

			subscriptions.onClose = () => {
				for (const streamId of subscriptions.streams) {
					this.unsubscribe(ws, streamId);
				}
				subscriptions.streams.clear();
			};

			ws[kSubscription] = subscriptions;
			ws.once("close", subscriptions.onClose);
		}

		if (subscriptions.streams.has(id)) return;

		const entry = this.open(method);
		entry.subscribers.add(ws);
		subscriptions.streams.add(id);
	}
	
	unsubscribe(ws, id){
		const entry = this.streams.get(id);
		if (!entry) return;
		entry.subscribers.delete(ws);
		
		const subscriptions = ws[kSubscription];
		if (subscriptions) {
			subscriptions.streams.delete(id);

			if (subscriptions.streams.size === 0) {
				ws.off("close", subscriptions.onClose);
				delete ws[kSubscription];
			}
		}

		if (entry.subscribers.size === 0){
			this.teardown(id);
		}
	}
	
	teardown(id) {
		
		const entry = this.streams.get(id);
		if (!entry) return;

		if (entry.closing) return;
		entry.closing = true;

		this.streams.delete(id);
		// console.log("tearing down stream", id);
		entry.subscribers.clear();
		entry.stream.off("data", entry.onData);
		entry.stream.cancel();
	}
	
	shutdown() {
		this.active = false;
		for (const id of this.streams.keys()) {
			// console.log("teardown shutdown")
			this.teardown(id);
		}
	}
	
}

module.exports = StreamWsMultiplexer
