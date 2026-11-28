const path = require('node:path');
const {spawn, exec} = require("node:child_process");
const fs = require("node:fs/promises");
const {isDeepStrictEqual} = require("node:util");
const Dispatcher = require("engine/dispatcher");
const {RessourceState} = require("engine/states");
const {ComponentProcess} = require("engine/component/process");

const {DataSection} = require("engine/data_section");

class MidiConnectionsError { constructor(message){ this.message = message } }


const dispatch_path = "component.midico";

class MidiConnections extends ComponentProcess{
	
	static has_web_controller = true;
	
	static get_default_config =()=> require( "./default_config.json" );

	all_rules_ok = false;
	static bin = path.resolve( path.join( __dirname, "bin", "alsa_watch" ) );
	
	constructor( config, project, name ){
		
		// will populate this.project and this.config
		// also the name handling is not terrible ...
		super( config, project, "midi_connections" ); 
		
		const rules = config?.rules 
			? config.rules.map( raw_rule => Rule.fromJSON( raw_rule ) ) 
			: [];
		
		this.rulesData = new DataSection( dispatch_path,"rules", { rules } );
		this.graphData = new DataSection( dispatch_path,"graph", { graph : new MidiGraph() } );
		
		// Graph represents current connections (hardware that is connected right now
		// we don't care what was connected in last session, we only care about what 
		// is connected now so we only save rules, not graph.
		config.toJSON = ()=>{
			return {rules : this.rulesData.rules.map( rule => rule.toLocalSaveJSON() )}
		}
	}
	
	initialize(){
	
		this.state = RessourceState.LOADING;
		
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
		const old_graph = this.graphData.graph;
		
		let	new_graph;
		
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
				new_graph = new MidiGraph();
			}
			
			if(line.startsWith("CLIENT")){
				const parsed = /^CLIENT\s(?<id>\d+)\s(?<type>\d)\s(?<name>.*$)/.exec(line)?.groups;
				const client = new Client();
				Object.assign( client , parsed);
				new_graph.clients[client.id] = client;
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
				new_graph.clients[port.client_id].ports.push(port)
				new_graph.ports.push(port);
			}
			
			if(line.startsWith("LINK")){
				let parsed = /^LINK\s(?<sender_client_id>\d+)\s(?<sender_port_id>\d+)\s(?<receiver_client_id>\d+)\s(?<receiver_port_id>\d+)/.exec(line)?.groups;
				let link = new Connection();
				Object.assign( link , parsed );
				
				new_graph.clients[ link.sender_client_id ]
					?.getPortById( link.sender_port_id )
					?.connections
					?.push( link )
			}
		}
		
		
		let mdt = Object.values(new_graph.clients)
		.filter(x => x.name === "Midish-Transport");

		const excludeInternal = ports => ports.filter(x => !x.name.startsWith("midish-internal"));

		new_graph.ports = excludeInternal(new_graph.ports);

		mdt.forEach(client => {
			client.ports = excludeInternal(client.ports);
		});

		if (old_graph && isDeepStrictEqual(old_graph, new_graph)) {
			return;
		}

		this.graphData.graph = new_graph;
		this.graphData.increaseRevision();
		this.graphData.notifyChange();

		this.execRules();
	}
	
	hydrateSenderReceiver(sender_addr, receiver_addr){
		
		const graph = this.graphData.graph;
		
		
		let [sender_client_id, sender_port_id] = sender_addr.split(":");
		let [receiver_client_id, receiver_id] = receiver_addr.split(":");
		
		// verify if both those address points to elements that exist in the graph
		
		let sender_port = graph.getPortByAddress( sender_client_id, sender_port_id );
	
		if(!sender_port) throw new MidiConnectionsError("Unknown sender port : " + sender_addr);

		let receiver_port = graph.getPortByAddress( receiver_client_id, receiver_id );
		
		if(!receiver_port) throw new MidiConnectionsError("Unknown receiver port : " + receiver_addr);
			
		return { sender_port, receiver_port};
	}
	
	async addRuleFromAddresses(sender_addr, receiver_addr, optional = false){
		
		const graph = this.graphData.graph;
		
		const  { sender_port, receiver_port} = this.hydrateSenderReceiver(sender_addr, receiver_addr);
		
		const already_exists = this.rulesData.rules.find( rule => {
			return rule.wanted_sender === sender_port && rule.wanted_receiver === receiver_port
		});
		
		if(!already_exists){
			await this.connectPorts(sender_port, receiver_port);
			
			let sender_client = graph.getClientFromPort(sender_port);
			let receiver_client =  graph.getClientFromPort(receiver_port);
			
			let rule = new Rule(sender_client, sender_port, receiver_client, receiver_port, optional);
			this.addRule(rule);
		}
		
		
	}

	
	deleteRuleFromId(id_rule){
		
		id_rule = parseInt(id_rule);
		const concerned_rule = this.rulesData.rules.find( r => r.id === id_rule);
		if( !concerned_rule ) throw new MidiConnectionsError("Unknown rule id : " + id_rule);
		this.rulesData.rules = this.rulesData.rules.filter( rule => rule !== concerned_rule );
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
		this.rulesData.rules.push(rule);
		this.execRules();

	}
	
	notifyRulesChange(){
		this.rulesData.increaseRevision();
		this.rulesData.notifyChange();
	}
	
	execRules(){
		
		const rules = this.rulesData.rules;
		
		let oldstate = [];
		let new_state = [];
		
		let result = true;
		
		for(let rule of rules){
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
		if( this.state === RessourceState.CLOSING ) return;
		
		if( this.all_rules_ok ){
			this.state = RessourceState.READY;
		} 
		else{
			this.state = RessourceState.ERROR;
		}
		
	}

	execRule(rule){
		
		const graph = this.graphData.graph;
		
		rule.passed = false; // goal is to prove this wrong
		
		let wanted_sender_client = graph.getClientByName( rule.sender_client_name  );
		
		let wanted_sender_port = wanted_sender_client?.getPortByName( rule.sender_port_name );
		
		let wanted_receiver_client = graph.getClientByName( rule.receiver_client_name  );
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

	toJSON(){
		const data = super.toJSON();
		return {
			...data,
			graph : this.graphData,
			rules : this.rulesData
		}
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
			optional : this.optional,
			passed: this.passed,
			id: this.id,
		}
	}
	
	/* 
		The data we perist server-side.
		That is to say, everything but runtime data 
			- not rule.passed : because it represents the current connection being valid right now
			- not rule.id : because it represents the id in the current runtime 
			(we could save it but it would require to rehydrate the Rule class id generator, so more work for same result)
	*/
	toLocalSaveJSON(){
		const raw = this.toJSON();
		return {
			...raw,
			passed : undefined,
			id : undefined
		}
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


