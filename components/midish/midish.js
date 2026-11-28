const path = require('node:path');
const fs = require("node:fs/promises");
const { tmpdir } = require('node:os');
const {spawn} = require('node:child_process')
const { once } = require('node:events');

const {RessourceState} = require("engine/states");
const {Component} = require("engine/component");

const {MidishController} = require("./controller/controller.js")

const {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError
} = require("engine/component/errors");


const session_filename = "midish_session.msh";

class Midish extends Component{
	
	static has_web_controller = true;
	
	static get_default_config =()=> ( { slave:false, loop : false } );
	
	static bin = path.join(__dirname, 'bin', 'midish') ;
	static bridge_bin = path.join(__dirname, 'bin', 'midish-bridge') ;
	
	constructor( config, project, name ){
		
		super(project, config, "midish"); // will populate this.project 
		this.config = config;
		this.session_path = path.join(project.dir, session_filename);
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
		await this.controller.sessionController.importMidiFile( file_path );
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

		this.state = RessourceState.LOADING;
		this.has_session = await this.hasSession();
		
	
		// spawn alsa bridge to have a stable port
		this.bridge_instance = spawn( Midish.bridge_bin);
		
		this.bridge_instance.on("error", ()=>{
			this.state = RessourceState.ERROR;
		})
		
		
		// spawn midish process with  its protocol implementation wrapper
		try{
			this.controller = new MidishController( this.config );
			MidishController.bin = Midish.bin;
			await this.controller.init();
		}catch(err){console.log(err)}
		
		if( this.has_session ){
			try{
				await this.controller.sessionController.loadSession(this.session_path, true);
			}
			catch(err){
				this.session_restore_failed = err.message;
			}
		}
		else {
			await this.controller.sessionController.initNewSession();
		}
		this.state = RessourceState.READY;
	}

	async close(){
		
		this.state = RessourceState.CLOSING;
		
		let bridgeError;
		let controllerError;
		
		let timeout;
		
		
		if (this.bridge_instance && this.bridge_instance.exitCode === null && !this.bridge_instance.killed) {

			// close midish bridge
			try {
				const close_promise = once(this.bridge_instance, "close")  ;
				this.bridge_instance.kill();
				
				await Promise.race([
					close_promise,
					new Promise((_, reject) => {
						timeout = setTimeout(() => {
							reject(new Error("TIMEOUT: Midish Bridge could not be closed within a reasonable delay"));
						}, 1000);
					})
				]);
			}
			catch (err) {
				bridgeError = new ComponentNotProperlyClosedError(
					`Could not kill process Midish Bridge (...dangerous)`,
					{ cause: err }
				);
			}
			finally {
				clearTimeout(timeout);
			}
		}
		// close midish runtime
		try {
			await Promise.race([
				this.controller.close(),
				new Promise((_, reject) => {
					timeout = setTimeout(() => {
						reject(new Error("TIMEOUT: Midish Controller could not be closed within a reasonable delay"));
					}, 1000);
				})
			]);
		}
		catch (err) {
			controllerError = new ComponentNotProperlyClosedError(
				`Could not kill Midish Controller (...dangerous)`,
				{ cause: err }
			);
		}
		finally {
			clearTimeout(timeout);
			this.state = RessourceState.CLOSED;
		}
		
		if (bridgeError && controllerError) {
			throw new AggregateError(
				[bridgeError, controllerError],
				`Multiple errors occurred while closing component Midish`
			);
		}

		if (bridgeError) throw bridgeError;
		if (controllerError) throw controllerError;

	}
	
	async saveProjectSession(){
		await this.controller.sessionController.saveSession(this.session_path);
	}
	
	
	// This is what we expose to clients as a snapshot
	toJSON(){
		
		const data = super.toJSON();
		data.has_session = this.has_session;
		data.session_restore_failed = this.session_restore_failed;
		data.transport = this.controller?.transport;
		data.session = this.controller?.session;
		data.meta_track = this.controller?.meta_track;
		return data;
	}
	
}



module.exports = Midish;