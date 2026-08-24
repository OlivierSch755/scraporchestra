
import Alpine from '/js/lib/alpine.js';
import '/js/lib/alpine_global.js';

import { Toaster } from '/js/services/toaster.js';
import { wsClient } from "/js/ws_client_wrapper.js";

const project_manager_route = "/projects/api/list";
const engine_snapshot_route = "/engine/api/snapshot";
const components_list_route = "/components/list.json";

window.wsClient = wsClient;

Alpine.store('status', new Toaster(20));
export const AppStatus = Alpine.store('status');



Alpine.store('engine', {
	
	degraded : false,
	project : null,


	States : {
		ERROR : 1,
		LOADING : 2,
		READY : 3,
		CLOSING : 4,
		CLOSED : 5
	},

	getStateHumanReadable(state){
		const key = Object.entries(this.States).find( ([key,value]) => value === state )?.[0] ?? "N/A";
		return key;
	},

	get projectName(){
		return this.project?.name;
	},
	
	hasProject(){
		return !!this.project;
	},
	
	getProjectComponent(name){
		return this.project?.components?.[name];
	},
	
	requestInProgress : false,
	
	async requestProjectStart(project_name){
		this.requestInProgress = true;
		try{
			const req = await fetch('/projects/api/open/'+ project_name, {method:'post'});		
			const res = await req.text();
		}
		catch(err){
			AppStatus.error(err);
		}
		this.requestInProgress = false;
	},

	async requestProjectClose(){
		this.requestInProgress = true;
		let req, data;
		try{
			req = await fetch("/projects/api/close", {method:"post"})
		}
		catch(err){
			AppStatus.error(err);
		}
		// data = await req.text();
		this.requestInProgress = false;
	},

	async ensure() {
		if (this.loaded) return;
		const res = await fetch(engine_snapshot_route);
		Object.assign(this, await res.json());
		this.loaded = true;
	}

});

wsClient.addEventListener("engine.snapshot", event => {
	Object.assign(Alpine.store('engine'), event.detail );
});

wsClient.addEventListener("project.state", event => {
	Alpine.store('engine').project.state = event.detail;
});

wsClient.addEventListener("component.state", event => {
	
	const {name , state} = event.detail;
	
	let project = Alpine.store('engine').project
	if(!project) return;
	
	if( !project.components[name] ){
		project.components[name] = {name , state}
	}
	else {
		project.components[name].state = state;
	}
	
});

Alpine.store('project_manager', {
	
	loading : false,
	loaded : false,
	projects : [],
	
	requestInProgress : false,
	
	async saveConfig(){
		this.requestInProgress = true;
		const project = Alpine.store("engine").project;
		if(!project) return;
		const save_config_route = "/projects/api/saveconfig/" + project.name;
		try{
			const req = await fetch(save_config_route , {method : "post"});
			if(req.ok){
				AppStatus.success("Config saved");
			}
			else {
				const err_msg = await req.text();
				throw "Could not save config: " + err_msg;
			}
		} 
		catch(err){
			AppStatus.error(err);
		}
		this.requestInProgress = false;;
	},
	
	async requestAddComponents(project,components){
		this.requestInProgress = true;
		try{
			const req = await fetch('/projects/api/add_components/'+ project.name, {method:'post', headers: {"Content-Type": "application/json"}, body: JSON.stringify(components) });		
			if(req.ok){
				AppStatus.success("Added Component(s)");
			}
			else {
				const err_msg = await req.text();
				throw "Could not add component: " + err_msg;
			}
		}
		catch(err){
			AppStatus.error(err);
		}
		
		this.requestInProgress = false;
	},
	
	async requestDeleteComponent(project,component){
		
		const confirmed = window.confirm(`Are you sure you want to remove component ${component.name}? from project ${project.name}?` + "\nThis operation is irreversible and will delete all saved configuration and session data.")
		if(!confirmed) return;
		
		this.requestInProgress = true;
		try{
			const req = await fetch('/projects/api/delete_component/'+ project.name + "/" + component.name, {method:'post'});	
			if(req.ok){
				AppStatus.success("Removed Component");
			}
			else {
				const err_msg = await req.text();
				throw "Could not remove component: " + err_msg;
			}
		}
		catch(err){
			AppStatus.error(err);
		}
		
		this.requestInProgress = false;
	},
	
	async requestNewProject( data ){

		this.requestInProgress = true;
		try{
			const req = await fetch('/projects/api/create/'+ data.project_name, {method:'post', body: JSON.stringify(data) });	
			if(req.ok){
				AppStatus.success("Project created : " + data.project_name)
			}
			else {
				const err_msg = await req.text();
				throw "Could not create project: " + err_msg;
			}
			await this.reload();
		}
		catch(err){
			AppStatus.error(err);
		}
		
		this.requestInProgress = false;
	},

	async requestDeleteProject(project_name){
		
		const confirmed = window.confirm(`Are you sure you want to remove project ${project_name}?` + "\nThis operation is irreversible and will delete all saved data.")
		if(!confirmed) return;
		
		this.requestInProgress = true;
		let req;
		try{
			req = await fetch('/projects/api/delete/'+ project_name, {method:'post'});		
			if(req.ok){ 
				AppStatus.success("Project deleted: " + project_name);
				await this.reload();
			}
			else {
				const res = await req.text();
				throw "Could not delete project: " + res;
			}
		}
		catch(err){
			AppStatus.error(err);
		}
		
		this.requestInProgress = false;
	},


	async ensure() {
		if (this.loading || this.loaded) return;
		this.loading = true;

		const res = await fetch(project_manager_route);
		this.projects = await res.json();
		
		this.loading = false
		this.loaded = true;
	}, 
	
	
	async reload(){
		this.loading = null;
		this.loaded = false;
		await this.ensure();
	}
	
	
	

});	

wsClient.addEventListener("project.new", event => {
	const new_project_config = event.detail;
	Alpine.store('project_manager').projects.push( new_project_config )
});

Alpine.store('components', {
	
	requestInProgress : false,
	loaded : false,
	loading : null,
	items : {},
	
	// this will load component widget into the current UI
	async loadComponentWidget(name, container){
		await this.ensure();
		const has_widget = this.items[name]?.has_web_controller;
		if( ! has_widget ) return;
		const widget = await import(`/components/${name}/widget.js`);
		container.append(widget.template.cloneNode(true));
	},

	projectCanLoadComponent(){
		const project = Alpine.store("engine").project;
		const all_components_already_installed = !( Object.keys( this.items ).some( c => !project.components[c] ) );
		
		return ( all_components_already_installed === false );
	},
	
	async ensure() {
		
		if (this.loaded) return;
		if(this.loading) return this.loading;
		
		let resolve, reject;
		this.loading = new Promise( (res,rej)=>{ resolve = res; reject = rej } );
		
		const res = await fetch(components_list_route);
		Object.assign(this.items, await res.json());
		this.loaded = true;
		resolve();
	},
	

});
	
Alpine.start();
window.Alpine = Alpine;
