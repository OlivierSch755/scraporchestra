const { EventEmitter } = require('node:events');
const path  = require('node:path');
const fs = require('node:fs/promises');

const { Component }= require("./component/component.js");
const { lookupComponent }= require("./component/utils.js");
const Dispatcher = require("./dispatcher.js");

class ProjectError {
	constructor(message){
		this.message = message;
	}
};

class InvalidProjectError extends ProjectError{};

class ProjectNotOpenedError extends ProjectError{};

class ProjectNotOpenableError extends ProjectError{};

class ProjectCloseError extends ProjectError{};

class ComponentLoadError extends ProjectError{};

class ComponentInitError extends ProjectError{};

const ProjectState = {
	ERROR : 1,
	LOADING : 2,
	OPEN : 3,
	CLOSING : 4,
	CLOSED : 5
}


class Project extends EventEmitter {
	
	_state = ProjectState.CLOSED;
	
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
		if( !Object.values(ProjectState).includes(state) ) throw new TypeError("Invalid Component state : " + state );
		Dispatcher.emit("project.state",  state )
		this._state = state;
	}
	
	constructor( abs_path_to_project_dir){
		super();
		this.name =  path.basename( abs_path_to_project_dir );
		this.dir = abs_path_to_project_dir;  // used by components to load their own data
		this.components = {};
	}
	

	
	
	async loadConfig() {
		this.config_path = path.join(this.dir, "project.json");

		try {
			const text = await fs.readFile(this.config_path, "utf8");
			this.config = JSON.parse(text);
		} catch (err) {
			const err2 = new InvalidProjectError(
				`Failed to load ${this.config_path}`
			);
			err2.cause = err;
			throw err2;
		}

		return this;
	}
	
	loadComponents(){
		this.components = {};
		Object.entries( this.config.components ).map( ( [component_name, component_config] )=>{
			
			let component;
			try{
				// get component class definition
				let component_class = lookupComponent(component_name);
				// instantiate it
				component = new component_class( component_config, this );
				component.name = component_name;
				
				
			} catch(err){
				const err2 = new ComponentLoadError(`Failed to load component ${component_name}`);
				err2.cause = err;
				throw err2;
			}
			this.components[component_name] = component;
			
		});
		
		
	}
	
	initializeComponents() {
		return Promise.all(
			Object.values( this.components ).map(component =>
				component.initialize().catch(err => {
					
					const err2 = new ComponentInitError(
						`Failed to initialize component ${component.name}`
					);
					err2.cause = err;
					throw err2;
				})
			)
		);
	}
	
	async initialize(){
		
		if(  this.state !== ProjectState.CLOSED ) {
			throw new ProjectNotOpenableError("Project is not in a state that allows initialization");
		}
		
		this.state = ProjectState.LOADING;
		
		try{
			this.loadComponents();
			await this.initializeComponents();
		}
		catch(err){
			this.state = ProjectState.ERROR;
			throw err;
		}
		
		this.state = ProjectState.OPEN;
		
	}
	
	async close(){
		if( this.state !== ProjectState.OPEN ) {
			throw new ProjectNotOpenedError("Cannot close a project that has not been initialized");
		}
		this.state = ProjectState.CLOSING;
		
		await Promise.all(
			Object.values(this.components).map(component =>
				component.close().catch(err => {
					const err2 = new ProjectCloseError(
						`Failed to close project`
					);
					err2.cause = err;
					throw err2;
				})
			)
		);
		this.components = {};
		this.state = ProjectState.CLOSED;
	}
	
	toJSON(){
		const {name, state, config, components} = this;
		return {name, state, config, components}
	}
	
}




module.exports = {
	Project, ProjectState
}