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
	
	async #switchPlayingMode( mode ){
		
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
				case MODES.RECORD : 
					command = ()=> this.sendCommand(`r`);
				break;
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
	
	async userRecord(){
		return this.#userSwitchPlayingMode(MODES.RECORD);
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
		return this.enqueueOperation( async () => { 
			await this.sendCheckedCommand(`fac ${factor}`);
			await this.#getTempoFactor();
			this.transportData.increaseRevision();
			this.transportData.notifyChange();
		})
	}
			
	async init(){
		this.#getTempoFactor();
	}	
		
	async #getTempoFactor(){
		const res = await this.sendCommand(`getfac`);
		let factor = Number(res.data);
		factor = parseInt(10_000 / factor); // see https://github.com/ratchov/midish/issues/3
		this.transportData.tempo_factor = factor;
	}	
	
	
	async #userSwitchPlayingMode( mode ){
		await this.#switchPlayingMode(mode);
		this.transportData.mode = mode;
		this.transportData.increaseRevision();
		this.transportData.notifyChange();
	}
		
	onPositionEvent( position ){
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
	

}

module.exports = {TransportController, MidishPosition}
