const path = require('node:path');
const fs = require('node:fs/promises');
const { Project }= require("./project.js")
const Dispatcher = require("./dispatcher.js")
const {ScrapOrchestraError} = require("../lib/errors.js");


class ProjectAlreadyExistsError extends ScrapOrchestraError {
    constructor(message = "A project already exists with this name") {
        super("ALREADY_EXISTS", message);
    }
}

class ProjectCreationFailureError extends ScrapOrchestraError {
    constructor(message = "Could not create project", options) {
        super("FAILED", message, options);
    }
}

class ProjectManagerError extends ScrapOrchestraError {
    constructor(message, options) {
        super("FAILED", message, options);
    }
}

class ProjectManagerNotInitializedError extends ScrapOrchestraError {
    constructor(message, options) {
        super("NOT_INITIALIZED", message, options);
    }
}

class ProjectSessionSaveError extends ScrapOrchestraError {
    constructor(message, options) {
        super("FAILED", message, options);
    }
}

class ProjectNotFoundError extends ScrapOrchestraError {
    constructor(message = "Project not found", options) {
        super("NOT_FOUND", message, options);
    }
}

class InvalidProjectNameError extends ScrapOrchestraError {
    constructor(message = "Invalid project name", options) {
        super("INVALID_ARGUMENT", message, options);
    }
}


class ProjectManager {
	
    constructor(projects_dir) {
        this.projects = [];
		this.projects_dir = projects_dir;
		this.initialized = false;
    }

    async init() {
        this.projects = await this.scan();
		this.initialized = true;
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
	
		this.validateProjectName(name); // check project name is valid (will throw if not)
		
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
			if(err.code === 'EEXIST') throw new ProjectAlreadyExistsError();
			throw new ProjectCreationFailureError("Unexpected error while creating project", { cause : err } );
		}
		
		Dispatcher.emit("project_manager.new", name)
		this.projects.push(name);
	}
	
	async duplicateProject( name, new_name ){
		const project = this.getProject(name); // check project exists (will throw if not)
		new_name = new_name || name + "_copy";
		// verify destination name does not collide with another project
		const name_already_exists = await this.getProject(new_name, true);
		if(name_already_exists){
			throw new ProjectAlreadyExistsError(`Please rename previous project duplicate before making a new one : ${new_name}`);
		}
		const old_path = this.getProjectPath(name);
		const new_path = this.getProjectPath(new_name);
		await fs.cp(old_path, new_path, {recursive: true});
		this.projects.push(new_name);
	}
	
	async renameProject( old_name, new_name ){
		await this.duplicateProject(old_name, new_name)
		await this.deleteProject(old_name);
	}
	
	async deleteProject(name){
		
		// do not blindly delete directories that have not been scanned before
		if(!this.initialized){
			throw new ProjectManagerNotInitializedError();
		}
		
		// throws if input is not sane
		this.validateProjectName(name);

		if( !this.projects.includes(name) ){
			throw new ProjectNotFoundError(`Project not found : ${name}`);
		}
		
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
		} catch(err) {
			throw new ProjectManagerError("Not a valid project directory");
		}
				
		
		await fs.rm(projectDir, { recursive: true, force: true });
		
		let path_to_config = path.join(this.getProjectPath(name), "project.json");
		// need to test this
		delete require.cache[ path_to_config ];
		
		this.projects = this.projects.filter( p => p !== name)
		
	}
	
	async getProject(name, do_not_throw = false){
		let project;
		let abs_path_to_project_dir = this.getProjectPath(name)

		try{
			project = new Project( abs_path_to_project_dir )
			await project.loadConfig();
		}
		catch(err){
			if(do_not_throw) return null;
			throw new ProjectNotFoundError(
				`Project not found : ${name}`,
				{ cause : err }
			);
		}
		return project;
	}
	
	getProjectPath(name){
		return path.join( this.projects_dir, name );
	}
	
	async saveProjectSession(project) {
		const errs = [];

		const components = Object.entries(project.components);

		const results = await Promise.allSettled(
			components.map(async ([name, component]) => {
				try {
					await component.saveProjectSession();
				} catch (cause) {
					throw new ProjectManagerError(
						`Could not save session for component: ${name}`,
						{ cause }
					);
				}
			})
		);

		for (const result of results) {
			if (result.status === "rejected") {
				errs.push(result.reason);
			}
		}
		
		await fs.cp(project.dir, this.getProjectPath(project.name), {recursive: true});
		
		try {
			await this.saveProjectConfig(project.name, project.config);
		}
		catch (cause) {
			errs.push(
				new ProjectManagerError(
					`Could not save project config: ${project.name}`,
					{ cause }
				)
			);
    }

    if (errs.length > 0) {
        const aggregate = new AggregateError(
            errs,
            `Failed to save project session: ${project.name}`
        );

        throw new ProjectSessionSaveError(
            `Could not save project session: ${project.name}`,
            { cause: aggregate }
        );
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
	
	validateProjectName(name) {
		if (
				typeof name !== "string" 
			||	!/^[A-Za-z0-9_-]+$/.test(name)
		) {
			throw new InvalidProjectNameError();
		}
	}
}



module.exports = {
	ProjectManager, 
	ProjectNotFoundError
}
