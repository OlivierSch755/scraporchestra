/*

This file encapsulates all actions that might be required when saving and restoring Sushi sessions.
Either to work around limitations in current Sushi implementation (vst3 string properties)
or to add our own custom features later. 

*/

const fs = require("node:fs/promises");

const vst3PropertiesHelper = require("./vst3_properties")



async function onSessionSave( client, proto, session, path ){
	
	let has_data_to_save = false;
	
	let external_data = {}; // anything that must be saved, but cannot fit in the session graph
	
	const vst3_properties = await vst3PropertiesHelper.onSessionSave(client, proto, session);
	if(vst3_properties){
		external_data.vst3_properties = vst3_properties;
	}
	
	if( Object.keys(external_data).length == 0 ){
		external_data = null;
	}
	
	// we always write external data even if null (so it will overwrite previous non-empty data)
	await fs.writeFile( 
		path, 
		JSON.stringify(external_data)
	)
}

async function onSessionRestore( client, proto, session, path ){

	let external_data;
	try {
		await fs.access( path, fs.constants.R_OK );
		external_data = await fs.readFile( path );
		external_data = JSON.parse(external_data);
	}
	catch (err) {
		external_data = null;
	}
	
	if(!external_data){
		return;
	}
	
	const jobs = [];
	
	if(external_data.vst3_properties){
		jobs.push( vst3PropertiesHelper.onSessionRestore(client, proto, external_data.vst3_properties ) ); 
	}
	
	
	return Promise.allSettled(jobs);
	
}


module.exports = {
	onSessionSave, 
	onSessionRestore
}