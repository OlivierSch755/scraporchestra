const {MidishSubController} = require("./subController.js");

class TrackController extends MidishSubController{
	
	
	async #selectTrack(track_name){
		if( this.session.tracks.some( ({name})=>name === track_name ) === false ){ 
			throw new Error("track does not exist: "+ track_name);
		}
		const ct = await this.sendCheckedCommand(`ct ${track_name}`); // this is very vulnerable to injection
		if(ct.err.length) throw new Error("Error while selecting track: "+ ct.err.join("\n") )
	}
	
	async createTrack( name ){
		return this.enqueueOperation(async () => {
			if (typeof name !== 'string' || !name.trim()) {
				throw new TypeError("track must have a non-empty name");
			}
			const op = await this.sendCheckedCommand(`tnew ${name}`); // this is very vulnerable to injection
			return await this.refreshSessionUnsafe();
		});
	}	

	async renameTrack( old_name, new_name ){
		
		return this.enqueueOperation(async () => {
			
			if (typeof new_name !== 'string' || !new_name.trim()) {
				throw new TypeError("track must have a non-empty name");
			}
			
			await this.#selectTrack(old_name); // this is very vulnerable to injection
			await this.sendCheckedCommand(`tren ${new_name}`); // this is very vulnerable to injection
			return await this.refreshSessionUnsafe();
			
		});
	}

	async toggleMute( track_name, mute_state ){
		
		return this.enqueueOperation(async () => {
			
			const track = this.session.tracks.find( ({name})=> name === track_name );
			
			if (!track) {
				throw new TypeError("Unknown track: " + track_name);
			}
			
			if(mute_state){
				await this.sendCheckedCommand(`mute ${track.name}`); 
			}
			else {
				await this.sendCheckedCommand(`unmute ${track.name}`); 
			}
			
			return await this.refreshSessionUnsafe();
			
		});
		
	}


}

module.exports = {TrackController}