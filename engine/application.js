const {ProjectManager} = require ("engine/project_manager");
const Engine = require ("./engine.js");
const Dispatcher = require ("engine/dispatcher");
const ComponentUtils = require ("engine/component/utils");
const path = require ("node:path");


class Application {
	
	engine;
	projectManager;
	components;
	Dispatcher;
	
	constructor( options = {} ){

		const projects_dir = options?.projects_dir;
		if(!projects_dir){
			throw new Error("Project directory is missing");
		}

		this.engine = new Engine();
		this.Dispatcher = Dispatcher;
		this.projectManager = new ProjectManager(projects_dir);
		
		
	}
	
	get project(){
		return this.engine.project;
	}
	
	async init(){
		await this.projectManager.init();
		this.components = await this.getAllComponents();
		return this;
	}
	
	// returns the class definition of all components
	async getAllComponents(){
		return await ComponentUtils.getAllComponents();
	}
	
	// returns the instance of a component that is running inside a live project
	getComponentInstanceByName(name){
		return ComponentUtils.getEngineLoadedComponent( this.engine, name );
	}
	
	
	// add component default config to project config
	// run component install method into project dir
	
	// All those project function need a guard against user spamming buttons
	
	async addComponentsToProject( project_name, components_names ){
		
		const project = await this.projectManager.getProject( project_name );
		
		if( ! project ){
			throw { message : "Project not found : ", project_name };
		}
		
		const known_components = await ComponentUtils.getAllComponents();
		
		let sanitized = {};
		components_names.forEach( component_name => {
			
			const component_class = known_components[component_name];
			
			if( ! component_class ) return; // we don't know about this component
			if( project.config.components[component_name] ) return; // component is already in project
			
			sanitized[component_name] = component_class;
			
		});
		
		await ComponentUtils.installComponentsInProject( project, sanitized );
		await this.projectManager.saveProjectConfig(project.name, project.config);
		
		if(this.engine.project.name === project_name){
			await Promise.allSettled (
				Object.entries( sanitized ).map( ([component_name,  component_class]) => {
					const default_config = component_class.get_default_config();
					this.engine.project.config.components[component_name] = default_config;
					const component = new component_class( default_config , this.engine.project );
					component.name = component_name;
					this.engine.project.components[component_name] = component;
					return component.initialize();
					
				})
			)
		}
		
		
		Dispatcher.emit("engine.snapshot", this.engine);
	}

	async removeComponentFromProject(project_name, component_name){
		const project = await this.projectManager.getProject( project_name );
		if( ! project ){
			throw { message : "Project not found : ", project_name };
		}
		
		const component = this.components[component_name];
		
		await component.uninstallProject(project);
		delete this.engine.project.config.components[component_name];
		
		const running_instance =  this.getComponentInstanceByName(component_name) ;
		
		
		if( running_instance ){
			await running_instance.close();
			delete this.engine.project.components[component_name];
		}
		
		await this.projectManager.saveProjectConfig(project.name, this.engine.project.config);
		
		Dispatcher.emit("engine.snapshot", this.engine);
		
	}


}

module.exports = Application;