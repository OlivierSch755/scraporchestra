const {ProjectManager} = require ("engine/project_manager");
const Engine = require ("./engine.js");
const Dispatcher = require ("engine/dispatcher");
const ComponentUtils = require ("engine/component/utils");
const path = require ("node:path");
const fs = require ("node:fs/promises");

class Application {
	
	engine;
	projectManager;
	components;
	Dispatcher;
	
	constructor( options = {} ){

		const scraporchestra_dir = options.dir;

		if(!scraporchestra_dir){
			throw new Error("Application directory is missing");
		}

		this.projects_dir = path.join( scraporchestra_dir, "projects");
		this.config_path = path.join( scraporchestra_dir, "config.json");

		this.engine = new Engine();
		this.Dispatcher = Dispatcher;
		this.projectManager = new ProjectManager(this.projects_dir);
	}
	
	get project(){
		return this.engine.project;
	}
	
	async setProjectAutoStart(project_name){
		// use null to clear value
		if(project_name === null){
			this.config.auto_start_project = null;
		}
		else{
			const project = await this.projectManager.getProject( project_name ); // verify project exists
			this.config.auto_start_project = project_name;
		}
		await this.write_config();
	}
	
	
	async init(){
		
		await this.init_project_dir();
		await this.init_config();
		await this.projectManager.init();
		
		// load project automatically if auto_start_project points to an existing project
		if(this.config.auto_start_project){
			const project_path = this.projectManager.getProjectPath( this.config.auto_start_project );
			try{
				await this.engine.open_project(project_path);
			} catch(err){
				console.warn("Could not autostart project",project_path, err )
			}
		}
		
		this.components = await this.getAllComponents();
		return this;
	}
	
	async init_config(){
		// load valid config.json or default to null 
		this.config = null;
		if(this.config_path ){
			this.config = this.load_config(); // will validate and load config file
		}
		// attempt to create config file if it does not exist
		if(!this.config){
			
			// default config template
			this.config = { 
				auto_start_project : null,
			};
			
			// careful here as this will overwrite any invalid config file... should at least suggest user doing backup if doing manual edit (or change this at bit)
			await this.write_config();
		}
	}
	
	// routine to load config.json
	load_config(config_path){
		try{
			const config = require(this.config_path);
			if( this.validate_config(config) ){
				return config;
			}
			return null;
		}
		catch(err){
			return null;
		}
	}
	
	async write_config(){
		await fs.writeFile(this.config_path, JSON.stringify(this.config, null, "\t") );
	}
	
	
	// todo / routine to validate config.json
	validate_config(config){
		return true;
	}
	
	async init_project_dir(){
		// attempt to create project dir if it does not exist
		await fs.mkdir(this.projects_dir, { recursive: true });
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
	// Should also be a part of project manager rather than application...
	
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