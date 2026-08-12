const util = require('node:util');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Project }= require("./project.js")
const Dispatcher = require("./dispatcher.js")

class EngineError {
	constructor(message){
		this.message = message;
	}
};

class EngineDegradedError extends EngineError {};

class EngineBusyError extends EngineError {};

class ProjectLoadFailure extends EngineError {};


const EngineState = {
	ERROR : 1,
	LOADING : 2,
	READY : 3,
	CLOSING : 4,
	CLOSED : 5
}


class Engine extends EventEmitter {
	
	project = null;
	degraded = false;
	
	get state(){
		return this._state;
	}
	
	set state(state){
		if( !Object.values(EngineState).includes(state) ) throw new TypeError("Invalid Component state : " + state );
		Dispatcher.emit("engine.state", state );
		this._state = state;
	}
	
	async open_project( abs_path_to_project_dir ){
		
		if( this.project ) throw new EngineBusyError("Engine is already running a project");
		
		if(  this.state === EngineState.LOADING ) {
			 throw new EngineBusyError("Engine is already loading a project");
		}
		
		this.state = EngineState.LOADING;
		
		let project;
		
		try{
			project = new Project( abs_path_to_project_dir );
			await project.loadConfig();
			this.project = project;
			
		}
		catch(err){
			this.project = null;
			this.state = EngineState.CLOSED;
			const err2 = new ProjectLoadFailure(`Engine failed to load project ${abs_path_to_project_dir}`);
			err2.cause = err;
			throw err2;
		}
		
		try{
			Dispatcher.emit("engine.snapshot", this);
			await project.initialize();
			this.project = project;
			this.state = EngineState.READY;
			Dispatcher.emit("engine.snapshot", this);
		}
		catch(err){
			this.project = null;
			this.state = EngineState.READY;
			Dispatcher.emit("engine.snapshot", this)
			throw err;
		}
		
	
	}
	
	async close_project(){
		
		let project = this.project;
		
		if( ! this.project ) throw new EngineError("Engine has no project to close.");
		if( this.state === EngineState.CLOSED ) throw new EngineBusyError( "Engine is already closing." );
		
		this.state = EngineState.CLOSING;
		this.project = null;
		
		try{
			await project.close();
			Dispatcher.emit("engine.snapshot", this)
			this.state = EngineState.CLOSED;
		}
		catch(err){
			this.state === EngineState.ERROR
			const err2 = new EngineDegradedError("Engine could not close project properly.");
			err2.cause = err;
			err2.project = project;
			this.degraded = true;
			this.degradedCallback(err2);
		}
	}
	
	degradedCallback(degradedError){
		const err = new Error("Engine is now degraded..., some ressources may not have been cleaned up properly. Next project start may fail. Reboot advised.");
		err.cause = degradedError;
		throw err;
	}
	
	toJSON(){
		const  { degraded, project } = this;
		return { degraded, project }
	}
	
}

module.exports = Engine;
