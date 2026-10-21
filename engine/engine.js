const {Project} = require("./project.js")
const {ScrapOrchestraError} = require("../lib/errors.js");
const {RessourceState, validateState} = require("./states.js");
const Dispatcher = require("./dispatcher.js")

class EngineBusyError extends ScrapOrchestraError {
    constructor(message = "Engine is busy") {
        super("BUSY", message);
    }
}

class ProjectLoadFailure extends ScrapOrchestraError {
    constructor(message, options) {
        super("FAILED", message, options);
    }
}

class Engine {
	
	project = null;
	degraded = false;
	
	get state(){
		return this._state;
	}
	
	set state(state){
		validateState(state);
		Dispatcher.emit("engine.state", state );
		this._state = state;
	}
	
	constructor(){
		this.state = RessourceState.CLOSED;
	}
	
	verifyLoadedProject(){
		if( ! this.project || this.state === RessourceState.CLOSED ) throw new EngineBusyError("No loaded project.");
	}
	
	verifyNotBusy(){
		if( this.state === RessourceState.LOADING ) throw new EngineBusyError();
	}
	
	async open_project( abs_path_to_project_dir ){
		this.verifyNotBusy();
		if( this.project ) throw new EngineBusyError("Engine is already running a project");
		
		this.state = RessourceState.LOADING;
		let project;
		try{
			project = new Project( abs_path_to_project_dir );
			await project.loadConfig();
			this.project = project;
			
		}
		catch(err){
			this.project = null;
			this.state = RessourceState.CLOSED;
			throw new ProjectLoadFailure(
				`Engine failed to load project ${abs_path_to_project_dir}`,
				{ cause: err }
			);
		}
		
		
		
		try{
			// dispatch snapshot (what is being loaded)
			Dispatcher.emit("engine.snapshot", this);
			// initialize project
			await project.initialize();
			this.project = project;
		}
		catch(err){
			this.project = null;
			// propagate load error
			throw err;
		}
		finally{
			// set engine as ready to accept new cmd
			this.state = RessourceState.READY;
			Dispatcher.emit("engine.snapshot", this)
		}
	}

	async close_project(){
		this.verifyLoadedProject();
		this.verifyNotBusy();
		this.state = RessourceState.LOADING;
		let project = this.project;
		this.project = null;
		
		try{
			await project.close();
			Dispatcher.emit("engine.snapshot", this)
			this.state = RessourceState.CLOSED;
		}
		catch(err){
			this.handleDegradation(err);
			throw new EngineError("Engine could no close project properly, next project load may fail, reboot advised.");
		}
	}
	
	async safeAddComponentsToProject(list_of_components_names){
		this.verifyLoadedProject();
		this.verifyNotBusy();
		this.state = RessourceState.LOADING;
		try{
			await this.project.addComponents(list_of_components_names);
		}
		catch(err){
			throw err;
		}
		finally{
			this.state = RessourceState.READY;
		}
	}
	
	async safeRemoveComponentFromProject(component_name){
		this.verifyLoadedProject();
		this.verifyNotBusy();
		this.state = RessourceState.LOADING;
		try{
			await this.project.removeComponent(component_name);
		}
		catch(err){
			throw err;
		}
		finally{
			this.state = RessourceState.READY;
			Dispatcher.emit("engine.snapshot", this);
		}
	}
	
	handleDegradation(err){
		this.degraded = true;
		this.state = RessourceState.ERROR
		
	}
	
	toJSON(){
		const  { degraded, project } = this;
		return { degraded, project }
	}
	
}

module.exports = Engine;
