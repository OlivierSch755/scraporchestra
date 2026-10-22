/*

Engine class

Its main jobs are:

- Being the source of truth about current project operational state
- Monitoring errors to make sure system is stable before loading next project

It should be in READY state to indicate that system state is safe to perform project operation 
	Most of those operations are usually non-trivial async jobs, like filesystem I/O or child-processes management.
	
This "supervisor-like" class is needed here to guard against conflicting operations being executed at the same time.
And to fail early when the system is no longer considered safe to operate, so user may take appropriate action like rebooting. 

*/



const {Project} = require("./project.js")
const {ScrapOrchestraError} = require("../lib/errors.js");
const ComponentErrors = require("./component/errors.js");
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

class EngineDegradedError extends ScrapOrchestraError {
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
	
	verifyNotDegraded(){
		if( this.state === RessourceState.ERROR || this.degraded ) throw new EngineBusyError("Engine is degraded.");
	}
	
	verifyLoadedProject(){
		if( ! this.project || this.state === RessourceState.CLOSED ) throw new EngineBusyError("No loaded project.");
	}
	
	verifyNotBusy(){
		if( this.state === RessourceState.LOADING ) throw new EngineBusyError();
	}
	
	async open_project( abs_path_to_project_dir ){
		this.verifyNotDegraded();
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
		this.verifyNotDegraded();
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
			this.handleCloseComponentError(err);
		}
	}
	
	async safeAddComponentsToProject(list_of_components_names){
		this.verifyNotDegraded();
		this.verifyLoadedProject();
		this.verifyNotBusy();
		this.state = RessourceState.LOADING;
		try{
			await this.project.addComponents(list_of_components_names);
		}
		finally{
			this.state = RessourceState.READY;
		}
	}
	
	async safeRemoveComponentFromProject(component_name){
		this.verifyNotDegraded();
		this.verifyLoadedProject();
		this.verifyNotBusy();
		this.state = RessourceState.LOADING;
		try{
			await this.project.removeComponent(component_name);
		}
		catch(err){
			this.handleCloseComponentError(err);
		}
		this.state = RessourceState.READY;
		Dispatcher.emit("engine.snapshot", this);
	}
	
	// This must be executed after any action that may close a component (and fail to do so)
	// (removing component from project, closing project)
	handleCloseComponentError(err){
		
		let degraded_flag = false;
		let degraded_report = {
			components : {},
			unexpected_errors : []
		};
		
		function testError(error){
			// This error specifically means that ressources have not been cleaned properly.
			// So immediate degradation.
			if(error instanceof ComponentErrors.ComponentNotProperlyClosedError){
				degraded_flag |= true;
				degraded_report.components.component_name = error.component_instance;
				return;
			}
			
			// If error is not one of our own Application error, assume something went terribly wrong.
			// Also immediate degradation.
			if(! error instanceof ScrapOrchestraError){
				degraded_flag &= true;
				degraded_report.unexpected_errors.push( error.component_instance );
				return;
			}
		}
		
		try{
			// may be AggregateError if it came from a project.close() method (many components failed).
			if(err instanceof AggregateError){
				for(let error of err.errors){
					testError(error);
				}
			}
			else {
				testError(err);
			}
		}
		catch(nested_error){
			// if error checking above failed, assume everything is broken.
			degraded_flag |= true;
		}
		finally{
			if(degraded_flag){
				this.degraded = true;
				this.state = RessourceState.ERROR;
				this.degraded_report = degraded_report;
				const degradedError = new EngineDegradedError("Engine Degraded. Last operation left some stray resources running, next project load may fail, reboot advised.");
				degradedError.cause = err;
				throw degradedError;
			}
		}
	}
	
	toJSON(){
		const  { degraded, project } = this;
		return { degraded, project }
	}
	
}

module.exports = Engine;
