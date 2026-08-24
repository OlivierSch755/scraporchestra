const path = require('node:path');
const {spawn,exec} = require("node:child_process");
const fs = require("node:fs/promises");
const { tmpdir } = require('node:os');

const { once } = require('node:events');

// const {ProjectState} = require("engine/project");
const Dispatcher = require("engine/dispatcher");
const {ComponentState} = require("engine/component");
const {ComponentProcess} = require("engine/component/process");

const MidishController = require("./MidishController.js")

const {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError
} = require("engine/component/errors");


const session_filename = "midish_session.msh";

class MidishError { constructor(message){ this.message = message } }


class Midish extends ComponentProcess{
	
	static has_web_controller = true;
	
	static get_default_config =()=> ( { slave:false, loop : false } );
	
	
	static bin = path.join(__dirname, 'bin', 'midish') ;
	static bridge_bin = path.join(__dirname, 'bin', 'midish-bridge') ;
	
	constructor( config, project ){
		
		super(project); // will populate this.project 
		
		this.mclkDevId = config?.mclkDevId;
		
		this.config = config;
		
		// this is really hacky. 
		// write this.config when project tries to JSON.stringify project config object
		// will do for now
		config.toJSON = ()=>{
			return this.config
		};
		
		
		this.session_path = path.join(project.dir, session_filename);
		
		
	}
	
	async saveProjectSession(){
		await this.controller.saveSession(this.session_path);
	}
	
	
	async hasSession(){	
		try {
			await fs.access( this.session_path, fs.constants.R_OK );
			return true;
		}
		catch (err) {
			return false;
		}
	}
	

	async importMidiFileFromBuffer( buffer ){
		
		const dir_path = await fs.mkdtemp( path.join(tmpdir(), "midish" + '-') );
		const file_path = path.join(dir_path, "file.mid");
		await fs.writeFile( file_path, buffer);
		await this.controller.importMidiFile( file_path );
		
	}
	

	
	// may be useful later but not now
	/*
	async user_close(){
		if(this.editor_open) {
			return await this.close_editor(false);
		}
		await this.close();
	}
	
	async user_restart(){
		
		if(this.editor_open) {
			return await this.close_editor();
		}
		
		await this.close();
		await this.initialize();
	}
	*/
	async initialize(){
	
		this.state = ComponentState.LOADING;
		this.has_session = await this.hasSession();
		
		const spawn_args = ["-v"];
		
		// spawn midish
		this.instance = spawn( Midish.bin, spawn_args );

		this.handleClose(this.instance);
		this.handleError(this.instance);
		
		// spawn alsa bridge to have a stable port
		this.bridge_instance = spawn( Midish.bridge_bin);
		
		this.bridge_instance.on("error", ()=>{
			this.state = ComponentState.ERROR;
		})
		
		const midishController = new MidishController();
		
		midishController.on("notification", (notification)=>{
			Dispatcher.emit("component.midish.notification", notification );
		})
		
		midishController.on("config_update", (callback)=>{
			callback(this.config);
		})
		
		const readyPromise =  once(midishController, "ready");
		midishController.attachToInstance(this.instance);
		await readyPromise;
		
		
		this.controller = midishController;
		
		if( this.has_session ){
			await new Promise(r => setTimeout(r, 0));
			try{
				await this.controller.loadSession(this.session_path, true);
			}
			catch(err){
				this.session_restore_failed = err.message;
			}
		}
		else {
			await this.controller.initNewSession();
		}
		
		await this.controller.initDevices(this.config);

		
		this.controller.initialized = true;
		await this.controller.notifySessionChange();
		
		this.state = ComponentState.READY;
	}

	async close(){
		if (this.bridge_instance && this.bridge_instance.exitCode === null && !this.bridge_instance.killed) {
			try{
				this.bridge_instance.kill();
				await once(this.bridge_instance, "close");
			}
			catch(err){
				err2 = new ComponentNotProperlyClosedError( `Could not kill process spawned by component ${this.name} (...suspect)` );
				err2.cause = err;
				console.error(err2);
			}
		}
		await super.close();
	}
	
	toJSON(){
		const data = super.toJSON();
		data.has_session = this.has_session;
		data.session_restore_failed = this.session_restore_failed;
		return data;
	}
	
}



module.exports = Midish;