import Alpine from '/js/lib/alpine.js';
import { wsClient } from "/js/ws_client_wrapper.js";

let req =  await fetch("/components/pure_data/widget.html");
let templateTxt = await req.text();


const AppStatus = Alpine.store('status');


Alpine.data("pd", (config)=> ({ 

	config : Alpine.raw(config),
	base_config : structuredClone(Alpine.raw(config)),
	EditorStates :{
		AWAITING_PD_REQUEST : 1,
		AWAITING_GUI_CONNECTION : 2,
		READY : 3,
		CLOSED : 4
	},
	
	init(){
		this.component = this.$data.component;
	},
	
	
	requestInProgress : false,
	
	get state(){ return this.component.editor_state ?? this.EditorStates.CLOSED }, 
	get btn_txt(){
		if( this.state === this.EditorStates.CLOSED ){
			return 'Start Editor';
		}
		 return 'Stop Editor'
	}, 
	
	get click(){
		this.requestInProgress = true;
		if( this.state === 4 ){
			fetch( '/components/pure_data/api/editor/start', {method:'post'} )
			.then( ()=> this.requestInProgress = false )
			return;
		}
		fetch( '/components/pure_data/api/editor/stop', {method:'post'} )
		.then( ()=> this.requestInProgress = false )
	},
	
	get stateHr(){
		switch(this.state){
			case (this.EditorStates.AWAITING_GUI_CONNECTION) : 
				return 'awaiting remote GUI connection'
			case (this.EditorStates.READY) : 
				return 'running'
			default :
				return 'closed'
		}
	},
	
	
	configNotChanged(){
		const a = this.config;
		const b = this.base_config;
		const equal = Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => Object.is(v, b[k]));
		return equal;
	},
	
	async submitConfig(){
		this.requestInProgress = true;
		const req = await fetch('/components/pure_data/api/save_config', {method:'post', headers: {"Content-Type": "application/json"}, body: JSON.stringify( this.config ) });		
		if (!req.ok) {
			AppStatus.error("Could not save pure data config")
		}
		else {
			this.base_config = this.config;
			AppStatus.success("Pure Data config saved (will be effective on component restart)")
		}
		this.requestInProgress = false;
	}
	
}))


const parse = Range.prototype.createContextualFragment.bind(document.createRange());



wsClient.addEventListener("component.pd.editor", (event)=>{
	console.log("pd state", event.detail)
	
	const pd_store = Alpine.store("pure_data")
	const pd_runtime = Alpine.store("engine").project.components.pure_data;
	
	const state = event.detail;
	console.log("pd_runtime.editor_state", state)
	pd_runtime.editor_state = state;
});


export const template = parse(templateTxt)