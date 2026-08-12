const path = require('node:path');
const {spawn,exec} = require("node:child_process");
const fs = require("node:fs/promises");

const {ProjectState} = require("engine/project");
const Dispatcher = require("engine/dispatcher");
const {ComponentState} = require("engine/component");
const {ComponentProcess} = require("engine/component/process");

const {PdEditorProxy, EditorStates, stateHr } = require("./editor/pd_live_editor.js")

const {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError
} = require("engine/component/errors");


const filename = "pure_data.pd";

class PureDataError { constructor(message){ this.message = message } }
class PureDataEditorAlreadyOpenedError extends PureDataError{};
class PureDataEditorCannotOpenError extends PureDataError{};
class PureDataEditorNotOpenedError extends PureDataError{};
class PureDataEditorCloseError extends PureDataError{};

class PureData extends ComponentProcess{
	
	static has_web_controller = true;
	
	static get_default_config =()=> require( "./default_config.json" );
	
	// Install default empty project files in project dir
	static async installProject( project ){
		await fs.copyFile( 
			path.join( __dirname, "empty.pd"),
			path.join( project.dir, filename )
		)
		return true;
	}
	
	static async uninstallProject( project ){
		await fs.unlink( path.join( project.dir, filename ) );
		return true;
	}
	
	static bin = path.join(__dirname,  "install", "bin" , "pd" );
	
	pd_version = null;
	
	editor_open = false;
	editor_backend = null;
	
	constructor( config, project ){
		
		super(project); // will populate this.project 
		
		this.midiindev = config?.midiindev;
		this.midioutdev = config?.midioutdev;
		this.abstractions_path = config?.abstractions_path;
		
		this.config = config;
		
		// this is really hacky. 
		// write this.config when project tries to JSON.stringify project config object
		// will do for now
		config.toJSON = ()=>{
			return this.config
		};
		
		
	
		this.patch_path = path.join(project.dir, filename);
	}
	
	async verifyPdFileExists(){	
		// check early if pure_data.pd exists in project dir
		try {
			await fs.access( this.patch_path, fs.constants.R_OK );
		}
		catch (err) {
			const err2 = new PureDataError( `${this.patch_path} is missing.`);
			err2.cause = err;
			throw err2;
		}
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
	
		if( this.state !== ComponentState.CLOSED ){
			throw new PureDataError("Pure Data is already running or closing");
		}
	
		this.state = ComponentState.LOADING;
		
		await this.verifyPdFileExists();
		
	
		const spawn_args = [
			`-alsamidi` // we mainly use pd for this
		];
		
		if(this.editor_open){
			spawn_args.push(`-guicmd`);
			spawn_args.push( this.editor_backend.gui_cmd_path );
			
		} else {
			spawn_args.push(`-nogui`);
		}
		
		if(this.midiindev){
			spawn_args.push(`-midiindev`);
			spawn_args.push( Array( this.midiindev ).fill().map( (_,i) => i + 1 ).join(',') );
		}
		
		if(this.midioutdev){
			spawn_args.push(`-midioutdev`);
			spawn_args.push( Array( this.midioutdev ).fill().map( (_,i) => i + 1 ).join(',') );
		}
		
		if(this.abstractions_path){
			spawn_args.push(`-path`);
			spawn_args.push(this.abstractions_path);
		}
		
		spawn_args.push(this.patch_path);
		this.instance = spawn( PureData.bin, spawn_args, {env : this.env} ); // think the env thing is an artefact of old version that should be removed

		this.handleClose(this.instance);
		this.handleError(this.instance);
		
		
		this.instance.stdout.on('data', (data) => {
			console.log("pd stdout", data.toString())
		});
		
		this.instance.stderr.on('data', (data) => {
			console.log("pd stderr", data.toString())
		});
		
		if(this.editor_open){
			await new Promise( (resolve,reject)=>{
				let watchState = (state) => {
					if(state === EditorStates.READY){
						this.editor_backend.off("state", watchState);
						resolve();
					}
				}
				this.editor_backend.on("state", watchState);
			} )
			
		}
		
		this.state = ComponentState.READY;
	}

	async open_editor(){
		
		if(this.editor_open) throw new PureDataEditorAlreadyOpenedError("PD is already running in edit mode");
		this.editor_open = true;
		
		try{
			this.editor_backend = new PdEditorProxy(); 
			this.editor_backend.on("state",  state => {
				Dispatcher.emit("component.pd.editor", state );
			})
			await this.editor_backend.start();
			await this.close();
			await this.initialize();
			
		}
		catch(err){
			const err2 = new PureDataEditorCannotOpenError("Cannot open pd editor");
			err2.cause = err;
			throw err2;
		}
		
	}
	
	// this actually closes editor and restarts in normal mode, so the component does a full cycle
	async close_editor(auto_restart = true){
		
		if( !this.editor_open ) throw new PureDataEditorNotOpenedError("Pd editor is not running");
		this.state = ComponentState.CLOSING;
		
		try{
			this.editor_backend.close();
			this.editor_open = false;
			this.editor_backend = null; 
			// ignore_missing_process means do not throw error if process is missing ( we just closed it via editor_backend.close() )
			await this.close( { ignore_missing_process : true } );
			if(auto_restart){
				await this.initialize();
			}
		}
		catch(err){
			const err2 = new PureDataEditorCloseError("Could not close PD editor properly");
			err2.cause = err;
			throw err2;
		}
		
	}
	
	
	handleClose(instance){
		
		const closeHandler = (e) =>{
			this.instance = null;
			if( this.state === ComponentState.CLOSING ){
				
				if(this.project.state === ProjectState.CLOSING && this.editor_open ){
					this.editor_backend.close();
					this.editor_backend = null; 
					this.editor_open = false;
				}
				
				return;
			}
			
			if(this.editor_open){
				
				this.close_editor().catch(err => console.dir(err,{ depth : null}))
				return;
			}
			
			this.state = ComponentState.ERROR;
			
			instance.off("close", closeHandler );	
			const err = new ComponentUnexpectedlyTerminatedError( `Component ${this.name} process should not have exited now` );
			this.emit("error", err ) ;
			
		}
		
		instance.on("close", closeHandler );	
	}
	
	
	
	toJSON(){
		const data = super.toJSON();
		data.editor_state = this.editor_backend?.state ?? EditorStates.CLOSED;
		return data;
	}
	
}



module.exports = PureData;