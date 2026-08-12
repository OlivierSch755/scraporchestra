import Alpine from '/js/lib/alpine.js';
import { wsClient } from "/js/ws_client_wrapper.js";

let req =  await fetch("/components/sushi/widget.html");
let templateTxt = await req.text();

const parse = Range.prototype.createContextualFragment.bind(document.createRange());
const AppStatus = Alpine.store('status');

wsClient.addEventListener("component.sushi.editor", (event)=>{
	Alpine.store("engine").project.components.sushi.editor_open = event.detail;
});


Alpine.data("sushi", (config)=> ({
	config : Alpine.raw(config),
	
	envLines: Object.entries(config.env).map( ( [k,v] ) => `${k}=${v}`  ).join("\n\n"),
	
	requestInProgress : false,
	
	
	parseEnvLines(){
		return Object.fromEntries( this.envLines.split("\n\n").map( line => line.split("=") ) );
	},
	
	show_env_as_json(){
		const env = this.parseEnvLines();
		window.alert(JSON.stringify(env, null,"\t"))
	},
	
	
	
	
	async submitConfig(){
		this.requestInProgress = true;
		
		const config = Alpine.raw(this.config);
		config.env = this.parseEnvLines();
		this.envLines = Object.entries(config.env).map( ( [k,v] ) => `${k}=${v}`  ).join("\n\n");
		
		const req = await fetch('/components/sushi/api/save_config', {method:'post', headers: {"Content-Type": "application/json"}, body: JSON.stringify( this.config ) });		
		if (!req.ok) {
			AppStatus.error("Could not save Sushi config");
		}
		else {
			this.base_config = this.config;
			AppStatus.success("Sushi config saved (will be effective on component restart)")
		}
		this.requestInProgress = false;
	}

}));


export const template = parse(templateTxt)