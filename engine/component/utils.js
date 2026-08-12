const path = require("node:path");
const fs = require('node:fs/promises');

let components_cache = null;


const {
	ComponentInvalidError,
	ComponentNotFoundError,
	ComponentNotLoadedError
} = require("./errors.js");

const components_path = path.dirname( require.resolve('components') );

function lookupComponent(component_name){

	let component;
	
	try{
		component = require.resolve( `components/${component_name}` );
	}
	catch(err){
		const err2 = new ComponentNotFoundError(`Component not found : ${component_name}`);
		err2.cause = err;
		throw err2;
	}
	
	try{
		component = require( `components/${component_name}` );
	}
	catch(err){
		const err2 = new ComponentInvalidError(`Invalid component : ${component_name}`);
		err2.cause = err;
		throw err2;
	}
	
	return component;
}


// returns array with name of components
async function listComponents(){
	
	const components = [];
	
	const entries = await fs.readdir( components_path, { withFileTypes: true } );
	for( const entry of entries ){
		if ( entry.isDirectory() ) {
			components.push(entry.name);
		}
	}
	return components;
}

// returns object with object[component_name] = class_constructor 
async function getAllComponents(){

	if(components_cache ) return components_cache;
	
	const list = await listComponents();
	const components_classes = Object.fromEntries( list.map( name => [name,  require("components/"+name) ] ) );

	const prom = [];
	const result = [];
	for( const [name, component_class] of Object.entries(components_classes) ) {
		
		prom.push(
			component_class.verifyDependencies()
				.then( (installed)=> {
					// console.log(name,installed ? "installation found ok" : "installation not found" );
					if(!installed) return;
					result.push( [name, component_class] );
				})
		 );
		 
	}
	
	await Promise.allSettled(prom);
	components_cache = Object.fromEntries( result );
	return components_cache
}

async function buildComponentsCache(){
		
	const components = await getAllComponents();
	const cache_path = path.join( components_path, "cache.json" );
	const content = JSON.stringify(components);
	
	await fs.writeFile(cache_path, content);
	components_cache = components;

}

function getEngineLoadedComponent(engine, component_name){
	
	const loaded_component = engine?.project?.components[component_name];
	if( loaded_component ) return loaded_component;
	return null;
}

async function installComponentsInProject( project, components  ){
	for(let component_name in components ){
		const component = components[component_name];
		await component.installProject(project);
		project.config.components[component_name] = component.get_default_config();
	}
}



module.exports = {
	lookupComponent,
	listComponents,
	getAllComponents,
	buildComponentsCache,
	getEngineLoadedComponent,
	installComponentsInProject
}