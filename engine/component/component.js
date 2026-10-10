const Dispatcher = require("../dispatcher.js");

const {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError
} = require("./errors.js");

function random_wait(){
	const wait_ms = Math.random() * 1000;
	return new Promise((resolve,reject)=>{
		setTimeout( resolve,  wait_ms);
	});
}

const {RessourceState,validateState} = require("../states.js");

class Component {
	
	// careful this is static because it's for component discovery introspection
	// use the regular non-static toJSON below is to expose state to clients

	static toJSON(){
		const watched_properties = [
			"has_web_controller", 
			"has_osc_controller"
		];
		const object = {};
		watched_properties.forEach( prop =>{
			object[prop] = this[prop];
		});
		return object;	
	}
	
	static has_web_controller = false;
	static has_osc_controller = false;
	
	
	static get_default_config =()=> {};
	
	static async installProject(){
		// await random_wait();
		return true; // not quite sure why we return true here
	}
	
	static async uninstallProject( project ){
		// await random_wait();
		return true; // not quite sure why we return true here
	}

	static async verifyDependencies(){
		return true;
	}
	
	project;
	name;
	_state = RessourceState.CLOSED;
	
	get state(){
		return this._state;
	}
	
	set state(state){
		validateState(state)
		this._state = state;
		Dispatcher.emit("component.state", {name : this.name, state} )
	}
	
	toJSON(){
		const {name, state} = this;
		return {name, state};
	}
	
	constructor(project){
		this.project = project;
		this.name = new.target.name;
	}
	
	async initialize(){
		this.state = RessourceState.LOADING;
		// spawn process and await until ready
		// await random_wait();
		
		this.state = RessourceState.READY;
	}
	
	async close(){
		this.state = RessourceState.CLOSING;
		let err2;
		// Free ressources 
		try{
			// await random_wait();
		} catch(err){
			err2 = new ComponentNotProperlyClosedError( `Could not kill process spawned by component ${this.name} (...suspect)` );
			err2.cause = err;
		}
		
		if(err2){
			this.state = RessourceState.ERROR;
			throw err2;
		}
		
		this.state = RessourceState.CLOSED;
	}
	
	
	async saveProjectSession(){
		if(this.state !== RessourceState.READY){
			throw new ComponentError("Will not save a component that has not explicitely succeeded in loading.");
		}
	}
	

	
}








module.exports = {Component};