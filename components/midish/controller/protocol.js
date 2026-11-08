const {EventEmitter} = require("node:events");
const readline = require("node:readline");

const ABANDON_TIMEOUT_MS = 5000;

class MidishProtocol extends EventEmitter{
	
	constructor( child_process ){
		
		super();
		
		this.disposed = false;
		this.ready = false;
		const cleanup_tasks = [];
		
		this.cleanup = async () => {
			if (this.teardown_result) {
				return this.teardown_result;
			}

			this.disposed = true;

			this.teardown_result = Promise.allSettled(
				cleanup_tasks.map(task => Promise.resolve().then(task))
			);

			return this.teardown_result;
		};
		
		this.currentCommand = null;
		this.startupErrors = [];
		this.started = false;
		this.commandQueue = Promise.resolve();
		
		this.child_process = child_process;
		
		const onError = error => this._fail(error);
		const onExit = (code, signal) => this._fail( new Error(`Midish exited: code=${code}, signal=${signal}`) );
		
		this.child_process.once("error",onError);
		this.child_process.once("exit", onExit);
		
		cleanup_tasks.push( ()=>{
			this.child_process.off("error",onError)
			this.child_process.off("exit",onExit)
		});
		
		
		// abort if did not manage to talk with midish after some time
		const abandon_timeout = setTimeout( _=> this._fail( new Error("Connection lost") ) , ABANDON_TIMEOUT_MS);
				
		cleanup_tasks.push( ()=>{
			clearTimeout(abandon_timeout);
		});
		
		let stdout, stderr;
		
		try{
			
			// Listen to pipes
			stdout = readline.createInterface({
				input: child_process.stdout,
				crlfDelay: Infinity,
			});
			
			cleanup_tasks.push( ()=>{
				stdout?.close();
			})
			
			stderr = readline.createInterface({
				input: child_process.stderr,
				crlfDelay: Infinity,
			});
			
			cleanup_tasks.push( ()=>{
				stderr?.close();
			})
			
			
			// stdout protocol handling
			
			const _handleStdoutLine = line => {
				
				if (line === "+ready") {
					this.ready = true;
					
					const cmd = this.currentCommand;
					
					// leave a bit of time for stderr to collect errors 
					setTimeout(() => {
						
						this.started = true;
						clearTimeout(abandon_timeout);
						
						if(!cmd) {
							this.emit("ready");
							return;
						};
						
						// extra defensive
						if (this.currentCommand === cmd) { 
							this.currentCommand = null;
						}
						
						this.emit("ready");
						cmd.resolve({
							data : cmd.stdout, 
							err : cmd.err 
						});
						
					}, 0);
					
					return;
				}

				// asynchronous verbose messages
				if (line.startsWith("+")) {
					if (line.startsWith("+pos ")) {
						const [, measure, beat, tick] = line.split(" ");
						this.emit("pos", {
							measure : Number(measure),
							beat : Number(beat),
							tick : Number(tick)
						});
					}
					// ignore unknown +messages
					return;
				}

				// normal command output
				if (this.currentCommand) {
					this.currentCommand.stdout.push(line);
				}
			}
			
			const onStdoutLine = line => {
				try {
					_handleStdoutLine(line);
				}
				catch (error) {
					this._fail(error);
				}
			};
						
			
			stdout.on("line", onStdoutLine);

			cleanup_tasks.push( ()=>{
				stdout?.off("line", onStdoutLine);
			})
			


			// stderr handling
			const onStderrLine = line => {
				if (!this.started) {
					this.startupErrors.push(line);
					return;
				}

				if (this.currentCommand) {
					this.currentCommand.err.push(line);
				}
			}
			
			stderr.on("line", onStderrLine);
			
			cleanup_tasks.push( ()=>{
				stderr?.off("line", onStderrLine);
			})
			
		}
		catch(err){
			this.cleanup();
			throw err;
		}


	
	}

	_fail(error) {
		if (this.disposed) return;

		this.disposed = true;

		if (this.currentCommand) {
			this.currentCommand.reject(error);
			this.currentCommand = null;
		}
		this.cleanup();
		this.emit("failure", error);
	}



	/*
	 * Wait until midish is ready
	 */
	_waitForReady() {
		if (this.disposed) {
			return Promise.reject(new Error("Midish process is closed"));
		}

		if (this.ready) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {

			const cleanup = () => {
				this.off("ready", onReady);
				this.off("failure", onFailure);
			};

			const onReady = () => {
				cleanup();
				resolve();
			};

			const onFailure = error => {
				cleanup();
				reject(error);
			};

			this.once("ready", onReady);
			this.once("failure", onFailure);
		});
	}
	/*
	 * Send one command and wait for completion
	 */
	sendCommand(command) {
		
		const run = this.commandQueue.then(async () => {
			if (this.disposed) {
				throw new Error("Midish process is closed");
			}

			await this._waitForReady();

			if (this.disposed) {
				throw new Error("Midish process is closed");
			}

			this.ready = false;

			return new Promise((resolve, reject) => {

				const cmd = {
					command,
					stdout: [],
					err: [],
					resolve,
					reject,
				};

				this.currentCommand = cmd;

				try {
					this.child_process.stdin.write(
						command + "\n",
						error => {
							if (error && this.currentCommand === cmd) {
								this._fail(error);
							}
						}
					);
				}
				catch (error) {
					this._fail(error);
				}
				
			});
		});

		// Keep the queue alive even if one command fails.
		this.commandQueue = run.catch(() => {});

		return run;
	}

	async close() {
		if (!this.disposed) {
			this.disposed = true;

			if (this.currentCommand) {
				this.currentCommand.reject(
					new Error("Midish process is closing")
				);
				this.currentCommand = null;
			}
		}
		await this.cleanup();
	}
		
}

module.exports = { MidishProtocol }