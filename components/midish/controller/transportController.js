const {MidishSubController} = require("./subController.js");

class MidishPosition{
	constructor(){
		this.measure = 0;
		this.beat = 0;
		this.tick = 0;
	}
}

const MODES = MidishSubController.MODES;

function assertValidMeasureValue(measure){
	if(measure < 0  || Number.isSafeInteger(measure) === false ){
		throw new Error("Invalid measure: "+ measure);
	}
}

class TransportController extends MidishSubController{
	
	
	#onPositionEvent;
	
	constructor(){
		super(...arguments);
		this.#onPositionEvent = this.#_onPositionEvent.bind(this);
	}
	
	
	get transportData(){
		return this.controller.transport;
	}	
	
	get positionData(){
		return this.controller.transport.position;
	}
	
	async loopSection( start, end ){
		
		return this.enqueueOperation( async () => { 
		
			if( this.mode > MidishSubController.MODES.IDLE ){
				throw new Error("Cannot change loop mode while playing");
			}
		
			const length = end - start;
		
			await this.sendCheckedCommand(`g ${start}`); 
			await this.sendCheckedCommand(`sel ${length}`); 
			await this.sendCheckedCommand(`loop`); 
			
		});
	}
	
	async #userSwitchPlayingMode( mode, track_name ){
		await this.#switchPlayingMode(mode, track_name);
		this.transportData.mode = mode;
		this.transportData.increaseRevision();
		this.transportData.notifyChange();
	}
		
	async #switchPlayingMode( mode, track_name ){
		
		if(MODES[mode] === undefined){
			throw new Error("unknow playing mode: ", mode);
		}
		
		return this.enqueueOperation( async () => { 
		
			if( this.mode === mode ){
				return;
			}
		
			let command;
			
			switch( mode ){
				case MODES.STOP : 
					command = ()=> this.sendCommand(`s`);
				break;
				case MODES.IDLE : 
					command = ()=> this.sendCommand(`i`);
				break;
				case MODES.PLAY : 
					command = ()=> this.sendCommand(`p`);
				break;
				case MODES.RECORD : {
					command = async ()=> {
						await this.controller.trackController.selectTrackUnsafe(track_name); // only safe because we are in enqueueOperation cb
						await this.sendCommand(`r`);
					}
					break;
				}
			}
		
			await command();
		});
	}
	
	async userPlay(){
		return this.#userSwitchPlayingMode(MODES.PLAY);
	}
	
	async userStop(){
		return this.#userSwitchPlayingMode(MODES.STOP);
	}
	
	async userRecord(track_name){
		return this.#userSwitchPlayingMode(MODES.RECORD, track_name);
	}
	
	async userIdle(){
		return this.#userSwitchPlayingMode(MODES.IDLE);
	}
		
	async userIdle(){
		return this.#userSwitchPlayingMode(MODES.IDLE);
	}
	
			
	async seek(measure){
		assertValidMeasureValue(measure);
		return this.enqueueOperation( async () => { 
			await this.sendCheckedCommand(`g ${measure}`); 
		});
	}
	
	async setTempoFactor( factor ){
		
		factor = Number(factor);
		
		if(factor < 50 || factor > 200 || !Number.isSafeInteger(factor) ){
			throw new Error( "Invalid tempo factor, must be >= 50 and <= 200" )
		}
		
		return this.enqueueOperation( async () => { 
			await this.#setTempoFactor(factor)
			this.controller.config.tempo_factor = factor;
			this.transportData.tempo_factor = factor;
			this.transportData.increaseRevision();
			this.transportData.notifyChange();
		})
	}
	
	async #setTempoFactor( factor ){
		await this.sendCheckedCommand(`fac ${factor}`);
	}
			
	async init(){
		const { midishProcess, config } = this.controller;
		midishProcess.on("pos" , this.#onPositionEvent );
		if( config.tempo_factor >= 50 &&  config.tempo_factor <= 200 ){
			await this.#setTempoFactor(config.tempo_factor );
			this.transportData.tempo_factor = config.tempo_factor;
		}
		else{
			config.tempo_factor = 100;
		}
	}	
	
	// unused
	async #getTempoFactor(){
		const res = await this.sendCheckedCommand(`getfac`);
		/*
		// See https://github.com/ratchov/midish/issues/3
		// It would be nice to be able to just rely on session fac value.
		// But 1) it needs math and 2) there are rounding issues involved
		// So for now, we store the user value in project.config and restore it after session.
		// Which is exactly what user would expect to happen anyway.
		
		let factor = Number(res.data);
		factor = parseInt(10_000 / factor); 
		this.transportData.tempo_factor = factor;
		*/
	}	
	

	#_onPositionEvent( position ){
		// do not propagate data we already know about
		if( 
			position.measure === this.transportData.position.measure 
			&& position.beat === this.transportData.position.beat 
			&& position.tick === this.transportData.position.tick 
		){
			return;
		}
		
		this.positionData.position = Object.assign(new MidishPosition(), position);
		this.positionData.increaseRevision();
		this.positionData.notifyChange();
	}
	
	close(){
		this.controller.midishProcess.off("pos", this.#onPositionEvent);
	}

}

module.exports = {TransportController, MidishPosition}
