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
	
	// returns the instance of a component that is running inside a live project
	getComponentInstanceByName(name){
		return ComponentUtils.getEngineLoadedComponent( this.engine, name );
	}

}

module.exports = Application;