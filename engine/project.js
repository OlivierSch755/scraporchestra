const path  = require('node:path');
const fs = require('node:fs/promises');
const os = require("node:os");

const {Component, gracefulComponentClose} = require("./component/component.js");
const {lookupComponent} = require("./component/utils.js");
const ComponentErrors = require("./component/errors.js");

const {RessourceState,validateState} = require("./states.js");
const {ScrapOrchestraError} = require("../lib/errors.js");

const Dispatcher = require("./dispatcher.js");

class CorruptedProjectConfigError extends ScrapOrchestraError {
    constructor(message, options) {
        super("OPERATION_FAILED", message, options);
    }
}

class ProjectNotOpenedError extends ScrapOrchestraError {
    constructor(message, options) {
        super("NOT_INITIALIZED", message, options);
    }
}

class CannotInitializeProjectNowError extends ScrapOrchestraError {
    constructor(message = "Project is not in a state that allows initialization", options) {
        super("BUSY", message, options);
    }
}


class Project {
	
	_state = RessourceState.CLOSED;
	
	name;
	config;
	dir;
	components;
	
	static getEmptyConfig(){
		return {
			"components": {},
			"description" : "",
			"tags" : [],
			"creation_date": new Date(),
			"last_edited": new Date()
		}
	}
	
	get state(){
		return this._state;
	}
	
	set state(state){
		validateState(state);
		Dispatcher.emit("project.state",  state )
		this._state = state;
	}
	
	constructor( abs_path_to_project_dir){
		this.name = path.basename( abs_path_to_project_dir );
		this.save_dir = abs_path_to_project_dir; // real path to saved data
		this.dir // used by components to load their own data (temporary directory)
		this.initialized = false;
		this.components = {};
		this.componentRuntimeStateChangeHandler = this.componentRuntimeStateChangeHandler.bind(this); // cb for component state change
	}
	
	
	async loadConfig() {
		this.config_path = path.join(this.save_dir, "project.json");

		try {
			const text = await fs.readFile(this.config_path, "utf8");
			this.config = JSON.parse(text);
			// needs validation here
		} 
		catch (err) {
			throw new CorruptedProjectConfigError(
				`Project ${this.name} configuration file is corrupted`, 
				{ cause : err }
			);
		}

		return this;
	}
	
	loadComponents(){
		this.components = {};
		Object.entries( this.config.components ).forEach( ( [component_name, component_config] )=>{
			// get component class definition (will throw if not found or invalid)
			let component_class = lookupComponent(component_name);
			// instantiate it
			let component = new component_class( component_config, this );
			component.name = component_name;
			
			this.components[component_name] = component;
			
		});
	}
	
	initializeComponents() {
		return Promise.allSettled(
			Object.values( this.components ).map( async component => {
				try{
					await component.initialize()
				}
				catch(err){
					throw new ComponentInitError(
						`Failed to initialize component ${component.name}`,
						{ cause : err}
					);
				}
			}
			)
		);
	}
	
	// handler for component state change after initialization 
	componentRuntimeStateChangeHandler(){
		
		// If any component is in error state, then whole project inherits error state
		const has_error = Object.values( this.components ).some( component => component.state === RessourceState.ERROR );
		const still_loading =  Object.values( this.components ).some( component => component.state === RessourceState.LOADING );
		
		if( has_error && !still_loading ){
			this.state = RessourceState.ERROR;
			return;
		}
		
		// If all component is in ready state, then whole project also becomes ready
		const all_open = Object.values( this.components ).every( component => component.state === RessourceState.READY );
		
		if( all_open ){
			this.state = RessourceState.READY;
			return;
		}
		
	}
	
	async initialize(){
		if(  this.state !== RessourceState.CLOSED ) {
			throw new CannotInitializeProjectNowError();
		}
		
		this.state = RessourceState.LOADING;
		
		// create a temporary directory to hold runtime modification to project
		this.dir = await fs.mkdtemp(
			path.join(os.tmpdir(), "scraporchestra-project-"+this.name+ "-")
		);
		
		// clone project dir in temporary directory
		await fs.cp(this.save_dir, this.dir, {recursive: true});
		
			
		// Listen to components state change
		Dispatcher.on("component.state", this.componentRuntimeStateChangeHandler);
		
		// Load & initialize components
		try{

			this.loadComponents();
			await this.initializeComponents();
			
			// flag project as ready if there are no components to load
			if(Object.values( this.components ).length === 0){
				this.state = RessourceState.READY;
				return;
			}
			
		}
		catch(err){
			this.state = RessourceState.ERROR;
			throw err;
		}
		finally{
			this.initialized = true;
		}
	}
	
	async close(){
		if( this.initialized === false ) {
			throw new ProjectNotOpenedError("Cannot close a project that has not been initialized");
		}
		this.state = RessourceState.CLOSING;
		
		await fs.rm(this.dir, {
			recursive: true,
			force: true
		});

		Dispatcher.off("component.state", this.componentRuntimeStateChangeHandler);
		
		// create list of promises with all component close() method tasks
		const close_components_tasks = Object.entries(this.components)
			.map( entry => gracefulComponentClose(...entry) );
		
		
		// wait for all close tasks to complete
		const component_close_result = await Promise.allSettled(close_components_tasks);
		
		const close_errors = component_close_result.filter( prom => prom.status === "rejected").map( rejection => rejection.reason )
		
		// do not clear project components property until closes tasks completion
		// that way UI can still monitor which component is stuck or causing error
		this.components = {};
		
		// Project abstraction shound not be in charge of handling components close errors.
		// Engine should be the one to decide what to do with those errors. 
		// Because such errors are only dangerous in that they may cause issue in next project load,
		// and making sure system is safe for loading next project is the Engine's job, not the Project session.
		// So project does not care about close error and can be considered as closed even if everything went wrong before.
		this.state = RessourceState.CLOSED;
		

		if(close_errors.length){
			throw new AggregateError(close_errors);
		}
		
		
	}
	
	// add a component to a (initialized) project  
	async addComponent(component_name){
		
		if( this.initialized === false ) {
			throw new ProjectNotOpenedError("Cannot add component to a project that has not been initialized");
		}
		
		// component is already installed in project
		if( this.config.components[component_name] ) {
			throw new ComponentErrors.ComponentAlreadyInstalledError(`Component ${component_name} is already installed in this project` ); 
		}
		
		let component_class;
		try{
			component_class = lookupComponent(component_name);
		}
		catch(err){
			throw new ComponentErrors.ComponentNotFoundError(`Component ${component_name} not found` ); 
		}
		
		
		let component_instance;
		let default_config;
		
		// Component should at least produce a default config and be able to instantiate, abort early if not
		try{
			default_config = component_class.get_default_config();
			component_instance = new component_class(default_config, this);
			component_instance.name = component_name;
		}
		catch(err){
			throw new ComponentErrors.ComponentInvalidError(`Component ${component_name} is invalid` ); 
		}
		
		// run component installation routine on this project directory
		try{
			await component_class.installProject(this);
		}
		catch(err){
			try{
				await component_class.uninstallProject(this);
			}
			finally{
				throw new ComponentErrors.ComponentInstallationError(`Component ${component_name} could not be installed in project` );
			}
		}
		
		this.components[component_name] = component_instance;
		this.config.components[component_name] = default_config;
		
		try{
			await component_instance.initialize();
		}
		catch(err){
			let component = this.components[component_name];
			if(component){
				component.state = RessourceState.ERROR;
			}
			throw err;
		}
	}
	
	// add multiple components to a (initialized) project
	async addComponents(list_of_components_name){
		for(let component_name of list_of_components_name){
			await this.addComponent(component_name);
		}
	}
	
	async removeComponent(component_name){
		if( this.initialized === false ) {
			throw new ProjectNotOpenedError("Cannot remove component from a project that has not been initialized");
		}
		// component is not installed in project
		if( !this.config.components[component_name] ) {
			throw new ComponentErrors.ComponentNotFoundError(`Component ${component_name} is not installed in this project` ); 
		}
		
		let component_class = lookupComponent(component_name);
		await component_class.uninstallProject(this);
		
		const component_instance = this.components[component_name];
		delete this.config.components[component_name];
		delete this.components[component_name];
	
		// throws ComponentNotProperlyClosedError if failed
		// and engine will take appropriate action
		await gracefulComponentClose(component_name, component_instance);
	}
	
	toJSON(){
		const {name, state, config, components} = this;
		return {name, state, config, components}
	}
	
}




module.exports = {
	Project
}