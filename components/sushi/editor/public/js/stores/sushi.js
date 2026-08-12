import Alpine from '/js/lib/alpine.js';
import { commandInterface } from '../sushi_client/client.js';

import { sushiEditorApi } from './api.js'


class Registry{
	
	#tracks = new Map();
	getTrack(id){
		let p = this.#tracks.get(id);
		if(!p){
			p = Alpine.reactive( new Track(id) );
			this.#tracks.set(id, p);
		}
		return p;
	}
	
    deleteTrack(id){
        const track = this.#tracks.get(id);
        if(track){
            track.deleted = true;
            this.#tracks.delete(id);
        }
    }
	
	
	#processors = new Map();
	getProcessor(id){
		let p = this.#processors.get(id);
		if(!p){
			p = Alpine.reactive( new Processor(id) );
			this.#processors.set(id, p);
		}
		return p;
	}

    deleteProcessor(id){
        const processor = this.#processors.get(id);
        if(processor){
            processor.deleted = true;
            this.#processors.delete(id);
        }
    }
	

    #parameters = new Map();
    getParameter(processorId, parameterId) {
        let params = this.#parameters.get(processorId);

        if (!params) {
            params = new Map();
            this.#parameters.set(processorId, params);
        }

        let p = params.get(parameterId);

        if (!p) {
            // p = Alpine.reactive(new Parameter(processorId, parameterId));
            p = new Parameter(processorId, parameterId);
            params.set(parameterId, p);
        }

        return p;
    }
	

    #properties = new Map();
    getProperty(processorId, propertyId) {
        let props = this.#properties.get(processorId);

        if (!props) {
            props = new Map();
            this.#properties.set(processorId, props);
        }

        let p = props.get(propertyId);

        if (!p) {
            p = Alpine.reactive(new Property(processorId, propertyId));
            props.set(propertyId, p);
        }

        return p;
    }
	
	#midi_inputs = new Map();
    getMidiInput(id) {
        let midi_input = this.#midi_inputs.get(id);
		if(!midi_input){
			midi_input = new MidiInputPort(id);
			this.#midi_inputs.set(id, midi_input);
		}
        return midi_input;
    }
	
	#midi_outputs = new Map();
    getMidiOutput(id) {
        let midi_output = this.#midi_outputs.get(id);
		if(!midi_output){
			midi_output = new MidiOutputPort(id);
			this.#midi_outputs.set(id, midi_output);
		}
        return midi_output;
    }
	
}

export const registry = new Registry();



// Lazy loading ressources
const ResourceLoadPromises = new WeakMap();
class Resource{
	
	loaded = false;
	version = 0;
	
	constructor(loader, default_value){
		this.loader = loader;
		this.value = default_value;
	}
	
	set(value){
		this.version ++;
		this.value = value;
		this.status = 'loaded';
		this.loaded = true;
		return this;
	}
	
	async load(){
		
		if(this.status === 'loaded')
			return this.value;
		
		if(ResourceLoadPromises.has(this))	
			return ResourceLoadPromises.get(this);
		
		
		const request_version = this.version;
		
		this.status = 'loading';
		
		
		console.log("loading ressource")
		const promise = this.loader()
			.then(value => {
				
				if( request_version === this.version ){
					this.set(value)
				}
				
				return this.value;
			})
			.catch(err => {
				this.error = err;
				this.status = 'error';
				throw err;
			})
			.finally( ()=> ResourceLoadPromises.delete(this) );
			
		ResourceLoadPromises.set(this, promise);
		return promise;
		
	}
	
	reload(){
		this.status = 'loading';
		return this.load();
	}
	
}

class Session{

	constructor(){
		
		this.name = "Web Editor";
		
		this.tracks = new Resource( async ()=>{
			const res = await commandInterface.AudioGraphController.getAllTracks({})
			return res.tracks.map( trackInfo => { 
				const track = registry.getTrack(trackInfo.id);
				track.info.set(trackInfo);
				return track;
			} )
		}, [] );
		
		this.processors = new Resource ( async ()=> {
			const res = await CommandInterface.AudioGraphController.getAllProcessors({}) 
			return res.processors.map( procInfo => { 
				const processor = registry.getProcessor(procInfo.id);
				processor.info.set(procInfo);
				return processor;
			} )
		}, [])
		
		this.MidiInputPorts = new Resource( async ()=>{
			const res = await CommandInterface.MidiController.getInputPorts({});
			const ports = [];
			for(let i = 0; i < res.value; i++){
				ports.push(registry.getMidiInput(i));
			}
			return ports;
		}, []);
		
		this.MidiOutputPorts = new Resource( async ()=>{
			const res = await CommandInterface.MidiController.getOutputPorts({});
			const ports = [];
			for(let i = 0; i < res.value; i++){
				ports.push(registry.getMidiOutput(i));
			}
			return ports;
		}, []);
		
		this.KbdInputConnections = new Resource( async ()=>{
			const res = await commandInterface.MidiController.getAllKbdInputConnections({});
			let id = 0;
			return res.connections.map( connection => {
				const track = registry.getTrack(connection.track.id);
				connection.track = track;
				connection.id = id++;
				return connection;
			})
		}, []);
				
		this.KbdOutputConnections = new Resource( async ()=>{
			const res = await commandInterface.MidiController.getAllKbdOutputConnections({});
			let id = 0;
			return res.connections.map( connection => {
				const track = registry.getTrack(connection.track.id);
				connection.track = track;
				connection.id = id++;
				return connection;
			})
		}, []);
		
		this.PCInputConnections = new Resource( async ()=>{
			const res = await commandInterface.MidiController.getAllPCInputConnections({});
			let id = 0;
			return res.connections.map( connection => {
				const processor = registry.getProcessor(connection.processor.id);
				connection.id = id++;
				console.log(connection)
				return connection;
			})
		}, []);
		
		this.timeSignature = new Resource( async ()=> {
			const res = await commandInterface.TransportController.getTimeSignature({});
			return res;
		})
		
		this.syncMode = new Resource( async ()=> {
			const res = await commandInterface.TransportController.getSyncMode({});
			return res;
		})
		

		this.tempo = new Resource( async ()=> {
			const res = await commandInterface.TransportController.getTempo({});
			return res.value;
		})
		
		this.playingMode = new Resource( async ()=> {
			const res = await commandInterface.TransportController.getPlayingMode({});
			return res;
		})
		
		this.audioInputConnections = new Resource( async()=>{
			const res = await commandInterface.AudioRoutingController.getAllInputConnections({});
			let id = 0;
			return res.connections.map( connection => {
				const track = registry.getTrack(connection.track.id);
				connection.track = track;
				connection.id = id++;
				return connection;
			});
		}, []);
		
		this.audioOutputConnections = new Resource( async()=>{
			const res = await commandInterface.AudioRoutingController.getAllOutputConnections({});
			let id = 0;
			return res.connections.map( connection => {
				const track = registry.getTrack(connection.track.id);
				connection.track = track;
				connection.id = id++;
				return connection;
			});
		}, []);
			
		this.AudioChannelInputCount = new Resource( async()=>{
			const res = await commandInterface.SystemController.getInputAudioChannelCount ({});
			return res.value
		}, 0);
		
		this.AudioChannelOutputCount = new Resource( async()=>{
			const res = await commandInterface.SystemController.getOutputAudioChannelCount ({});
			return res.value
		}, 0);
		
		
	}
	
	// called on TrackUpdate protomessage
	removeTrack(id){
		registry.deleteTrack(id);
		if(this.tracks.loaded){
			this.tracks.set(
				this.tracks.value.filter(t => t.id !== id)
			);
		}
	}
	
	// called on TrackUpdate protomessage
	addTrack(trackInfo){
		const track = registry.getTrack(trackInfo.id);
		track.info.set(trackInfo);
		
		if(this.tracks.loaded){
			if(this.tracks.value.some(t => t.id === track.id)) return;
			this.tracks.set(
				[...this.tracks.value, track]
			);
		}
	}
		
	async getTrackAudioInputConnections(track){
		const connections = await this.audioInputConnections.load();
		return connections.filter( c => c.track === track );
	}
	
	async getTrackAudioOutputConnections(track){
		const connections = await this.audioOutputConnections.load();
		return connections.filter( c => c.track === track );
	}
		
		
	async getTrackInputConnections(track){
		const connections = await this.KbdInputConnections.load();
		return connections.filter( c => c.track === track );
	}	
		
	async getTrackOutputConnections(track){
		const connections = await this.KbdOutputConnections.load();
		return connections.filter( c => c.track === track );
	}	
		
	async getProcessorPCInputConnections(processor){
		const connections = await this.PCInputConnections.load();
		return connections.filter( c => c.processor.id === processor.id );
	}	
	
	
	// convenience method to help making plugin name unique when adding from the plugin store
	async isProcessorNameUnique(processor){
		const processors = await this.processors.load();
		return ( ! processors.some( p => p.info.value.name === processor.name) )
		
	}
	
}

Alpine.store('sushi', new Session() );

export const sushiStore = Alpine.store('sushi');

window.SUSHISTORE = sushiStore;


class MidiInputPort{
	constructor( id ){
		this.id = id;
	}
}

class MidiOutputPort extends MidiInputPort {
	constructor( id ){
		super(id);
		this.clockOutputEnabled = new Resource( async ()=> {
			const res = await commandInterface.MidiController.getMidiClockOutputEnabled({value:this.id})
			return res.value;
		}, false );
		
	}
}

class Processor{
	
	constructor(id){
	
		this.id = id;
		this.info = new Resource();
		
		// we load properties and bypassed in one go, retrospectively it does not seem that great an idea
		this.state = new Resource( async ()=> {
			
			const [bypass_res, properties_res ] = await Promise.all([
				commandInterface.AudioGraphController.getProcessorBypassState( this ),
				commandInterface.ParameterController.getProcessorProperties( this )
			]);
			
			return {
				bypassed : bypass_res.value,
				properties : properties_res.properties.map( propertyInfo => { 
					const property = registry.getProperty(this.id, propertyInfo.id);
					property.info.set(propertyInfo);
					return property;
				} )
			}
		}, 
			{
				properties : [],
				bypassed : false
			}
		)
		
		this.parameters = new Resource( async ()=>{
			const res = await commandInterface.ParameterController.getProcessorParameters(this);
			return res.parameters.map( paramInfo => { 
				const parameter = registry.getParameter(this.id, paramInfo.id);
				parameter.info.set(paramInfo);
				return parameter;
			} )
		} )
	
		this.programs = new Resource( async ()=>{
			const res = await commandInterface.ProgramController.getProcessorPrograms(this);
			return res.programs;
		} )
		
		
		this.current_program = new Resource( async ()=>{
			const res = await commandInterface.ProgramController.getProcessorCurrentProgram(this);
			return res.program;
		} )
		
		this.midiControlChangeConnections = new Resource ( async ()=>{
			const res = await commandInterface.MidiController.getCCInputConnectionsForProcessor(this) ;
			let id = 0;
			return res.connections.map( connection => {
				const parameter = registry.getParameter(this.id, connection.parameter.parameter_id );
				connection.parameter = parameter.identifier;
				connection.parameter_ob = parameter;
				connection.id = id++;
				return connection;
			})
		})
	}
}

class Track{
	
	constructor(id){
		this.id = id;
		
		// The UI usually does not need to load individual trackInfo. Those get populated via listing so far. 
		// So no async self loader for this ressource. 
		this.info = new Resource() ;
		
		this.processors = new Resource( async ()=>{
			
			// how do we load & hydrate track processors ? 
			const res = await commandInterface.AudioGraphController.getTrackProcessors(this);
			
			return res.processors.map( procInfo => { 
				const processor = registry.getProcessor(procInfo.id);
				processor.info.set(procInfo);
				return processor;
			} )
			
		} )
		
		this.parameters = new Resource( async ()=>{
			
			// how do we load & hydrate track parameters ? 
			const res = await commandInterface.ParameterController.getTrackParameters(this)
			return res.parameters.map( paramInfo => { 
				const parameter = registry.getParameter(this.id, paramInfo.id);
				parameter.info.set(paramInfo);
				return parameter;
			} )
		} )
		
		this.properties = new Resource( async ()=>{
			
			// how do we load & hydrate track properties ? 
			const res = await commandInterface.ParameterController.getTrackProperties(this)
			return res.properties.map( propertyInfo => { 
				const property = registry.getProperty(this.id, propertyInfo.id);
				property.info.set(propertyInfo);
				return property;
			} )
		} , []
		)
		
		this.midiControlChangeConnections = new Resource ( async ()=>{
			const res = await commandInterface.MidiController.getCCInputConnectionsForProcessor(this) ;
			let id = 0;
			return res.connections.map( connection => {
				const parameter = registry.getParameter(this.id, connection.parameter.parameter_id );
				connection.parameter = parameter.identifier;
				connection.parameter_ob = parameter;
				connection.id = id++;
				return connection;
			})
		});
	}
	
	// called on notificationController -> ProcessorUpdate -> PROCESSOR_DELETED 
	removeProcessor(id){
		registry.deleteProcessor(id);
		if(this.processors.loaded){
			this.processors.set(
				this.processors.value.filter(p => p.id !== id)
			);
		}
		
		if(sushiStore.processors.loaded){
			sushiStore.processors.set(
				sushiStore.processors.value.filter(p => p.id !== id)
			)
		}
	}
	
	// called on notificationController -> ProcessorUpdate -> PROCESSOR_ADDED 
	addProcessor(processorInfo, position = 0, cached){
		
		const processor = registry.getProcessor(processorInfo.id);
		if(!cached){
			processor.info.set(processorInfo);
		}
		else{
			// we may get a cached object (if it was moved it did delete -> add) and we kept its config so processor does not have to be rediscovered again.
			cached.deleted = false;
			Object.assign(processor, cached); 
		}
		
		if(this.processors.loaded){
			console.log("adopting", processor)
			if(this.processors.value.some(p => p.id === processor.id)) return;
			this.processors.value.splice(position, 0, processor);
		}
		
		if(sushiStore.processors.loaded){
			if(sushiStore.processors.value.some(p => p.id === processor.id)) return;
			sushiStore.processors.value.push(processor);
		}
	}
	
	get typeHumanReadable(){
		// this is the numeric value of this track type
		const trackType = this.info.value?.type.type;
		
		// this is the protomessage stub for TrackType
		const TrackType  = this.info.value?.type.$type.Type;
		
		return 	TrackType[trackType]
	}
	
}

class Parameter{
	
	constructor(processorId, id){
		this.processorId = processorId;
		this.id = id;
		
		this.identifier = { parameter_id : id , processor_id : processorId };
		
		this.info = new Resource( async ()=> {
			const res = await commandInterface.ParameterController.getParameterInfo(this.identifier)
			return res;
		});
		
		// Matches the parts we want in ParameterUpdate Type. 
		// So we can just set() the ressource from a parameterUpdate protomessage instace and call it a day.
		this.state = new Resource( async ()=> {
			const [normalized, domain, formatted] = await Promise.all([
				commandInterface.ParameterController.getParameterValue( this.identifier ),
				commandInterface.ParameterController.getParameterValueInDomain( this.identifier ),
				commandInterface.ParameterController.getParameterValueAsString( this.identifier )
			]);
			
			return {
				domain_value : domain.value,
				formatted_value : formatted.value,
				normalized_value : normalized.value
			}
		});
			
	}
	
	
}

class Property{
	
	constructor(processorId, id){
		this.processorId = processorId;
		this.id = id;
		
		this.identifier = { property_id : id , processor_id : processorId };
		
		this.info = new Resource( async ()=> {
			const res = await commandInterface.ParameterController.getPropertyInfo(this.identifier)
			return res;
		});
		
		this.state = new Resource( async ()=> {
			const res = await commandInterface.ParameterController.getPropertyValue( this.identifier )
			return res.value;
		});
	}
	
	
}






Alpine.data("processorBypassButton", (processor)=>({
	bypassed : false,
	processor,
	loaded : false, 
	async init(){
		const state = await processor.state.load();
		this.bypassed = state.bypassed;
		this.loaded = true;
	},
	
	async submit(){
		const ok = await sushiEditorApi.requestBypassProcessor(processor, this.bypassed);
		if(!ok){
			this.bypassed = !this.bypassed;
			return;
		}
		if( ! this.processor.state.loaded ) return; // guard against weird cases where other window fiddled with processor while this is visible
		
		this.processor.state.value.bypassed = this.bypassed;
	}
}))

