const { once } = require("node:events");
const fs = require('node:fs/promises');

const { Component, ComponentState } = require("./component.js")
const Dispatcher = require("../dispatcher.js");

const {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError
} = require("engine/component/errors");



/*
Base class for components that spawn, monitor and talk to a process
*/


class ComponentProcess extends Component{
	
	
	static bin = null;
	instance = null;
	
	
	/*
	
		call this.close( { ignore_missing_process : true } )
		if process may have been terminated before and this is running
		as a fire&forget cleanup routine
	*/
	
	
	async close(options = {}){
		
		this.state = ComponentState.CLOSING;
		let err2;
		
		if (this.instance && this.instance.exitCode === null && !this.instance.killed) {
			try{
				this.instance.kill();
				await once(this.instance, "close");
			}
			catch(err){
				err2 = new ComponentNotProperlyClosedError( `Could not kill process spawned by component ${this.name} (...suspect)` );
				err2.cause = err;
			}
		}
		else if( !options.ignore_missing_process  ){
			console.warn( new ComponentNotProperlyClosedError( `Component ${this.name} has no process to kill (...suspect)` ) )
		}
		
		this.instance = null;
		
		if( err2 ){
			this.state = ComponentState.ERROR;
			throw err2;
		}
		
		this.state = ComponentState.CLOSED;
		
	}
	
	static async verifyDependencies(){
		return await (
			fs.access( this.bin, fs.constants.F_OK)
				.then(() => true)
				.catch(() => false)
		)
	}
	
	handleClose(instance){
		instance.once("close", (e) =>{
			this.instance = null;
			
			if( this.state === ComponentState.CLOSING ) return;
			this.state = ComponentState.ERROR;
			
			const err = new ComponentUnexpectedlyTerminatedError( `Component ${this.name} process should not have exited now` );
			// this.emit("error", err ) ;
			console.error(err);
		} );	
	}
	
	handleError(instance){
		instance.once("error", (err) =>{
			this.instance = null;
			this.state = ComponentState.ERROR;
			const err2 = new ComponentError( `Component ${this.name} process error`  );
			err2.cause = err;
			// this.emit("error", err ) ;
			console.error(err2);
		});
		
	}
	
}

module.exports = { ComponentProcess };