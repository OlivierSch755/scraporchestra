import Alpine from '/js/lib/alpine.js';
import { sushiEditorApi } from './api.js'
import { sushiStore } from './sushi.js';
import { sushiStub } from '../sushi_client/client.js';

import { LazyLoadingSection } from '/js/lib/alpine_global.js';



const TrackTypes = Object.fromEntries( 
	Object.entries( 
		sushiStub.TrackType.Type
	)
	.filter( ([k,v]) => k !== "DUMMY" )
);

Alpine.data("trackAdder", ()=>({
	TrackTypes,
	name : "",
	channels : 2,
	thread : null,
	multibus : false,
	buses : 2,
	type : TrackTypes.REGULAR,
	
	submit_disabled : false,
	
	get is_regular(){
		return this.type === TrackTypes.REGULAR;
	},
	
	
	async submit(){
		
		const {name,channels,thread,multibus,type, buses} = Alpine.raw(this);
		let request;
		
		if(multibus){
			request = sushiStub.CreateMultibusTrackRequest.create({name, buses, thread});
			await sushiEditorApi.requestCreateMultibusTrack(request);
			return;
		}
		else {
			
			switch(type){
				
				case TrackTypes.REGULAR : {
					request = sushiStub.CreateTrackRequest.create({name, channels, thread});
					await sushiEditorApi.requestCreateTrack(request);
					return;
				}
				
				case TrackTypes.PRE : {
					request = sushiStub.CreatePreTrackRequest.create({name});
					await sushiEditorApi.requestCreatePreTrack(request);
					return;
				}
				
				case TrackTypes.POST : {
					request = sushiStub.CreatePostTrackRequest.create({name});
					await sushiEditorApi.requestCreatePostTrack(request);
					return;
				}
				
			}
		}
	}
	
	
}));



class PropertyViewer extends LazyLoadingSection{
	

	properties = [];
	
	constructor( processor, pre_open, heading_level, heading_text = "Properties" ){
		super(pre_open, heading_level, heading_text);
		this.last_commited_values = new Map();
		this.processor = processor;
		this.busySync = false;
	}
	
	async load(){
		
		const state = await this.processor.state.load();
		
		// we load all properties in one go, there usually aren't enough to make the UI feel unresponsive
		for( const property of state.properties ){
			await property.state.load();
		}
		
		this.properties = state.properties;
		this.loaded = true;
	}
	
	checkEnterAndSubmit(property, event){
		if(event.key !== "Enter") return;
		this.submit( property,event.target.value );
	}
	
	async submit(property,value){
		
		if(this.busySync) return;
			
		const { last_commited_values } = Alpine.raw(this);
		
		const prop = Alpine.raw(property);
		
		if(	last_commited_values.get(prop) === value ) return;
		last_commited_values.set(prop, value);
		
		const propertyValue = sushiStub.PropertyValue.create({
			property : prop.identifier,
			value
		});
		
		this.busySync = true;
		await sushiEditorApi.requestSetPropertyValue(propertyValue);
		this.busySync = false;
	}
	
}

Alpine.data("propertyViewer", function(){ return  new PropertyViewer(...arguments) } );


class ProgramViewer extends LazyLoadingSection{
	
	busySync = false;
	programs = [];
	current_program_id = null;
	
	constructor( processor, pre_open, heading_level, heading_text = "Programs" ){
		super(pre_open, heading_level, heading_text);
		this.processor = processor;
	}
	
	async load(){
		
		const programs = await this.processor.programs.load();
		const current_program_id = await this.processor.current_program.load();
		
		this.programs = programs;
		this.current_program_id = current_program_id;
		
		this.loaded = true;
	}
	
	cleanUpName(name){
		name = name.replace(/file:.*lv2\//, "");
		name = name.replace(/http:\/\/.*:preset:[0-9]+/, "");
		return name;
	}
	
	async submit(){
		this.busySync = true;
		
		const {programs, current_program_id, processor} = Alpine.raw(this);
		
		const selected_program = programs.find( p => p.id.program === current_program_id );
		
		const processorProgramSetRequest = sushiStub.ProcessorProgramSetRequest.create({
			program : selected_program.id,
			processor
		})
		
		await sushiEditorApi.requestSetProcessorProgram(processorProgramSetRequest);
		
		this.current_program_id = await processor.current_program.reload();
		
		
		
		if( processor.parameters.loaded ){
			
			const old = document.querySelector('[data-parameterlist]');
			Alpine.$data(old).destroy();
			processor.parameters.value.forEach( p => {
				p.state.status = false;
			});
			
			const fresh = old.cloneNode(false);

			old.replaceWith(fresh);


		}
		
		this.busySync = false;
	}
	
}


Alpine.data("programViewer", function(){ return  new ProgramViewer(...arguments) } );