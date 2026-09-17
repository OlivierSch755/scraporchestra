const path = require('node:path');
const {spawn} = require("node:child_process");
const fs = require("node:fs/promises");

const SaveRestoreHookExec = require("./utils/save_restore.js");
const {unary, getGrpcClient} =  require("./utils/grpc_helpers.js");

const protobuf = require("protobufjs");
const grpc = require("@grpc/grpc-js");
const {AsyncValidator} = require("./editor/lib/async_validation.js");

const Dispatcher = require("engine/dispatcher");

const {ComponentState} = require("engine/component");
const {ComponentProcess} = require("engine/component/process");




const {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError
} = require("engine/component/errors");

class SushiError { constructor(message){ this.message = message } }
class SushiEditorAlreadyOpenedError extends SushiError{};
class SushiEditorNotOpenedError extends SushiError{};
class SushiEditorCannotOpenError extends SushiError{};
class SushiEditorCannotSaveSessionError extends SushiError{};
class SushiEditorCannotRestoreSessionError extends SushiError{};
class SushiEditorCloseError extends SushiError{};

// Path to sushi_rpc.proto
// as long as we are only running on Elk Audio Pi image this should work
// but it would be better to offer a way to configure that from outside 
// either env / static config file ...
const proto = new protobuf.Root().loadSync("/usr/share/sushi/sushi_rpc.proto", { keepCase : true } );


// various protobuf types (stubs) used here
const { GetSushiApiVersion } = proto.lookupService("SystemController").methods;
const { SaveSession, RestoreSession } = proto.lookupService("SessionController").methods;
const SessionState = proto.lookupType("SessionState");
const Status = proto.lookupEnum("Status").values 



// Sushi GRPC api expected version (need to confirm that even outside of editor)
// because we need to use saveSession and RestoreSession GRPC methods
const EXPECTED_API_VERSION = "1.2.0"; 

const sushi_config_filename = "sushi_config.json";
const sushi_session_filename = "sushi_session.bin";


class Sushi extends ComponentProcess{
	
	static has_web_controller = true;
	
	static get_default_config =()=> require( "./default_config.json" );
	
	static async installProject( project ){
		const fs = require("node:fs/promises");
		await fs.copyFile( 
			path.join( __dirname, "empty.json"),
			path.join( project.dir, sushi_config_filename )
		)
		return true;
	}
	
	static async uninstallProject( project ){
		const fs = require("node:fs/promises");
		await fs.unlink( path.join( project.dir, sushi_config_filename ) );
		
		try{
			const session_path = path.join(project.dir, sushi_session_filename);
			await fs.access( session_path, fs.constants.R_OK );
			await fs.unlink( session_path );
		} 
		catch(err){
			
		}
		
		return true;
	}
	
	
	// Path to sushi_rpc executable binary
	// as long as we are only running on Elk Audio Pi image this should work
	// but it would be better to offer a way to configure that from outside 
	// either env / static config file ...
	static bin = "/usr/bin/sushi";
	
	editor_open = false;
	
	constructor( config, project ){
		
		super(project); // will populate this.project 
		
		this.driver = config?.driver ?? "-r";
		this.osc_ip = config?.osc_ip ?? "127:0:0:1";
		this.env = { ...process.env, ...( config?.env ?? {} ) };
		
		this.restored_session = false;
		
		this.project = project;
		
		// May not exist yet, but if we need to create / find it, this will be where the session file is to be found.
		this.session_bin_path = path.join(this.project.dir, sushi_session_filename);
		this.sushi_config_json_path = path.join(this.project.dir, sushi_config_filename);
		
		
		this.config = config;
		// this is really hacky. 
		// write this.config when project tries to JSON.stringify project config object
		// will do for now
		config.toJSON = ()=>{
			return this.config
		};
		
	}
	
	// Here we check if we have a previously saved sushi session in this project dir.
	async getSession(){	
		let session_data;
		try {
			await fs.access( this.session_bin_path, fs.constants.R_OK );
			session_data = await fs.readFile( this.session_bin_path );
		}
		catch (err) {
			session_data = null;
		}
		return session_data;
	}
	
	
	// Save sushi session in project dir
	async saveProjectSession(){
		const client = await getGrpcClient();

		try {
			const res = await unary( client,  SaveSession );
			
			await SaveRestoreHookExec.onSessionSave(client, proto, res, this.session_bin_path + ".external.json" );
			
			// save the binary session on disk
			await fs.writeFile( 
				path.join( this.project.dir, sushi_session_filename ), 
				SessionState.encode(res).finish()
			)
		}
		catch(err) {
			const err2 = new SushiEditorCannotSaveSessionError("Cannot save session");
			err2.cause = err;
			throw err2;
		}
		finally {
			client.close();
		}
		
	}
	
	async restoreProjectSession(client){
		const session = await this.getSession();
		
		if(session){
			
			// Restoring session is a Sushi async operation, 
			// so we need to resolve the response status before we can notifiy readiness 
			const asyncValidator = new AsyncValidator(proto);
			
			// Decode flag means we want the decoded AsyncCommandResponse (instead of raw buffer that is wrapped into proxymessages for editor web client) 
			asyncValidator.attachToGrpcClient(client, "decode"); 
			
			// Call SessionController.RestoreSession 
			// res here is only an ACK for the request, the task is not completed at this point
			
			const res = await new Promise((resolve, reject) => {
				client.makeUnaryRequest(
					RestoreSession.path,
					x => x,
					d => RestoreSession.resolvedResponseType.decode(d),
					session,
					new grpc.Metadata(),
					{},
					(err, res) => err ? reject(err) : resolve(res)
				);
			});
			
			// awaits for a notification matching res.id and gives the actual result
			// now we can be sure if task succeeded or not
			const result = await asyncValidator.processCommandResponse(res);
			
			if( result.status.status !== Status.SUCCESS){
				this.state = ComponentState.ERROR;
				// cleanup, we do not want a stray GRPC stream taking resources.
				asyncValidator.close();
				throw new SushiEditorCannotRestoreSessionError("Cannot restore Sushi Session");
			}
			
			// restore external data if we have some
			
			try{
				await SaveRestoreHookExec.onSessionRestore(client, proto, session, this.session_bin_path + ".external.json");
			}
			catch(err){
				console.warn("error while restoring external data in session", err)
			}
			
			// cleanup, we do not want a stray GRPC stream taking resources.
			// we could close it earlier but I hope someday it will be useful in onSessionRestore.
			asyncValidator.close();
			
			// user might be interested in knowing whether current Sushi instance was loaded from a restored binary session or a json config file.
			this.restored_session = true;
			
		} else {
			console.log("No Sushi session restored")
		}
	}
	
	
	// Start sushi and make sure everything is ok then report
	async initialize(){
		
		this.state = ComponentState.LOADING;
		
		const spawn_args = [
			this.driver,
			`-c`, path.join( this.sushi_config_json_path ),
			'--osc-send-ip', this.osc_ip,
			// '--no-osc',
			// '--log-level',"debug"
		];
		
		
		// This shows copy/pastable cmd that was used to spawn sushi when called
		this._debug_string = (()=>{
			let txt = Sushi.bin;
			let args = "";
			spawn_args.forEach(arg=> args += ( " " + arg ));
			return txt + args
		})();
		
		this.instance = spawn( Sushi.bin, spawn_args, { env : this.env } );
		
		this.instance.stderr.on("data", d => console.log( 'SUSHI Err', d.toString() ) )
		// this.instance.stdout.on("data", d => console.log( 'SUSHI stdout', d.toString() ))
		
		// Automatic handling of error and close events (uses this.state to watch if close event is expected or anormal)
		this.handleClose(this.instance);
		this.handleError(this.instance);
		
		
		
		// Do GRPC waitForReady + call GetSushiApiVersion to make sure sushi is live 
		
		const client = await getGrpcClient();
		const version_res = await unary(client, GetSushiApiVersion);

		if (version_res.value !== EXPECTED_API_VERSION) {
			throw new Error("Api version mismatch");
		}
			
		// If we have a previously saved session, we restore it	
		await this.restoreProjectSession(client);
		
		client.close();
		this.state = ComponentState.READY;
		
		
	}
	
	async open_editor( wss ){
		
		if(this.editor_open) throw new SushiEditorAlreadyOpenedError("Sushi editor is already running");
		this.editor_open = true;
		
		const editor_module = require("./editor/sushi_live_editor.js");
		
		try{
			this.editor_backend = editor_module.startSushiWebEditorBackend(proto , wss );
			
			this.editor_backend.proxy.once("error", (err)=>{
				this.state = ComponentState.ERROR;
			})
			
			await this.editor_backend.proxy.connect();
			Dispatcher.emit("component.sushi.editor", true );
		}
		catch(err){
			const err2 = new SushiEditorCannotOpenError("Cannot open sushi editor");
			err2.cause = err;
			throw err2;
		}
		
		/*
			probably needs more error handling here 
		*/
		
		
	}
	
	close_editor(){
		
		if( !this.editor_open ) throw new SushiEditorNotOpenedError("Sushi editor is not running");
		try{
			this.editor_backend.close();
			this.editor_open = false;
			this.editor_backend = null; // allow ressources to be garbage collected
			Dispatcher.emit("component.sushi.editor", false );
		}
		catch(err){
			const err2 = new SushiEditorCloseError("Could not close Sushi editor properly");
			console.log(err)
			err2.cause = err;
			throw err2;
		}
		
	}
	
	async close(){
		if( this.editor_open ) this.close_editor();
		await super.close();
	}
	
	toJSON(){
		const data = super.toJSON();
		data.editor_open = this.editor_open;
		return data;
	}
}






module.exports = Sushi;