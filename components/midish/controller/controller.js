const {spawn} = require("node:child_process");
const Dispatcher = require("engine/dispatcher");

const { DataSection } = require("engine/data_section");
const { MidishProtocol } = require("./protocol.js");
const { TrackController } = require("./trackController.js");
const { SessionController } = require("./sessionController.js");
const { TransportController, MidishPosition } = require("./transportController.js");

const dispatch_path = "component.midish";
const MODES = require("./modes.json");


class MidishController{
	
	static bin;
	#_onPositionEvent;
	
	constructor(config = {}){
		
		this.config = config;
		
		this.initialized = false;
		this.disposed = false;
				
		this.session = new DataSection (
			dispatch_path,
			"session",
			{
				tracks: [],
				filters: [],
				tap: "off",
				tapev: null,
			}
		);
		
		this.meta_track = new DataSection (
			dispatch_path,
			"meta_track",
			{
				events : {}
			}
		);
		
        this.transport = new DataSection ( 
			dispatch_path,
			"transport",
			{
				mode: MODES.STOP,
				loop: null,
				slave: null,
				tempo_factor: 100,
				position : new DataSection(
					dispatch_path,
					"position",
					{
						position : new MidishPosition()
					}
				)
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
			
			
			await this.sessionController.refreshSessionUnsafe();
			
			await this.transportController.init();
			
			await this.initDevices();
			await this.initNewSession(); // todo
			
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
		
		try{
			this.transportController.close();
		}
		finally{
			try {
				
				if(this.midishProcess){
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
	
	async initDevices(config){
		await this.midishProcess.sendCommand(`dnew 0 "Midish-Transport:2" wo`);
		await this.midishProcess.sendCommand(`dnew 1 "Midish-Transport:3" ro`);
		// await this.setSlaveMode( (config.slave ?? false ) );
		// await this.toogleLoop( (config.loop ?? false ) );
	}
	async initNewSession(){
		// await this.midishProcess.sendCommand(`fnew default`);
		// await this.midishProcess.sendCommand(`fmap { any {1 0..15} } { any {0 0..15} }`);
	}

	
}

module.exports = { MidishController }