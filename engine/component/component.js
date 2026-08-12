const { EventEmitter, once } = require('node:events');
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

const ComponentState = {
	ERROR : 1,
	LOADING : 2,
	READY : 3,
	CLOSING : 4,
	CLOSED : 5
}

class Component extends EventEmitter {
	
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
	_state = ComponentState.CLOSED;
	
	get state(){
		return this._state;
	}
	
	set state(state){
		if( !Object.values(ComponentState).includes(state) ) throw new TypeError("Invalid Component state : " + state );
		Dispatcher.emit("component.state", {name : this.name, state} )
		this._state = state;
	}
	
	toJSON(){
		const {name, state} = this;
		return {name, state};
	}
	
	constructor(project){
		super();
		this.project = project;
		this.name = new.target.name;
	}
	
	async initialize(){
		this.state = ComponentState.LOADING;
		// spawn process and await until ready
		// await random_wait();
		
		this.state = ComponentState.READY;
	}
	
	async close(){
		this.state = ComponentState.CLOSING;
		let err2;
		// Free ressources 
		try{
			// await random_wait();
		} catch(err){
			err2 = new ComponentNotProperlyClosedError( `Could not kill process spawned by component ${this.name} (...suspect)` );
			err2.cause = err;
		}
		
		if(err2){
			this.state = ComponentState.ERROR;
			throw err2;
		}
		
		this.state = ComponentState.CLOSED;
	}
	
	
	async saveProjectSession(){
		if(this.state !== ComponentState.READY){
			throw new ComponentError("Will not save a component that has not explicitely succeeded in loading.");
		}
	}
	

	
}








module.exports = {Component, ComponentState};