const path = require('node:path');
const {spawn, exec} = require("node:child_process");
const fs = require("node:fs/promises");
const {isDeepStrictEqual} = require("node:util");
const Dispatcher = require("engine/dispatcher");
const {ComponentState} = require("engine/component");
const {ComponentProcess} = require("engine/component/process");

const {
	ComponentError,
	ComponentUnexpectedlyTerminatedError,
	ComponentNotProperlyClosedError,
	ComponentInvalidError,
	ComponentNotFoundError
} = require("engine/component/errors");


class MidiConnectionsError { constructor(message){ this.message = message } }

class MidiConnections extends ComponentProcess{
	
	static has_web_controller = true;
	
	static get_default_config =()=> require( "./default_config.json" );
	
	graph;
	rules = [];
	all_rules_ok = false;
	static bin = path.resolve( path.join( __dirname, "bin", "alsa_watch" ) );
	
	
	constructor( config, project ){
		super( config, project ); // will populate this.project and this.config
		
		if(config?.rules){
			this.rules = config.rules.map( raw_rule => Rule.fromJSON( raw_rule ) )
		}
		else {
			this.rules = config?.rules ?? [];
		}
		
		config.toJSON = ()=>{
			return {rules : this.rules}
		}
		
		this.snapshot_version = 0;
		
	}
	
	initialize(){
	
		this.state = ComponentState.LOADING;
		
		this.graph = new MidiGraph();
		
		const spawn_args = [];
		this.instance = spawn( MidiConnections.bin,spawn_args, {env : this.env} );

		// automatic handling of error and close events (uses this.state to watch if close event is expected)
		this.handleClose(this.instance);
		this.handleError(this.instance);
		
		return new Promise( (resolve,reject)=>{
			
			// only notify readiness on first parsed snapshot, then just run normally
			this.instance.stdout.once('data', (data) => {
				
				this.parseSnapShot(data);
				
				this.instance.stdout.on('data', (data) => {
					this.parseSnapShot(data);
				});
				
				resolve();
			});
			
		});
		

			
	}


	/*
		This should filter out event from midish-bridge inner ports 
	*/
	parseSnapShot(data){
		
		const version = this.snapshot_version++;
		const old_graph = this.graph;
		let	graph = this.graph = null;
		
		const text = data.toString();


		/*
			We may sometime get multiple snapshots in a single frame
			we discard everything but the last state.
		*/
		const lastSnap = text.lastIndexOf("SNAP");
		const lastEnd = text.indexOf("END", lastSnap);

		if (lastSnap === -1 || lastEnd === -1) return;

		const snapshot = text.slice(lastSnap, lastEnd);
		const lines = snapshot.split("\n");
		
		for(let line of lines){
			
			
			if( line.startsWith("SNAP") ) {
				graph = this.graph = new MidiGraph();
				graph.version = version;
				
			}
			
			if(line.startsWith("CLIENT")){
				const parsed = /^CLIENT\s(?<id>\d+)\s(?<type>\d)\s(?<name>.*$)/.exec(line)?.groups;
				const client = new Client();
				Object.assign( client , parsed);
				graph.clients[client.id] = client;
			}
			
			if(line.startsWith("PORT")){
				let parsed = /^PORT\s(?<client_id>\d+)\s(?<id>\d+)\s(?<direction>\d+)\s(?<name>.*$)/.exec(line)?.groups;
				let port = new Port();
				Object.assign( port , parsed);
				
				switch (port.direction){
					case "1" :
						port.direction = "OUT"
					break;
					case "2" :
						port.direction = "IN"
					break;
					case "3" :
						port.direction = "DUPLEX"
					break;
				}
				graph.clients[port.client_id].ports.push(port)
				graph.ports.push(port);
			}
			
			if(line.startsWith("LINK")){
				let parsed = /^LINK\s(?<sender_client_id>\d+)\s(?<sender_port_id>\d+)\s(?<receiver_client_id>\d+)\s(?<receiver_port_id>\d+)/.exec(line)?.groups;
				let link = new Connection();
				Object.assign( link , parsed );
				
				graph.clients[ link.sender_client_id ]
					?.getPortById( link.sender_port_id )
					?.connections
					?.push( link )
			}
		}
		
		if( old_graph && isDeepStrictEqual(old_graph, graph) ){
			return;
		}
		
		Dispatcher.emit("component.midi_connections.graph", graph );
		this.execRules();
	}
	
	hydrateSenderReceiver(sender_addr, receiver_addr){
		let [sender_client_id, sender_port_id] = sender_addr.split(":");
		let [receiver_client_id, receiver_id] = receiver_addr.split(":");
		
		// verify if both those address points to elements that exist in the graph
		
		let sender_port = this.graph.getPortByAddress( sender_client_id, sender_port_id );
	
		if(!sender_port) throw new MidiConnectionsError("Unknown sender port : " + sender_addr);

		let receiver_port = this.graph.getPortByAddress( receiver_client_id, receiver_id );
		
		if(!receiver_port) throw new MidiConnectionsError("Unknown receiver port : " + receiver_addr);
			
		return { sender_port, receiver_port};
	}
	
	async addRuleFromAddresses(sender_addr, receiver_addr, optional = false){
		const  { sender_port, receiver_port} = this.hydrateSenderReceiver(sender_addr, receiver_addr);
		
		const already_exists = this.rules.find( rule => {
			return rule.wanted_sender === sender_port && rule.wanted_receiver === receiver_port
		});
		
		if(!already_exists){
			await this.connectPorts(sender_port, receiver_port);
			
			let sender_client = this.graph.getClientFromPort(sender_port);
			let receiver_client =  this.graph.getClientFromPort(receiver_port);
			
			let rule = new Rule(sender_client, sender_port, receiver_client, receiver_port, optional);
			this.addRule(rule);
		}
		
		
	}
	
	deleteRuleFromAddresses(sender_addr, receiver_addr){
		const  { sender_port, receiver_port} = this.hydrateSenderReceiver(sender_addr, receiver_addr);
		
		let concerned_rule = this.rules.find( rule => {
			return rule.wanted_sender === sender_port && rule.wanted_receiver === receiver_port
		});
		
		this.rules = this.rules.filter( rule => rule !== concerned_rule );
		return (
			this.disconnectPorts(sender_port,receiver_port)
			.then( x=> this.execRules() )
			.then( x=> this.notifyRulesChange() )
		)

	}
	
	deleteRuleFromId(id_rule){
		
		id_rule = parseInt(id_rule);
		const concerned_rule = this.rules.find( r => r.id === id_rule);
		if( !concerned_rule ) throw new MidiConnectionsError("Unknown rule id : " + id_rule);
		this.rules = this.rules.filter( rule => rule !== concerned_rule );
		if( concerned_rule.passed ){
			const {wanted_sender,  wanted_receiver} = concerned_rule;
			return (
				this.disconnectPorts(wanted_sender,wanted_receiver)
				.then( x=> this.execRules() )
				.then( x=> this.notifyRulesChange() )
			)
		}
		else{
			this.execRules();
			this.notifyRulesChange();
		}
	}
	
	disconnectPorts(sender_port,receiver_port){
		return new Promise( (resolve,reject)=>{
			exec(`aconnect -d ${sender_port.toAddr()} ${receiver_port.toAddr()}`, (err, stdout, stderr)=>{
				
				if(err){
					let err2 = new MidiConnectionsError(`Cannot disconnect [${sender_port.toAddr()} ${receiver_port.toAddr()}]` )
					err2.cause = err;
					reject( err2 )
				}
				
				if(stderr){
					let err2 = new MidiConnectionsError(`Cannot disconnect [${sender_port.toAddr()} ${receiver_port.toAddr()}]` )
					err2.cause = stderr;
					reject( err2 )
				}
				
				resolve();
			} );
		} )
	}
	
	connectPorts(sender_port,receiver_port){
		return new Promise( (resolve,reject)=>{
			exec(`aconnect ${sender_port.toAddr()} ${receiver_port.toAddr()}`, (err, stdout, stderr)=>{
				
				if(err){
					let err2 = new MidiConnectionsError(`Cannot connect [${sender_port.toAddr()} ${receiver_port.toAddr()}]` )
					err2.cause = err;
					reject( err2 )
				}
				
				if(stderr){
					let err2 = new MidiConnectionsError(`Cannot connect [${sender_port.toAddr()} ${receiver_port.toAddr()}]` )
					err2.cause = stderr;
					reject( err2 )
				}
				
				resolve();
			} );
		} )
	}
	
	addRule( rule ){
		this.rules.push(rule);
		this.execRules();
		this.notifyRulesChange();
		
	}
	
	notifyRulesChange(){
		Dispatcher.emit("component.midi_connections.rules", this.rules.map( r => r.toClientJSON() ) );
	}
	
	execRules(){
		
		
		let oldstate = [];
		let new_state = [];
		
		let result = true;
		
		for(let rule of this.rules){
			oldstate.push(rule.passed);
			this.execRule(rule);
			result = result && ( rule.passed || rule.optional );
			new_state.push(rule.passed)
		}
		
		// check length > 0 to make sure there is a notification if user removed last missing connection
		if( new_state.length && isDeepStrictEqual(oldstate, new_state) && this.did_exec_rules_once === true){
			return; // no new info
		}
		
		this.did_exec_rules_once = true
		
		this.notifyRulesChange();
		this.all_rules_ok = result;
		
		
		// do not change state if currently closing 
		// we need to keep the closing state so intance exit will not throw
		if( this.state === ComponentState.CLOSING ) return;
		
		if( this.all_rules_ok ){
			this.state = ComponentState.READY;
		} 
		else{
			this.state = ComponentState.ERROR;
		}
		
	}

	execRule(rule){
		
		
		rule.passed = false; // goal is to prove this wrong
		
		let wanted_sender_client = this.graph.getClientByName( rule.sender_client_name  );
		
		let wanted_sender_port = wanted_sender_client?.getPortByName( rule.sender_port_name );
		
		let wanted_receiver_client = this.graph.getClientByName( rule.receiver_client_name  );
		let wanted_receiver_port = wanted_receiver_client?.getPortByName( rule.receiver_port_name );
		
		if( !wanted_sender_port || !wanted_receiver_port ){
			return;
		}
		
		rule.wanted_sender = wanted_sender_port;
		rule.wanted_receiver = wanted_receiver_port;
		
		// check if the ports described by this rules are already connected 
		let is_connected = wanted_sender_port.connections.some( c => {
			if( c.receiver_client_id !== wanted_receiver_port.client_id ){
				return false;
			}
			if( c.receiver_port_id !== wanted_receiver_port.id ){
				return false;
			}
			return true;
			
		} );
			
		// If not connect them right now.
		// If this operation succeeds, it will trigger a new snapshot 
		// which will in turn re-evaluate all rules.
		// So we don't wait for anything here
		if(!is_connected){
			try{
				const r = exec(`aconnect ${wanted_sender_port.toAddr()} ${ wanted_receiver_port.toAddr()}`);
			}
			catch(err){
				is_connected = false;
			}
		}
		rule.passed = is_connected;
	}

	getGraphAndRules(){
		return {
			graph : this.graph,
			rules : this.rules.map( r => r.toClientJSON() )
		}
	}

	toJSON(){
		const data = super.toJSON();
		return data;
	}
	
	
	/*
		saveProjectSession is a component method inherited from parent class.
		
		It represents the action of "saving whatever is inside the program instance we are managing".
		However here our program instance is only reporting events and has no internal state.
		
		So we have nothing to save (rules are saved to the component CONFIG, which is different from the component SESSION). 
		
		We still need to override this class method so Component.saveProjectSession() won't be fired. 
		Because it explicitely refuses to save a project session when component state is not READY. 
		
		And for midi connections we WANT to allow that to happen. 
		Because otherwise user will be forced to plug each piece of midi hardware required 
		in project before they can save modifications. 
		
		Picture a scenario where user just want to load a project add a new midi controller (let's say a piano keyboard) and save. 
		User should be able to do this even if project requires another midi device (let's say a midi drum kit) that is not currently connected.
		
	*/
	saveProjectSession(){}
	
	
}


class Rule{
	
	static id = 0;
	
	static generateID(){
		return this.id++;
	}
	
	id;
	
	wanted_sender;
	wanted_receiver;
	sender_client_name;
	sender_port_name;
	receiver_client_name;
	receiver_port_name;
	optional = false;
	passed = false;
	constructor(sender_client, sender_port, receiver_client, receiver_port, optional = false){
	
		this.sender_client_name = sender_client?.name;
		this.sender_port_name = sender_port?.name;
		this.receiver_client_name = receiver_client?.name ;
		this.receiver_port_name = receiver_port?.name;
		this.optional = optional;
		this.id = Rule.generateID();
	}
	
	
	static fromJSON(ob){
		
		const {sender_client_name, sender_port_name, receiver_client_name, receiver_port_name, optional} = ob;
		
		if( [sender_client_name, sender_port_name, receiver_client_name, receiver_port_name, optional].some( x=> x === null) ){
			throw new TypeError("Error while parsing midi rule");
		}
		
		let rule = new Rule();
	
		rule.sender_client_name = sender_client_name;
		rule.sender_port_name = sender_port_name;
		rule.receiver_client_name = receiver_client_name;
		rule.receiver_port_name = receiver_port_name;
		return rule;
		
	}
	
	toJSON(){
		return {
			sender_client_name : this.sender_client_name,
			sender_port_name : this.sender_port_name,
			receiver_client_name : this.receiver_client_name,
			receiver_port_name : this.receiver_port_name,
			optional : this.optional
		}
	}
	
	toClientJSON() {
		return {
			...this.toJSON(),
			passed: this.passed,
			id: this.id,
		};
	}
	
}

class MidiGraph{
	
	clients = {};
	ports = [];
	
	getPort(id_client,id_port){
		return this.clients[id_client].getPortById(id_port);
	}
	
	getPortByName(name){
		return this.ports.find( port=> port.name === name );
	}
	
	getPortByAddress(client_id, port_id){
		return this.clients[client_id]?.ports?.find( port => port.id === port_id);
	}
	
	getClientFromPort(port){
		return this.clients[port.client_id];
	}
	
	getClientByName(name){
		return Object.values(this.clients).find(client => client.name === name);
	}
	
	toJSON(){
		return {clients : this.clients};
	}
	
}

class Client{
	id;
	name;
	type;
	ports = [];
	getPortById(id){
		return this.ports.find( p => p.id === id);
	}
	getPortByName(name){
		return this.ports.find( port=> port.name === name );
	}
}

class Port{
	id;
	client_id;
	connections = [];
	toAddr(){
		return this.client_id + ":" + this.id;
	}
}

class Connection{
	sender_client_id;
	sender_port_id;
	receiver_client_id;
	receiver_port_id;
}

module.exports = MidiConnections;


