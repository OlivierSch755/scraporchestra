import Alpine from '/js/lib/alpine.js';
import { sushiEditorApi } from './api.js'
import { sushiStore } from './sushi.js';
import { sushiStub } from '../sushi_client/client.js';


const notes = Array.from({length:128}, (_, i) => ({
	name :  `${ ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][i % 12]} ${Math.floor(i / 12) - 1}`,
	id : i
}));

const channelsStub =  sushi_rpc.lookupEnum("MidiChannel.Channel");
const channelsEntries = Object.entries( channelsStub.values ).filter( x=>x[0] !== "DUMMY" ) ;
const channelValuesById = channelsStub.valuesById;


Alpine.data("midiTesting", (track)=>({
	note : 36,
	channel : 0,
	velocity : 64 * (1/127),
	track_id : track.id,
	notes
}))

Alpine.data("KbPlayGround", ({ track_id, channel, velocity })=>({
	
	channel,
	track_id,
	velocity,

	noteMap : {
		KeyA: 60,
		KeyW: 61,
		KeyS: 62,
		KeyE: 63,
		KeyD: 64,
		KeyF: 65,
		KeyT: 66,
		KeyG: 67,
		KeyY: 68,
		KeyH: 69,
		KeyU: 70,
		KeyJ: 71,
		KeyK: 72,
		KeyO: 73,
		KeyL: 74,
		KeyP: 75,
		Semicolon: 76,
	},

	note_offset : 0,
	held_notes : new Set(),

	lowest_note(){
		let notes_lowest = Math.min( ...Object.values(this.noteMap)) + this.note_offset;
		return notes_lowest;
	},

	release_all_notes (){
		this.held_notes.forEach( note  => {
			const {track_id, channel, velocity} = this;
			sushiEditorApi.requestNoteOff(track_id,channel,note,velocity);
			this.held_notes.delete(note);
		} )
	},


	init(){
		
			this.$el.addEventListener("keydown", (e)=>{
				
				if(e.code === "ControlRight"){
					let notes_len = Object.values(this.noteMap).length ;
					let new_offset = this.note_offset + 1 ;
					if( new_offset + notes_len > 127 ) {
						new_offset = 127 - notes_len;
					}
					this.note_offset = new_offset;
					this.release_all_notes();
					return;
				}
				
				if(e.code === "ControlLeft"){
					let notes_lowest = Math.min( ...Object.values(this.noteMap)) ;
					let new_offset = this.note_offset - 1 ;
					if( notes_lowest + new_offset < 0 ) {
						new_offset = notes_lowest;
					}
					this.note_offset = new_offset;
					this.release_all_notes();
					return;
				}
				
				const note = this.noteMap[e.code] + this.note_offset;
			
				if( !note || this.held_notes.has(note) ) return;
				const {track_id, channel, velocity} = this;
				sushiEditorApi.requestNoteOn(track_id,channel,note,velocity);
				this.held_notes.add(note);
			})
			
			this.$el.addEventListener("keyup", (e)=>{
				const note = this.noteMap[e.code] + this.note_offset; 
				if( !note || !this.held_notes.has(note) ) return;
				const {track_id, channel, velocity} = this;
				sushiEditorApi.requestNoteOff(track_id,channel,note,velocity);
				this.held_notes.delete(note);
			})
	},
	
	destroy(){
		this.release_all_notes();
	}
	
}))

Alpine.data("connectionsList" , ({track, direction})=>({
	
	track : track,
	channelsEntries,
	channelValuesById,
	direction : direction,
	connections : [], 
	ports : [],

	async init(){
		if (this.direction === 'input'){
			await sushiStore.KbdInputConnections.load(); // will use cached value or fetch 
			this.connections = await sushiStore.getTrackInputConnections(this.track);
			this.ports = await sushiStore.MidiInputPorts.load();
		} else {
			await sushiStore.KbdOutputConnections.load(); // will use cached value or fetch 
			this.connections = await sushiStore.getTrackOutputConnections(this.track)
			this.ports = await sushiStore.MidiOutputPorts.load();
		}
		
	},

	async refreshConnections(){
		if (this.direction === 'input'){
			await sushiStore.KbdInputConnections.reload(); // will use burst cache and refetch 
			this.connections = await sushiStore.getTrackInputConnections(this.track);
		} else {
			await sushiStore.KbdOutputConnections.reload(); // will use burst cache and refetch 
			this.connections = await sushiStore.getTrackOutputConnections(this.track)
		}
	},


	async deleteConnection(connection){
		if (this.direction === 'input'){
			await sushiEditorApi.requestDisconnectKbdInput(connection);
		} else{
			await sushiEditorApi.requestDisconnectKbdOutput(connection);
		}
		await this.refreshConnections();
	},
	
	async submit(data){

		const connection = sushiStub.MidiKbdConnection.create();
		connection.track = this.track;
		connection.raw_midi = data.raw_midi;
		connection.channel = {channel : Number(data.channel)}
		connection.port = data.port;
		
		if (this.direction === 'input'){
			await sushiEditorApi.requestConnectKbdInputToTrack(connection);
			await sushiStore.KbdInputConnections.reload();
			
		} else{
			await sushiEditorApi.requestConnectKbdOutputFromTrack(connection);
			await sushiStore.KbdOutputConnections.reload();
		}
		
		await this.refreshConnections();
		
	}
	
	
	
}));


Alpine.data("midi_clk", ()=>({
	
	ports : [],
	
	async init(){
		const output_ports = await sushiStore.MidiOutputPorts.load();
		const ui_ports = [];
		
		await Promise.all( output_ports.map( port =>{
			return port.clockOutputEnabled.load().then( bool_value => {
				ui_ports.push({id : port.id, enabled : bool_value })
			}) 
		} ) )
		
		this.ports = ui_ports;
		
	},
	
	async refreshPortsStates(){
		const output_ports = await sushiStore.MidiOutputPorts.load();
		const ui_ports = [];
		await Promise.all( output_ports.map( port =>{
			return port.clockOutputEnabled.reload().then( () => {
				ui_ports.push({id : port.id, enabled : port.clockOutputEnabled.value })
			}) 
		} ) )
		
		this.ports = ui_ports;
	},
	
	async submit(event){
		const port = Number(event.target.dataset.port);
		const enabled = event.target.checked; 
		const ok = await sushiEditorApi.requestSetMidiClockOutputEnabled({port, enabled}) 
		if(ok) await this.refreshPortsStates();
	}
	
}));

Alpine.data("PCconnectionsList", (processor) => ({

	processor,
	connections : [],
	channelsEntries,
	ports : [],
	channelValuesById,
	async init(){
		this.connections = await sushiStore.getProcessorPCInputConnections(this.processor);
		this.ports = await sushiStore.MidiInputPorts.load();
	},

	async deleteConnection(connection){
		await sushiEditorApi.requestDisconnectPC(connection);
		await this.refreshConnections();
	},

	async refreshConnections(){
		await sushiStore.PCInputConnections.reload();
		this.connections = await sushiStore.getProcessorPCInputConnections(this.processor);
	},

	async submit(data){
		const connection = sushiStub.MidiPCConnection.create();
		connection.processor = Alpine.raw(this.processor);
		connection.channel = {channel : Number(data.channel)}
		connection.port = data.port;
		await sushiEditorApi.requestConnectPCToProcessor(connection);
		await this.refreshConnections();
	}
	
}))

Alpine.data("CCconnectionsList", (processor) => ({

	processor,
	connections : [],
	channelsEntries,
	ports : [],
	channelValuesById,
	parameters : [],
	
	connection_factory : sushiStub.MidiCCConnection.create({
		parameter : {
			processor_id : processor.id,
			parameter_id : null,
		},
		channel : {
			channel : 1
		},
		max_range : 1,
	}),
	
	
	async init(){

		const parameters = await processor.parameters.load();
		this.parameters = parameters.filter( parameter => parameter.info.value.automatable );

		
		this.connections = await processor.midiControlChangeConnections.load();
		
		this.ports = this.ports = await sushiStore.MidiInputPorts.load();

		
	},

	getConnectionParameterName(connection){
		const param = this.parameters.find( p => ( 
			p.identifier.processor_id === connection.parameter.processor_id 
			&& p.identifier.parameter_id === connection.parameter.parameter_id 
			)
		);
		return param.info.value.name;
	},


	async deleteConnection(connection){
		console.log("connection to delete", Alpine.raw(connection))
		await sushiEditorApi.requestDisconnectCC(connection);
		await this.refreshConnections();
	},

	async refreshConnections(){
		this.connections = await processor.midiControlChangeConnections.reload()
	},


	async submit(){
		await sushiEditorApi.requestConnectCCToParameter(this.connection_factory);
		
		// clear this otherwise next factory will still have stale parameter_id and UI will display wrong option. 
		this.connection_factory.parameter.parameter_id = null; 
		
		await this.refreshConnections();
	}
	
}))