const {spawn} = require("node:child_process");
const Dispatcher = require("engine/dispatcher");

const { MidishProtocol } = require("./protocol.js");
const { TrackController } = require("./trackController.js");
const { SessionController } = require("./sessionController.js");
const { TransportController, MidishPosition } = require("./transportController.js");

const MODES = require("./modes.json");

class DataSection{
	
	#rev;
	#name = null; 
	
	constructor( name, default_values = {}  ){
		this.#rev = 0;
		this.#name = name;
		Object.assign(this, default_values);
	}
	
	get rev(){
		return this.#rev;
	}
	
	increaseRevision(){
		this.#rev++;
	}
	
	notifyChange(){
		// console.log(`component.midish.${this.#name}`, message)
		Dispatcher.emit(`component.midish.${this.#name}`, this);
	}
	
	toJSON(){
		return Object.assign( {rev : this.#rev}, this );
	}
}

class MidishController{
	
	static bin;
	#_onPositionEvent;
	
	constructor(){
		this.initialized = false;
		this.disposed = false;
				
		this.session =  new DataSection ( 
			"session",
			{
				tracks: [],
				filters: [],
				tap: "off",
				tapev: null,
			}
		);
		
        this.transport = new DataSection ( 
			"transport",
			{
				mode: MODES.STOP,
				loop: null,
				slave: null,
				position : new MidishPosition()
			}
		);

		this.operationQueue = Promise.resolve();
		
		this.trackController = new TrackController(this);
		this.sessionController = new SessionController(this);
		this.transportController = new TransportController(this)
	}
	
	async init(){
		
		if(this.initialized) throw new Error("already initialized");
		if(this.disposed) throw new Error("cannot re-initialize after being disposed");
		
		try{
			
			const spawn_args = ["-v"];
			this.child_process = spawn( MidishController.bin, spawn_args );
			
			this.childClosePromise = new Promise(resolve => {
				this.child_process.once("close", (code, signal) => {
					resolve({ code, signal });
				});
			});

			this.midishProcess = new MidishProtocol( this.child_process );
			
			this.midishProcess.on("failure", (err)=>{
				
				console.error("midish controller failure", err)
				this.close();
				throw new Error(err);
			})
			
			this.#_onPositionEvent = this.transportController.onPositionEvent.bind(this.transportController);
			
			this.midishProcess.on("pos" , this.#_onPositionEvent );
			await this.sessionController.refreshSessionUnsafe();
			this.initialized = true;
		
		}
		catch(err){
			try {
				await this.close();
			}
			catch(cleanupError) {
				err.cleanupError = cleanupError;
			}
			console.error(err)
			throw err;
		}
	}

	async close(){

		if(this.disposed) return;
		this.disposed = true;

		try {
			if(this.midishProcess){
				this.midishProcess.off("pos", this.#_onPositionEvent);
				await this.midishProcess.close();
			}
		}
		finally {
			const child = this.child_process;
			if (!child) return;

			if (child.exitCode === null && child.signalCode === null) {
				child.kill();
			}

			await this.childClosePromise;
		}
	}
	
	enqueueOperation(operation) {

		const run = this.operationQueue.then(async () => {

			if (this.disposed) {
				throw new Error("Controller is closed");
			}

			if (!this.initialized) {
				throw new Error("Controller is not initialized");
			}

			return await operation( this.midishProcess );

		});

		// Keep the queue alive if an operation fails.
		this.operationQueue = run.catch(() => {});

		return run;
	}
	
}

module.exports = { MidishController }