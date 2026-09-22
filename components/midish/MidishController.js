const { EventEmitter } = require('node:events');
const readline = require("node:readline");

const {parseFilterRules} = require("./lib/filters.js");

const Evspec = require("./lib/evspec.js");




const defaultState = {
	outlist: [],
	inlist: [],
	filtlist: [],
	tracklist: [],
	sysexlist: [],
	curout: null,
	curin: null,
	curfilt: null,
	curtrack: null,
	cursysex: null,
	curquant: null,
	curev: null,
	curpos: 0,
	curlen: 0,
	tap: null,
	tapev: null
};

const defaultPosition = {
	measure : 0,
	beat : 0,
	tick : 0,
}


/*

See Midish user manual section 21.2 

	Creating front-ends: verbose mode
	https://midish.org/manual.html#section_21_2

*/


class MidishControllerBaseClass extends EventEmitter{
	
	constructor(){
		super();
		this.ready = false;
		this.instance = null;
		this.currentCommand = null;
		this.startupErrors = [];
		this.started = false;
		this.commandQueue = Promise.resolve();
	}
	
	attachToInstance(instance){
		
		this.instance = instance;
		
		const stdout = readline.createInterface({
			input: this.instance.stdout,
			crlfDelay: Infinity,
		});

		const stderr = readline.createInterface({
			input: this.instance.stderr,
			crlfDelay: Infinity,
		});
		
		/*
		 * stdout protocol handling
		 */
		stdout.on("line", line => {

			if (line === "+ready") {
				this.ready = true;
				this.started = true;
				this.emit("ready");

				const cmd = this.currentCommand;
				if(!cmd) return;
				setImmediate(() => {
					cmd.resolve({
						stdout: cmd.stdout,
						data: cmd.data,
					});

					if (this.currentCommand === cmd) {
						this.currentCommand = null;
					}
				});

				
				return;
			}

			// asynchronous verbose messages
			if (line.startsWith("+")) {
				if (line.startsWith("+pos ")) {
					const [, measure, beat, tick] = line.split(" ");
					
					this.emit("pos", {
						measure,
						beat,
						tick,
					});
				}
				// ignore unknown +messages
				return;
			}

			// normal command output
			if (this.currentCommand) {
				this.currentCommand.stdout.push(line);
			}
		});

		/*
		 * stderr handling
		 */
		stderr.on("line", line => {
			
			if (!this.started) {
				this.startupErrors.push(line);
				return;
			}

			if (this.currentCommand) {
				this.currentCommand.data.push(line);
			}
		});

				
	}

	/*
	 * Wait until midish is ready
	 */
	waitForReady() {
		if (this.ready) {
			return Promise.resolve();
		}

		return new Promise(resolve => {
			this.once("ready", resolve);
		});
	}

	/*
	 * Send one command and wait for completion
	 */
	sendCommand(command) {
		const run = this.commandQueue.then(async () => {
			await this.waitForReady();

			this.ready = false;

			return new Promise(resolve => {
				this.currentCommand = {
					stdout: [],
					data: [],
					resolve,
				};
				console.log("midish send", command)
				this.instance.stdin.write(command + "\n");
			});
		});

		this.commandQueue = run.catch(() => {});

		return run;
	}

		
}

class MidishController extends MidishControllerBaseClass{
	
	position = {...defaultPosition};
	playing_mode = "stop";
	session_data = null;
	tracks = null;
	current_filter_definition = null;
	current_selection = {
		start : 0,
		end : 0
	}
	loop_mode = false;
	
	tapev = null;
	tap = null;
	
	tempo_factor = 100;
	
	
	
	last_emitted_position = {...defaultPosition};
	
	metronome = {
		enabled : "off",
		high : {
			device : 0,
			channel : 9,
			note : 48,
			velocity : 127
		},
		low : {
			device : 0,
			channel : 9,
			note : 64,
			velocity : 100
		},
	}
	
	
	constructor(){
		super();
		this.on("pos" , (position)=>{
			this.position = position;
			this.notifyPositionChange();
		})
	}
	
	async loadSession(file_msh, do_not_notify_yet = false){
		 const res = await this.sendCommand(`load "${file_msh}"`);
		 
		 if( res.data.length ){
			 throw {
				 message : "Could not restore midish session : " + res.data.join("\n"),
				 type : "session_restore",
			 };
		 }
		 
		 if(do_not_notify_yet) return;
		 
		 this.notifySessionChange();
	}
	
	async saveSession(session_filepath){
		const res = await this.sendCommand(`save "${session_filepath}"`);
	}
	
	async importMidiFile(midi_filepath){
		
		const res = await this.sendCommand(`import "${midi_filepath}"`);
		
		/*
			Midi files exported by onemotion chord player use very high PPQN value 
			Midish does not like that. It will accept to import the midi file, but upon
			restoring the session it will refuse and complain about out of range number.
			
			To avoid this, we resize the PPQN immediately after import, which means : 
				-	We have something "safe" in memory and we can forget about this.
				- 	Conversion is not done after the user had a chance to inspect
					the session (play once) to make sure everything is ok. 
					
		*/
		await this.sendCommand(`setunit 96`);
		
		await this.initNewSession();
		this.notifySessionChange();
	}
	
	async notifyPositionChange(){
		const last = this.last_emitted_position;
		const cur = this.position;
		if(
				last.measure !== cur.measure
			|| 	last.beat !== cur.beat
			||	last.tick !== cur.tick
		){
			this.last_emitted_position = cur;
			this.emit("notification", {
				type : "position",
				data : this.position
			});
		}
	}
	
	async notifySessionChange(){
		const current_state = await this.getSessionData(true);
		this.emit("notification", {
			type : "session",
			data : current_state
		});
	}
	
	async notifyPlayingModeChange(mode){
		this.playing_mode = mode;
		this.emit("notification", {
			type : "playing_mode",
			data : this.playing_mode
		});
	}
	
	async notifySelectionChange(){
		
		const state = this.session_data?.state;
		if(state){
			state.curpos = this.current_selection.start;
			state.curlen = this.current_selection.end;
		}
		
		this.emit("notification", {
			type : "selection",
			data : this.current_selection
		});
	}
	
	async notifyTapEvChange(){
		const state = this.session_data?.state;
		if(state){
			state.tapev = this.tapev;
			state.tap = this.tap;
		}
		this.emit("notification", {
			type : "tap",
			data : {tapev: this.tapev, tap : this.tap}
		});
	}
	
	async notifyLoopModeChange(){
		
		const loop_enabled = this.loop_mode;
		
		if(this.session_data){
			this.session_data.loop = loop_enabled;
		}
		
		this.emit("config_update", (config)=>{config.loop = loop_enabled})
		
		this.emit("notification", {
			type : "loop",
			data : loop_enabled
		});
	}
		
	async notifyMetronomeChange(){
		
		const metronome = this.metronome;
		
		if(this.session_data){
			this.session_data.metronome = metronome;
		}
		
		this.emit("config_update", (config)=>{config.metronome = metronome})
		
		this.emit("notification", {
			type : "metronome",
			data : metronome
		});
	}
	
	async notifyTempoFactorChange(){
		if(this.session_data){
			this.session_data.tempo_factor = this.tempo_factor;
		}
		
		this.emit("notification", {
			type : "tempo_factor",
			data : this.tempo_factor
		});
	}
	
	_getTrackByName(track_name){
		return this.session_data?.state?.tracklist?.find(track => track.name === track_name);
	}
	
	async setMetronome({enabled, high, low}){
		// should validate a bit here
		this.metronome = {enabled, high, low};
		
		this.metronome.high.device = 0;
		this.metronome.low.device = 0;
		
		await this.sendCommand(`metrocf { non {${high.device} ${high.channel}} ${high.note} ${high.velocity} } { non {${low.device} ${low.channel}} ${low.note} ${low.velocity} }`);
		await this.sendCommand(`m ${enabled}`);
		this.notifyMetronomeChange();
		
	}
	
	async notifyTrackMuteChange(track_name, mute_state){

		const track = this._getTrackByName(track_name);
		
		if(mute_state){
			track.flags.add("mute");
		}
		else{
			track.flags.delete("mute");
		}
		
		this.emit("notification", {
			type : "mute",
			data : {
				track_name,
				mute_state
			}
		});
	}
	
	
	async getSessionData( burst_cache = false ){
		
		if( !burst_cache && this.session_data){
			return this.session_data;
		}
		
		const length_res = await this.sendCommand(`mend`);
		const length = Number( length_res.data[0] );
		
		const meta_track_res = await this.sendCommand(`minfo`);
		const meta_track = parseMinfo(meta_track_res.data);
		
		const state_res = await this.sendCommand(`ls`);
		const state = parseConfig(state_res.data);

		this.current_selection = {
			start : state.curpos,
			end : state.curlen
		}
		
		this.tap = state.tap;
		this.tapev = state.tapev;
		
		const tempo_factor = await this.getTempoFactor();
		
		const session_data = {
			position : this.position,
			length,
			meta_track,
			state,
			playing_mode : this.playing_mode,
			loop : this.loop_mode,
			metronome : this.metronome,
			tempo_factor
		}
		this.session_data = session_data; 
		return session_data;
	}
	
	async set_tap( mode ){
		const res = await this.sendCommand(`tap ${mode}`);
		this.tap = mode;
		this.notifyTapEvChange();
	}
	
	async set_tapev( raw_tapev_object ){
		const ev = Evspec.hydrateEvent(raw_tapev_object);
		const res = await this.sendCommand(`tapev ${ev}`);
		this.tapev = ev;
		this.notifyTapEvChange();
	}
	
	async reset(){
		const res = await this.sendCommand(`reset`);
		this.notifySessionChange();
	}
	
	async play(){
		const res = await this.sendCommand(`p`);
		this.notifyPlayingModeChange("play");
	}
	
	async stop(){
		const res = await this.sendCommand(`s`);
		this.notifyPlayingModeChange("stop");
	}
	
	async record(){
		const res = await this.sendCommand(`r`);
		this.notifyPlayingModeChange("record");
	}
	
	async toogleLoop(loop_mode){
		
		let res;
		if(loop_mode){
			res = await this.sendCommand(`loop`);
		} else{
			res = await this.sendCommand(`noloop`);
		}
		
		this.loop_mode = loop_mode;
		this.notifyLoopModeChange();
	}
	
	async add_filter(filter_name){
		const res = await this.sendCommand(`fnew ${filter_name}`);
		if(res.data.length){
			throw {message : res.data.join("\n")}
		}
		this.notifySessionChange();
	}
	
	async get_filter_def( burst_cache = false ){
		
		if( !burst_cache && this.current_filter_definition){
			return this.current_filter_definition;
		}
		
		const res = await this.sendCommand(`finfo`);
		const rules = parseFilterRules(res.data);
		this.current_filter_definition = rules;
		return rules;
	}
	
	async goToMeasure(bar){
		await this.sendCommand(`g ${bar}`);
		if(this.playing_mode === "play"){
			await this.sendCommand(`p`);
		}
		
		this.current_selection.start = bar;
		this.notifySelectionChange();
	}
	
	async setSelectLength(length){
		await this.sendCommand(`sel ${length}`);
		if(this.playing_mode === "play"){
			await this.sendCommand(`p`);
		}
		this.current_selection.end = length;
		this.notifySelectionChange();
	}
	
	async setSlaveMode(slave){
		
		this.slave = slave;
		if(slave) {
			await this.sendCommand(`dclkrx 1`);
			await this.play();
		} else {
			await this.sendCommand(`dclkrx nil`);
			await this.stop();
		}
		
		
	}
	
	async toggleMute( track_name, mute_state ){
		if(mute_state){
			await this.sendCommand(`mute ${track_name}`);
		} else {
			await this.sendCommand(`unmute ${track_name}`);
		}
		
		this.notifyTrackMuteChange(track_name, mute_state);
		
	}
	
	async getTempoFactor(){
		const res = await this.sendCommand(`getfac`);
		const factor = Number(res.data);
		return factor;
	}
	
	async setTempoFactor(factor){
		factor = Number(factor);
		if(factor < 50 || factor > 200 ){
			 throw {
				 message : "Tempo factor must be between 50 and 200",
				 type : "set_tempo",
			 };
		}
		await this.sendCommand(`fac ${factor}`);
		this.tempo_factor = factor;
		this.notifyTempoFactorChange();
	}
	
	async initNewSession(){
		await this.sendCommand(`fnew default`);
		await this.sendCommand(`fmap { any {1 1..15} } { any {0 1..15} }`);
	}
	
	async initDevices(config){
		await this.sendCommand(`dnew 0 "Midish-Transport:2" wo`);
		await this.sendCommand(`dnew 1 "Midish-Transport:3" ro`);
		await this.setSlaveMode( (config.slave ?? false ) );
		await this.toogleLoop( (config.loop ?? false ) );
	}
	
	
}

function parseMinfo(lines) {
  return lines.map(line => {
		const match = line.match(
			/^\s*(\d+)\s+\{(\d+)\s+(\d+)\}\s+(\d+)(?:\s+#\s*-\s*(\d+))?/
		);

		if (!match) return null;

		const [, meas, beats, unit, tempo, endTempo] = match;

		return {
			measure: Number(meas),
			timeSignature: `${beats}/${unit}`,
			tempo: Number(endTempo ?? tempo),
			startTempo: Number(tempo),
			hasTempoChange: endTempo !== undefined
		};
    })
    .filter(Boolean);
}

function parseConfig(lines) {
	const result = structuredClone(defaultState)

	let currentBlock = null;

	for (const rawLine of lines) {
		const line = rawLine.trim();

		// block start
		const blockMatch = line.match(/^(\w+)\s*\{$/);
		if (blockMatch) {
			currentBlock = blockMatch[1];
			continue;
		}

		// block end
		if (line === "}") {
			currentBlock = null;
			continue;
		}

		// inside a block
		if (currentBlock) {
			if (line.startsWith("#")) continue;

			switch (currentBlock) {
				case "tracklist": {
					const match = line.match(
						/^\s*(\S+)\s+(\S+)\s+(\{\{.*\}\})(?:\s+(.+))?\s*$/
					);

					if (!match) break;

					const [, name, filter, channelsRaw, flagsRaw] = match;

					const flags = new Set( flagsRaw ? flagsRaw.trim().split(/\s+/) : [] );
					flags.toJSON = ()=>([...flags]);
					result.tracklist.push({
						name,
						flags,
						filter: filter === "nil" ? null : filter,
						channels: [...channelsRaw.matchAll(/\{(\d+)\s+(\d+)\}/g)]
							.map(([, device, channel]) => ({
								device: Number(device),
								channel: Number(channel)
							}))
					});
					break;
				}

				case "outlist":
				case "inlist":
					// TODO: parse channel entries
					break;

				case "filtlist":
					result.filtlist.push(line);
					break;

				case "sysexlist":
					// TODO: parse sysex entries
					break;
			}

			continue;
		}

		// key/value lines outside blocks
		const kv = line.match(/^(\w+)\s+(.*)$/);
		if (!kv) continue;

		const [, key, value] = kv;

		switch (key) {
			case "curev":
				result[key] = value;
				break;

			case "tap":
				result[key] = value;
				break;

			case "curpos":
			case "curlen":
				result[key] = Number(value);
				break;

			case "tapev" : 
				result[key] = value === "nil" ? null : value;
				try{
					result[key] = Evspec.hydrateString(value);
				}	
				catch(err){
					console.log(err)
				}
				break;


			default:
				result[key] = value === "nil" ? null : value;
		}
	}

	return result;
}

module.exports = MidishController;