const {MidishSubController} = require("./subController.js");
const { parseConfig } = require("./lib/parser.js");

const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");


// there may be more errors type to be wary of here
const fatalImportErrors = [
    "failed to open file", 
	"header corrupted"
];


class SessionController extends MidishSubController{
	
	
	async getSession(){
		return this.enqueueOperation(() => this.getSessionUnsafe());
	}

	async getSessionUnsafe() {
		
		if ( this.sessionPromise ) return this.sessionPromise;

		this.sessionPromise = (async () => {

			const ls_result = await this.sendCommand("ls");
			const parsed = parseConfig(ls_result.data);
			
			this.controller.session.tracks = parsed.tracklist;
			this.controller.session.filters = parsed.filtlist;
			this.controller.session.tap = parsed.tap;
			this.controller.session.tapev = parsed.tapev;

			return this.controller.session;
		})();

		try {
			return await this.sessionPromise;
		} catch (error) {
			this.sessionPromise = null;
			throw error;
		}
	}
	
	// do NOT call this from outside an enqueueOperation callback ( or init function )
	async refreshSessionUnsafe() {
		this.sessionPromise = null;
		const session = await this.getSessionUnsafe();
		session.increaseRevision();
		session.notifyChange();
		return session;
	}
	
	async resetSession(){
		return this.enqueueOperation( async () => {
			await this.sendCheckedCommand(`reset`);
			await this.refreshSessionUnsafe();
			await this.controller.trackController.refreshMetaTrackUnsafe();
		} );
	}
	
	async importMidiFile(midi_filepath) {
		
		return this.enqueueOperation(async () => {
			let backup_dir;

			try {
				backup_dir = await fs.mkdtemp( path.join(os.tmpdir(), "midish_import_backup_") );

				const backup_file = path.join(backup_dir, "backup.msh");

				// Backup current session
				await this.sendCheckedCommand(`export "${backup_file}"`);

				// Import MIDI
				const res = await this.sendCommand(`import "${midi_filepath}"`);
				
				const fatalErrors = res.err.filter(msg =>
					fatalImportErrors.some(pattern => msg.includes(pattern))
				);

				if (fatalErrors.length) {
					throw new Error(
						`MIDI import failed:\n${fatalErrors.join("\n")}`
					);
				}
				
				
				/*
				Midi files exported by onemotion chord player use very high PPQN value 
				Midish does not like that. It will accept to import the midi file, but upon
				restoring the session it will refuse and complain about out of range number.
				
				To avoid this, we resize the PPQN immediately after import, which means : 
					-	We have something "safe" in memory and we can forget about this.
					- 	Conversion is not done after the user had a chance to inspect
						the session (play once) to make sure everything is ok. 
				*/
				await this.sendCheckedCommand("setunit 96");

				await this.refreshSessionUnsafe();
				await this.controller.trackController.refreshMetaTrackUnsafe();
				
				return { import_errors: res.err };
			}
			catch (err) {
				if (backup_dir) {
					try {
						const backup_file = path.join(backup_dir, "backup.msh");
						await this.sendCheckedCommand(`import "${backup_file}"`);
						await this.refreshSessionUnsafe();
					}
					catch (rollbackErr) {
						throw new Error(
							"Import failed AND session restoration failed.",
							{
								cause: new AggregateError(
									[err, rollbackErr],
									"Import and rollback errors"
								)
							}
						);
					}
				}

				throw new Error(
					"Could not import MIDI file. Previous session restored.",
					{ cause: err }
				);
			}
			finally {
				if (backup_dir) {
					await fs.rm(backup_dir, {
						recursive: true,
						force: true
					});
				}
			}
		});
	}
	
	async exportMidiFile(midi_filepath){
		return this.enqueueOperation( ()=> this.sendCheckedCommand(`export "${midi_filepath}"`) )
	}
	
	async loadSession(session_filepath){
		return this.enqueueOperation( async ()=>{ 
			await this.sendCheckedCommand(`load "${session_filepath}"`);
			await this.refreshSessionUnsafe();
			await this.controller.trackController.refreshMetaTrackUnsafe();
		} )
	}
		
	async saveSession(session_filepath){
		return this.enqueueOperation( async ()=>{ 
			await this.sendCheckedCommand(`save "${session_filepath}"`);
		} )
	}
	
	
	
}

module.exports = {SessionController}
