import Alpine from '/js/lib/alpine.js';
import { wsClient } from "/js/ws_client_wrapper.js";

import Evspec from "./evspec.mjs";


let req =  await fetch("/components/midish/widget.html");
let templateTxt = await req.text();

const parse = Range.prototype.createContextualFragment.bind(document.createRange());
const AppStatus = Alpine.store('status');

Alpine.store("midish", {
	
	
	session_loaded : false,
	session : {
		position : {
			measure : 0,
			beat : 0,
			tick : 0,
		}
	},
	
	current_filter_definition : [],
	
	getTrackByName(track_name){
		return this.session.state.tracklist.find( track => track.name === track_name);
	},
	
	updateSessionFromJSON(data){
		
		const hydrated_data = {};
		
		Object.assign( hydrated_data, data );
		
		hydrated_data.state.tracklist.forEach( track => {
			track.flags = new Set( track.flags );
		} )
		
		hydrated_data.state.tapev = Evspec.hydrateEvent(hydrated_data.state.tapev);
		
		Object.assign( this.session, hydrated_data );
		this.session_loaded = true;
	},
	
	async get_filter_rules(){
		
		const req = await fetch("/components/midish/api/filter.json");
		const rules = await req.json();
		this.hydrate_filter_rules(rules);

		this.current_filter_definition = rules;
		
		return rules;
	},
	
	hydrate_filter_rules(rules){
		rules.forEach( rule => {
			rule.match = Evspec.hydrateEvent(rule.match);
			if(rule.type ==="evmap"){
				rule.action = Evspec.hydrateEvent(rule.action);
			}
		})
	}
	
	
})

const midishStore = Alpine.store("midish");


wsClient.addEventListener("component.midish.notification", async (event)=>{
	
	const notification = event.detail;
	
	switch( notification.type ){
		
		case "session" : {
			midishStore.updateSessionFromJSON(notification.data);
			console.log("got midish session via ws", notification.data)
			break;
		}
		
		case "playing_mode" : {
			midishStore.session.playing_mode = notification.data;
			break;
		}
		
		case "position" : {
			Object.assign( midishStore.session.position, notification.data )
			break;
		}
		
		case "selection" : {
			const {start, end} = notification.data;
			midishStore.session.state.curpos = start;
			midishStore.session.state.curlen = end;
			break;
		}
		
		case "tap" : {
			const {tap, tapev} = notification.data;
			midishStore.session.state.tapev = Evspec.hydrateEvent(tapev);
			midishStore.session.state.tap = tap;
			break;
		}
		
		case "tempo_factor" : {
			const factor = notification.data;
			midishStore.session.tempo_factor = factor;
			break;
		}
		
		case "mute" : {
			
			const {track_name, mute_state} =  notification.data;
			const track = midishStore.getTrackByName(track_name);
			if(!track){
				console.warn("Got mute data about track we know nothing about. Not normal.");
				return;
			}
			
			if(mute_state){
				track.flags.add("mute");
			} else {
				track.flags.delete("mute");
			}
			
			break;
		}
		
		case "loop" : {
			midishStore.session.loop = notification.data;
			break;
		}
	
		case "filter_definition" : {
			const rules = notification.data;
			const hydrated = midishStore.hydrate_filter_rules(notification.data);
			midishStore.current_filter_definition = rules
			break;
		}
	
		
	}
	
	
});

async function loadSession(){
	const res = await fetch( "/components/midish/api/session.json" );
	const data = await res.json();
	midishStore.updateSessionFromJSON(data);
	console.log("got midish session via fetch", data)
}


Alpine.data("midish_track", ()=>({
	
	get muted(){
		return this.$data.track.flags.has("mute");
	},
	
	async toggleMute(){
		
		this.requestInProgress = true;
		
		const currently_muted = this.muted;
		const mute_token = currently_muted ? "0" : "1";
		const action_msg = currently_muted ? "unmute" : "mute";
		const track = Alpine.raw(this.$data.track);
		
		const req = await fetch(`/components/midish/api/mute/${track.name}/${mute_token}` , {
			method: "POST"
		});
		
		
		if (!req.ok) {
			AppStatus.error(`Could not ${action_msg} track ${track.name}`);
		}
		else {
			AppStatus.success(`Track ${track.name} ${action_msg}d`);
		}
		this.requestInProgress = false;
		
		
	},
	
	
	
	
	
}))


Alpine.data("midish", (config)=> ({
	
	config : Alpine.raw(config),
	
	slave : config?.slave ?? false,
	
	selected_file : null,
	requestInProgress : false,

	init(){
		const component = this.$data.component;
		if(!component.session_restore_failed ){
			if( component.state === Alpine.store('engine').States.READY ){
				loadSession();
			}
		}
		
		/*
			There exist a rare race condition when neither WS nor FETCH will load session.
			This makes sures it happens eventually.
		*/
		setTimeout( ()=>{
			if(midishStore.session_loaded) return;
			loadSession();
		}, 100);
		
	},

	fileSelected(event) {
		const input = event.target;

		if (input.files.length > 0) {
			this.selected_file = input.files[0];
		} else {
			this.selected_file = null;
		}
	},

	async resetSession(event) {
		this.requestInProgress = true;
		
		const req = await fetch("/components/midish/api/reset", {
			method: "POST"
		});
		
		if (!req.ok) {
			AppStatus.error("Could not reset session");
		}
		else {
			AppStatus.success("Session reset ok");
		}
		this.requestInProgress = false;
	},

	async submitMidiFile() {
		this.requestInProgress = true;
		const data = new FormData();

		if (this.selected_file) {
			data.append("midi_file", this.selected_file);
		}

		const req = await fetch("/components/midish/api/import", {
			method: "POST",
			body: data
		});
		
		if (!req.ok) {
			AppStatus.error("Could not save Midish config");
		}
		else {
			AppStatus.success("Midish session imported")
		}
		this.requestInProgress = false;
	},
	
	async add_filter(name){
		const req = await fetch("/components/midish/api/add_filter/" + name, {
			method: "POST"
		});
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error("Could not create MIDI filter. " + msg);
		}
		else {
			AppStatus.success("MIDI filter created")
		}
	},
	
	async requestPlay(){
		this.requestInProgress = true;
		const req = await fetch("/components/midish/api/play", {method:"post"});
		this.requestInProgress = false;
	},
	
	async requestStop(){
		this.requestInProgress = true;
		const req = await fetch("/components/midish/api/stop", {method:"post"});
		this.requestInProgress = false;
	},
	
	async requestRecord(){
		this.requestInProgress = true;
		const req = await fetch("/components/midish/api/record", {method:"post"});
		this.requestInProgress = false;
	},
	
	async requestSetSlaveMode(mode){
		const mode_str = mode ? "1" : "0";
		this.requestInProgress = true;
		const req = await fetch("/components/midish/api/slave/" + mode_str , {method:"post"});
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error("Could not update Slave settings " + msg);
		}
		else {
			this.config.slave = mode;
			AppStatus.success("Slave settings updated")
		}
		
		this.requestInProgress = false;
	},
	
	async requestSeekToBarFormSubmit(formElement){
		this.requestInProgress = true;
		const bar = Number( new FormData( formElement ).get("bar") );
		const req = await fetch("/components/midish/api/seek/" + bar, {method:"post"});
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error("Could not update selection " + msg);
		}
		else {
			AppStatus.success("Selection updated")
		}
		this.requestInProgress = false;
	},
	
	async requestSetSelectionLengthFormSubmit(formElement){
		this.requestInProgress = true;
		const selection_length = Number( new FormData( formElement ).get("selection_length") );
		const req = await fetch("/components/midish/api/select/" + selection_length, {method:"post"});
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error("Could not update selection " + msg);
		}
		else {
			AppStatus.success("Selection updated")
		}
		this.requestInProgress = false;
	},
	
	async requestTempoFactorFormSubmit(formElement){
		this.requestInProgress = true;
		const tempo_factor = Number( new FormData( formElement ).get("tempo_factor") );
		const req = await fetch("/components/midish/api/fac/" + tempo_factor, {method:"post"});
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error("Could not update Tempo Factor " + msg);
		}
		else {
			AppStatus.success("Tempo Factor updated")
		}
		this.requestInProgress = false;
	},
	
	async requestSetLoopMode(loop_mode){
		this.requestInProgress = true;
		loop_mode = loop_mode ? "1" : "0";
		const req = await fetch("/components/midish/api/loop/" + loop_mode, {method:"post"});
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error("Could not update Loop mode " + msg);
		}
		else {
			AppStatus.success("Loop mode updated (may require stop & play)")
		}
		this.requestInProgress = false;
	},
	
	async requestSetMetronomeFormSubmit(formElement){
		this.requestInProgress = true;
		
		const formData =  new FormData( formElement );
		
		const enabled = formData.get("enabled");
		
		let low_chan = formData.get("low_chan");
		let low_note = formData.get("low_note");
		let low_vel = formData.get("low_vel");
		
		let high_chan = formData.get("high_chan");
		let high_note = formData.get("high_note");
		let high_vel = formData.get("high_vel");
		
		let high;
		let low;
		
		if( !low_chan || !low_note || !low_vel ){
			low_chan = low_note = low_vel = null;
		}
		else {
			low = {
				channel :  Number(low_chan),
				note : Number(low_note),
				velocity : Number(low_vel)
			}
		}
		if( !high_chan || !high_note || !high_vel ){
			high_chan = high_note = high_vel = null;
		}
		else {
			high = {
				channel :  Number(high_chan),
				note : Number(high_note),
				velocity : Number(high_vel)
			}
		}
		
		const req_data = {
			enabled,
			low,
			high
		}
		
		const req = await fetch("/components/midish/api/metronome", {
			method:"post", 
			headers: {"Content-Type": "application/json"}, 
			body : JSON.stringify(req_data)
		});
		
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error("Could not update Loop mode " + msg);
		}
		else {
			AppStatus.success("Loop mode updated (may require stop & play)")
		}
		this.requestInProgress = false;
	},
	
	async requestDeleteFilterRule(rule){
		this.requestInProgress = true;
		
		const req = await fetch('/components/midish/api/curfilt/delete_rule', {method:'post', headers: {"Content-Type": "application/json"}, body: JSON.stringify(rule) });	
		
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error(msg);
			AppStatus.error("Could not add Filter Rule");
		}
		else {
			AppStatus.success("Filter Rule created")
		}
		this.requestInProgress = false;
	}
	
	
}));


class EvspecBuilder{
	
	ev_keys = [];
	
	constructor(){
		this.Types = Evspec.Types;
		this.type_name = "none";
	}

	setAllowedTypes(list_of_type_names){
		const Types = Evspec.Types;
		const entries = Object.entries(Types);
		const filtered_entries = entries.filter( ([key,value] ) => list_of_type_names.includes(key) );
		this.Types = Object.fromEntries(filtered_entries);
		return this;
	}

	toJSON(){
		return this.ev.toJSON();
	}

	has_channels_and_devices(){
		return this.type_name !== "none";
	}
	
	get type_name(){
		return this._type_name;
	}

	set type_name(type_name){
		const Type = Evspec.getConstructorByTypeName(type_name);
		const ev = new Type();
		
		
		// only listen to events that come from the input device I guess ?
		// if(ev.devices){
			// ev.devices.start = 1;
			// ev.devices.end = 1;
		// }
		
		this.adopt_event(ev);
		this._type_name = type_name
	}
	
	adopt_event(ev){
		
		this.ev = ev;
		this.ev_keys = [];
		this._type_name = ev.type;
		
		switch(ev.type){
			
			case  "note" :
				this.ev_keys = [{ key : "Note", val : ev.notes  }];
			break;	
			
			case  "ctl" :
			case  "xctl" :
				this.ev_keys = [{ key : "Control", val : ev.controls  }];
			break;		
			
			case  "xpc" :
			this.ev_keys = [
				{ key : "Bank", val : ev.bank },
				{ key : "Patch", val : ev.patch },
			];
			break;	
			
			case  "nrpn" :
				this.ev_keys = [{ key : "Parameter", val : ev.param_number  }];
			break;			
		}
		
	}
	
}

class TapEventBuilder extends EvspecBuilder{
	
	constructor(){
		super();
		this.tap_enabled = "off";
		this.enabled = midishStore.session.state.tap;
		this.adopt_event(midishStore.session.state.tapev);
	}
	
	async submit(){
		
		this.requestInProgress = true;
		
		const ev = this.ev;
		const enabled = this.enabled;
		const message = {ev,enabled}
		
		const req = await fetch('/components/midish/api/tapev/', {method:'post', headers: {"Content-Type": "application/json"}, body: JSON.stringify(message) });	
		
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error("Could not update Tap Event " + msg);
		}
		else {
			AppStatus.success("Tap Event updated")
		}
		this.requestInProgress = false;
		
	}
}


Alpine.data("midish_filter_rule_builder", ()=>({
	

	TypesConstructors : {
		
		evmap(){
			let rule = {
				type : "evmap",
				match : new EvspecBuilder(),
				action : new EvspecBuilder(),
			};
			return rule;
		}, 
		
		transp(){
			let rule = {
				type : "transp",
				match : ( new EvspecBuilder() ).setAllowedTypes(["note", "any"]),
				halftones : 0,
			};
			return rule;
		}, 
		
		vcurve(){
			let rule = {
				type : "vcurve",
				match :  ( new EvspecBuilder() ).setAllowedTypes(["note", "any"]),
				weight : 0,
			};
			return rule;
		}, 
		
	},
	

	
	
	set rule_type( filter_rule_type_name ){
		this.rule = this.TypesConstructors[filter_rule_type_name]();
		
	},
	
	get rule_type(){
		return this.rule.type;
	},
	
	get match(){
		return this.rule.match;
	},
	
	rule : {},
	
	init(){
		this.rule = this.TypesConstructors.evmap();
	},
	
	async submit_filter_rule(){
		
		this.requestInProgress = true;
		const rule = this.rule;
		const req = await fetch('/components/midish/api/curfilt/add_rule', {method:'post', headers: {"Content-Type": "application/json"}, body: JSON.stringify(rule) });	
		
		if (!req.ok) {
			const msg = await req.text();
			AppStatus.error(msg);
			AppStatus.error("Could not add Filter Rule");
		}
		else {
			AppStatus.success("Filter Rule created")
		}
		this.requestInProgress = false;
		
	}
	
}));


Alpine.data("tapev_builder", ()=> new TapEventBuilder() );

export const template = parse(templateTxt)