const { DataSection } = require("engine/data_section");

const {
	ComponentError,
	ComponentNotProperlyClosedError,
} = require("./errors.js");

function random_wait(){
	const wait_ms = Math.random() * 1000;
	return new Promise((resolve,reject)=>{
		setTimeout( resolve,  wait_ms);
	});
}

const {ResourceState,validateState} = require("../states.js");

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
	
	
	static get_default_config =()=> ({});
	
	static async installProject(){
		// await random_wait();
	}
	
	static async uninstallProject( project ){
		// await random_wait();
	}

	static async verifyDependencies(){
		return true;
	}

	project;
	config;
	name;
	_state = ResourceState.CLOSED;
	
	get state(){
		return this._state;
	}
	
	set state(state){
		validateState(state)
		this._state = state;
		this.status_api.state = state;
		this.status_api.increaseRevision();
		this.status_api.notifyChange();
	}
	
	toJSON(){
		const {name, status_api} = this;
		return {name, state : status_api};
		
		
	}
	
	constructor( config = {}, project, name ){
		this.project = project;
		this.config = config;
		this.name = name || new.target.name;
		this.status_api = new DataSection("component", "state", {name : this.name, state : this.state});
	}
	
	async initialize(){
		this.state = ResourceState.LOADING;
		// spawn process and await until ready
		// await random_wait();
		
		this.state = ResourceState.READY;
	}
	
	async close(){
		this.state = ResourceState.CLOSING;
		let err2;
		// Free ressources 
		try{
			// await random_wait();
		} catch(err){
			err2 = new ComponentNotProperlyClosedError( `Could not kill process spawned by component ${this.name} (...suspect)` );
			err2.cause = err;
		}
		
		if(err2){
			this.state = ResourceState.ERROR;
			throw err2;
		}
		
		this.state = ResourceState.CLOSED;
	}
	
	async saveProjectSession(){
		if(this.state !== ResourceState.READY){
			throw new ComponentError("Will not save a component that has not explicitely succeeded in loading.");
		}
	}
	
}

function gracefulComponentClose(component_name, component_instance){
	return component_instance.close().catch(err => {
		// flag component instance as in error state if it exists at this point
		if(component_instance){
			component_instance.state = ResourceState.ERROR;
		}
		const component_error = new ComponentNotProperlyClosedError();
		component_error.component_name = component_name;
		component_error.component_instance = component_instance;
		component_error.cause = err;
		throw component_error;
	});
}








module.exports = {Component, gracefulComponentClose};