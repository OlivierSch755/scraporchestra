import Alpine from '/js/lib/alpine.js';
import { sushiEditorApi } from './api.js'
import { sushiStore } from './sushi.js'
import { sushiStub } from '../sushi_client/client.js'; 
import { LazyLoadingSection } from '/js/lib/alpine_global.js';

class TrackAudioConnections extends LazyLoadingSection {
	
	constructor( track, pre_open, heading_level, heading_text = "Audio Connections" ){
		super(pre_open, heading_level, heading_text);
		this.track = track;
		this.connections = {
			input : [],
			output : []
		};
		this.connection_factory = sushiStub.AudioConnection.create();
	}
	
	no_input = false;
	no_output = false;
	direction = "input";
	
	audioChannels = [];
	trackAudioChannels = [];
	
	async load(){
		const [input, output] = await Promise.all([
			sushiStore.getTrackAudioInputConnections(this.track),
			sushiStore.getTrackAudioOutputConnections(this.track)
		]);
		this.connections = {input, output};
		this.no_input = ( input.length === 0 );
		this.no_output = ( output.length === 0 );
	};
	
	
	async createConnectionBuilderView(direction){
		
		const input_channels_nb = await sushiStore.AudioChannelInputCount.load()
		const output_channels_nb = await sushiStore.AudioChannelOutputCount.load()
		
		const audioChannelInputs = new Array(input_channels_nb).fill().map( (_,i) => i );
		const audioChannelOutputs = new Array(output_channels_nb).fill().map( (_,i) => i );
		
		
		const connection_factory = sushiStub.AudioConnection.create();
		connection_factory.track = Alpine.raw(this.track);
		this.connection_factory = connection_factory;
		
		
		const track_channels_nb = this.track.info.value.channels;
		this.trackAudioChannels = new Array(track_channels_nb).fill().map( (_,i) => i );
		
		
		this.direction = direction;
		this.audioChannels = direction === 'input' ? audioChannelInputs : audioChannelOutputs ;
		
		return true;
	};
	
	async submit(){
		
		let ok = false;
		
		if(this.direction === 'input'){
			ok = await sushiEditorApi.requestConnectInputChannelToTrack(this.connection_factory);
		}
		else {
			ok = await sushiEditorApi.requestConnectOutputChannelFromTrack(this.connection_factory);
		}
		
		if(ok){ this.refreshData(); }
	};
	
	async refreshData(){
		await Promise.all( [
			sushiStore.audioOutputConnections.reload(), 
			sushiStore.audioInputConnections.reload()
		]);
		this.load();
	};
	
	async disconnectInput( connection ){
		const ok = await sushiEditorApi.requestDisconnectInput(connection);
		if(ok){ this.refreshData(); }
	};
	
	async disconnectOutput( connection ){
		const ok = await sushiEditorApi.requestDisconnectOutput(connection);
		if(ok){ this.refreshData(); }
	};
	
	async disconnectAllInputs(){
		const ok = await sushiEditorApi.requestDisconnectAllInputsFromTrack(this.track);
		if(ok){ this.refreshData(); }
	};
	
	async disconnectAllOutputs(){
		const ok = await sushiEditorApi.requestDisconnectAllOutputsFromTrack(this.track);
		if(ok){ this.refreshData(); }
	};
}



// this is a "lazyload on open" section
Alpine.data("TrackAudioConnections" , function(track){return new TrackAudioConnections(...arguments)});

