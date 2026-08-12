const path = require('node:path');
const fs = require('node:fs/promises');
const process = require('node:process');
const { EventEmitter, once } = require('node:events');
const { Project }= require("./project.js")
const Dispatcher = require("./dispatcher.js")

class ProjectManagerError extends Error{};

class ProjectNotFoundError extends ProjectManagerError {};

class ProjectManager {
	
    constructor(projects_dir) {
        this.projects = [];
		this.projects_dir = projects_dir;
    }

    async init() {
        this.projects = await this.scan();
		return this;
    }
	
	async scan(){
		const projects = [];
		const entries = await fs.readdir( this.projects_dir, { withFileTypes: true } );
		for( const entry of entries ){
			if (entry.isDirectory()) {
				projects.push(entry.name);
			}
		}
		this.last_scan = Date.now(); 
		return projects;
	}
	
	async createProject( name, optional_config = {} ){
		
		
		if (!/^[A-Za-z0-9_-]+$/.test(name)) {
			throw new ProjectManagerError("Invalid project name");
		}
				
		
		const abs_path_to_project_dir = this.getProjectPath(name);
		const empty_project_config = Project.getEmptyConfig();
		
		const project_config = { ...empty_project_config, ...optional_config };
		project_config.name = name;
		
		try{
			await fs.mkdir( abs_path_to_project_dir );
			await fs.writeFile( 
				path.join( abs_path_to_project_dir, "project.json"),
				JSON.stringify( project_config )
			)
		}
		catch(err){
			if(err.code === 'EEXIST') throw new Error("A project already exists with this name");
			const err2 = new Error("Unexpected error while creating project " + name);
			err2.cause = err;
			throw err2;
		}
		Dispatcher.emit("project_manager.new", name)
		this.projects.push(name);
	}
	
	async deleteProject(name){
		
		const projectsRoot = path.resolve(this.projects_dir);
		const projectDir = path.resolve(this.getProjectPath(name));

		// Ensure projectDir is actually inside projectsRoot
		const relative = path.relative(projectsRoot, projectDir);

		if (
			relative === "" ||                 // trying to delete the root itself
			relative.startsWith("..") ||       // outside the root
			path.isAbsolute(relative)          // different drive 
		) {
			throw new ProjectManagerError(`Refusing to delete unsafe path: ${projectDir}`);
		}

		const projectJson = path.join(projectDir, "project.json");

		try {
			await fs.access(projectJson);
		} catch {
			throw new ProjectManagerError("Not a valid project directory");
		}
				
		
		await fs.rm(projectDir, { recursive: true, force: true });
		
		let path_to_config = path.join(this.getProjectPath(name), "project.json");
		// need to test this
		delete require.cache[ path_to_config ];
		
		this.projects = this.projects.filter( p => p !== name)
		
		
	}
	
	
	async getProject(name){
		let project;
		let abs_path_to_project_dir = this.getProjectPath(name)

		try{
			project = new Project( abs_path_to_project_dir )
			await project.loadConfig();
		}
		catch(err){
			const err2 = new ProjectManagerError(`Project not found : ${name}`);
			err2.cause = err;
			throw err2;
		}
		return project;
	}
	
	getProjectPath(name){
		return path.join( this.projects_dir, name );
	}
	
	
	async saveProjectSession( project ){
		
		const errs = [];
		
		const component_save_result = await Promise.allSettled(
			Object.values(project.components).map( c => c.saveProjectSession() )
		);

		for ( const result of component_save_result ) {
			if ( result.status === "rejected" ) {
				errs.push( new ProjectManagerError("Could not save component session", {
					cause: result.reason
				}));
			}
		}

		try{
			await this.saveProjectConfig(project.name, project.config);
		}
		catch(err){
			const err2 = new ProjectManagerError(`Could not save project config : ${project.name}`);
			err2.cause = err;
			errs.push(err2);
		}

		switch(errs.length){
			case 1 : throw errs[0];
			case 2 : throw new AggregateError(errs)
		}
		
	}
	
	async saveProjectConfig( project_name, project_config ){
		
		let path_to_config = path.join(this.getProjectPath(project_name), "project.json");
		
		project_config.last_edited = new Date();
		
		// need to test this
		delete require.cache[ path_to_config ];
		
		await fs.writeFile( 
			path.join( path_to_config ),
			JSON.stringify(project_config)
		)
	}
	
	
}



module.exports = {
	ProjectManager
}
