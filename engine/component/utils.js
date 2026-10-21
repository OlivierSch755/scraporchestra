const path = require("node:path");
const fs = require('node:fs/promises');

let components_cache = null;

const {	ComponentInvalidError } = require("./errors.js");



let components_path = path.dirname( require.resolve('components') );

// mainly for testing
if( process.env.COMPONENTS_PATH ){
	components_path = process.env.COMPONENTS_PATH
}


function lookupComponent(component_name){

	let component;
	let component_path = path.join(components_path, component_name, component_name + ".js"  );
	
	try{
		component = require( component_path );
	}
	catch(err){
		const err2 = new ComponentInvalidError(`Invalid component : ${component_name}`);
		err2.cause = err;
		throw err2;
	}
	
	return component;
}

// scan file system for existing components
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

// get all available (installed) components
// returns object with object[component_name] = class_constructor 
async function getAllComponents(){

	if(components_cache ) return components_cache;
	
	const list = await listComponents();
	const components_classes = Object.fromEntries( 
		list.map( component_name => {
			let component_path = path.join(components_path, component_name, component_name + ".js"  );
			return [component_name, require(component_path) ]
		}) 
	);

	const prom = [];
	const result = [];
	for( const [name, component_class] of Object.entries(components_classes) ) {
		
		prom.push(
			component_class.verifyDependencies()
				.then( (installed)=> {
					if(!installed) return;
					result.push( [name, component_class] );
				})
		 );
		 
	}
	
	await Promise.allSettled(prom);
	components_cache = Object.fromEntries( result );
	return components_cache
}


function getEngineLoadedComponent(engine, component_name){
	const loaded_component = engine?.project?.components[component_name];
	if( loaded_component ) return loaded_component;
	return null;
}



module.exports = {
	lookupComponent,
	listComponents,
	getAllComponents,
	getEngineLoadedComponent
}