const { once } = require("node:events");
const fs = require('node:fs/promises');

const Dispatcher = require("../dispatcher.js");
const { Component } = require("./component.js")
const {RessourceState} = require("engine/states");

const {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
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
		
		this.state = RessourceState.CLOSING;
		let err2;
		
		if (this.instance && this.instance.exitCode === null && !this.instance.killed) {
			try{
				this.instance.kill();
				await once(this.instance, "close");
			}
			catch(err){
				err2 = new ComponentNotProperlyClosedError( `Could not kill process spawned by component ${this.name} (danger)` );
				err2.cause = err;
			}
		}
		else if( !options.ignore_missing_process  ){
			const warning =  new ComponentNotProperlyClosedError( `Component ${this.name} has no process to kill when asked to close (suspect)` );
			Dispatcher.emit("component.warning", {component : this, warning} ); // this is used nowhere so far
		}
		
		this.instance = null;
		
		if( err2 ){
			this.state = RessourceState.ERROR;
			throw err2;
		}
		
		this.state = RessourceState.CLOSED;
		
	}
	
	static async verifyDependencies(){
		return await (
			fs.access( this.bin, fs.constants.F_OK)
				.then(() => true)
				.catch(() => false)
		)
	}
	
	handleClose(instance){
		instance.once("close", (event) =>{
			this.instance = null;
			if( this.state === RessourceState.CLOSING ) return;
			this.state = RessourceState.ERROR;
			const error = new ComponentUnexpectedlyTerminatedError( `Component ${this.name} process exited unexpectedly` );
			error.closeEvent = event;
			Dispatcher.emit("component.error", {component : this, error} ); // this is used nowhere so far
		} );	
	}
	
	handleError(instance){
		instance.once("error", (err) =>{
			this.instance = null;
			this.state = RessourceState.ERROR;
			const error = new ComponentError( `Component ${this.name} process error` );
			error.cause = err;
			Dispatcher.emit("component.error", {component : this, error} ); // this is used nowhere so far
		});
		
	}
	
}

module.exports = { ComponentProcess };