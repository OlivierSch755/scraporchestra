import Alpine from '/js/lib/alpine.js';
import { wsClient } from "/js/ws_client_wrapper.js";

let req =  await fetch("/components/midi_connections/widget.html");
let templateTxt = await req.text();

const parse = Range.prototype.createContextualFragment.bind(document.createRange());

Alpine.store("midi_connections", MidiGraphComponentStore());

const midiStore = Alpine.store("midi_connections");


wsClient.addEventListener("components.midi_connections.graph", (event)=>{
	let graph = event.detail;
	graph = midiStore.autoCompleteGraph(graph);
	midiStore.loaded = false;
	midiStore.graph = graph;
	midiStore.loaded = true;
});


wsClient.addEventListener("components.midi_connections.rules", (event)=>{
	let rules = event.detail;
	midiStore.rules = rules;
});



export function MidiGraphComponentStore() {
    return {
		
		rules : [],
		graph : [],
		portElements: new Map(),
		
        async init() {
            const req = await fetch('/components/midi_connections/api/graph');
			const data = await req.json();
            this.graph = this.autoCompleteGraph(data.graph);
            this.rules = data.rules;
			this.loaded = true;
        },
		
		destroy(){
			this.graph = [];
			this.rules = [];
			this.loaded = false;
		},
		
		DialogConnectionModal : {
			receiver : null,
			sender : null,
			options : []
		},
		
		// User wants this port to receive midi to another port
		prepareUiFromPortDialog(port){
			this.DialogConnectionModal.receiver = port;
			this.DialogConnectionModal.sender = null;
			this.DialogConnectionModal.options = this.graph.ports.filter( p =>{
				
				// do not propose to connect a port to itself
				if(port === p) return false;
				
				// this other port is already sending into this port
				if( p.ui_connections.ui_to.includes(port) ) return false;
				
				// only allow ports that can send midi 
				if( p.direction === "DUPLEX" || p.direction === "OUT" ){
					return true;
				}
				
			} )
			
		},
		
		// User wants this port to send midi to another port
		prepareUiToPortDialog(port){
			this.DialogConnectionModal.receiver = null;
			this.DialogConnectionModal.sender = port;
			this.DialogConnectionModal.options = this.graph.ports.filter( p =>{
				
				// do not propose to connect a port to itself
				if(port === p) return false;
				
				// this other port is already sending into this port
				if( p.ui_connections.ui_from.includes(port) ) return false;
				
				// only allow ports that can receive midi 
				if( p.direction === "DUPLEX" || p.direction === "IN" ){
					return true;
				}
				
			} )
		},
		
		requestInProgress : false,
		
		async requestPortDisconnect(sender,receiver){
			this.requestInProgress = true;
			try{
				let sender_identifier = this.getPortIdentifier(sender);
				let receiver_identifier = this.getPortIdentifier(receiver);
				const req = await fetch('/components/midi_connections/api/disconnect/'+ sender_identifier + "/" + receiver_identifier , {method:'post'});		
				// const res = await req.text();
			}
			catch(err){
				Alpine.store('status').message = err;
			}
			this.requestInProgress = false;
		},
		
		
		async requestPortConnect({sender_identifier,receiver_identifier, optional}){
			
			this.requestInProgress = true;
			
			optional = optional?1:0;
			
			try{
				const req = await fetch('/components/midi_connections/api/connect/'+ sender_identifier + "/" + receiver_identifier + "/" + optional , {method:'post'});		
				// const res = await req.text();
			}
			catch(err){
				Alpine.store('status').message = err;
			}
			this.requestInProgress = false;
		},
		
		async requestRuleDeletion(rule){
			this.requestInProgress = true;
			try{
				const req = await fetch('/components/midi_connections/api/delete_rule/'+ rule.id, {method:'post'});		
				// const res = await req.text();
			}
			catch(err){
				Alpine.store('status').message = err;
			}
			this.requestInProgress = false;
		},
		
		getPortIdentifier(port){
			return `${port.client_id}:${port.id}`;
		},
		
		
		getPortNameWithClientName(port){
			let client = this.graph?.clients[port.client_id];
			return `${client?.name} : ${port.name}`;
		},
		

		autoCompleteGraph(graph){
			graph.ports = [];
			
			for(let client of Object.values(graph.clients) ){
				client.ports.forEach( port => {
					port.ui_connections = {
						ui_from : [], 
						ui_to : []
					}
					graph.ports.push(port);
				});  
			}
			
			graph.ports.forEach( port => {
				port.connections.forEach( connection =>{
					let receiver = graph.clients[ connection.receiver_client_id ]?.ports?.find( p => p.id === connection.receiver_port_id )
					if(!receiver) return;
					receiver.ui_connections.ui_from.push(port) 
					port.ui_connections.ui_to.push(receiver);
				});
			});
			
			graph.ports = graph.ports.filter( port => port.name.startsWith('midish-internal') === false  )
			
			return graph;
		}
    }
}

Alpine.data("MidiComponent", ()=>({
	
	get midi(){
		return midiStore;
	},
	
	get rules(){
		return midiStore.rules;
	},
	
	get graph(){
		return midiStore.graph;
	},
	
	get requestInProgress(){
		return midiStore.requestInProgress;
	},
	

}))


Alpine.effect(() => {
    const enabled = Alpine.store("engine")
        .project?.components?.midi_connections;

    if (enabled && !midiStore.loaded) {
        midiStore.init();
    }

    if (!enabled && midiStore.loaded) {
        midiStore.destroy();
    }
});



export const template = parse(templateTxt)