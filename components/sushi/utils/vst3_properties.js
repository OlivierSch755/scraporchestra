/*

Current implementation of Sushi does not allow to save and restore string properties set with Elk-plugin-extension. 
So we save and restore that ourselves in a separate file.

This code provides two function to execute just after restoring session 

*/



const {unary} =  require("./grpc_helpers.js");

// Save session vst3 string properties
async function onSessionSave( client, proto, session ){
	
	const TypeVst3 = proto.lookupEnum("PluginType.Type").values.VST3X; // identifier for vst3 plugins
	
	// Sushi methods used in this scope 
	const { GetProcessorId } = proto.lookupService("AudioGraphController").methods;
	const { GetProcessorProperties, GetPropertyValue } = proto.lookupService("ParameterController").methods;
	
	
	/*
	This is what we return, 
	a plain js object that lists VST3 processors, and their string properties :
		{ 
			processor.name : {
				property_1_name : property_1_value, 
				property_2_name : property_2_value, 
				...etc 
			}
		}
		
		
	*/
	const result = {}; 
	
	// this is just a flag that inspection code will set to true to signal that something worthwile saving has been found
	let found_non_empty_properties_in_session = false;
	
	
	// We inspect the session and search for VST3 plugins (processors)
	const procs_with_vst3x = [];
	for( let track of session.tracks ){
		for ( let processor of track.processors ){
			if(processor.type.type === TypeVst3){
				procs_with_vst3x.push(processor)
			}
		}
	}
	
	// We inspect each VST3 processor and look for properties values that are not null
	const jobs = [];
	for (processor of procs_with_vst3x){
		jobs.push ( inspectProcessorState(processor) );
	}

	async function inspectProcessorState( processor ){
		
		// Goal of this function is to make this object represent properties keys and values of this processor
		const properties_entries = {};
		
		let found_non_empty_properties_in_proc = false;
		
		// Get the ID of the processor (not available in session export, so we retrieve it by name)
		const res = await unary( client, GetProcessorId, {value : processor.name } );
		const processor_id = res.id;
		
		// Once we get the processor ID, we can get a list of all its properties  (this only return property metadata, so we do not have the value yet)
		const property_info_list = await unary( client,  GetProcessorProperties,  {id : processor_id} );

		// loop on all found properties
		for( let property_info of property_info_list.properties ){
			
			// Use the property id to get the actual value
			const property_value = await unary( client, GetPropertyValue, { processor_id, property_id : property_info.id } );
			
			// skip creating empty entries
			if( property_value.value == false ){
				continue;
			}
			
			// indicate that we have something to save for this processor
			found_non_empty_properties_in_proc = true;
			found_non_empty_properties_in_session = true;
			
			// and feed it into our object
			properties_entries[property_info.name] = property_value.value;
		}
	
		// Finally, update result with this processor inspection
		// but only if we found at least one non-empty string properties on the vst3 processor
		if( found_non_empty_properties_in_proc ){
			result[processor.name] = properties_entries;
		}
	}

	await Promise.allSettled(jobs)

	if(found_non_empty_properties_in_session){
		return result;
	} 

	return null;
	
		
}


// load session vst3 string properties
async function onSessionRestore( client, proto, data_to_restore ){
	

	// Sushi methods used in this scope 
	const { GetProcessorId } = proto.lookupService("AudioGraphController").methods;
	const { SetPropertyValue, GetPropertyId  } = proto.lookupService("ParameterController").methods;
	
	const jobs = [];

	for( let processor_entry of Object.entries(data_to_restore) ){
		const [processor_name,properties] = processor_entry;
		for( let property_entry of Object.entries(properties) ){
			const [property_name, property_value] = property_entry;
			jobs.push( restorePropertyValue(processor_name, property_name, property_value) );
		}
	}
		
		
	async function restorePropertyValue( processor_name, property_name, property_value ){
		
		// Get the ID of the processor in current graph
		let res = await unary( client, GetProcessorId, {value : processor_name } );
		const processor_id = res.id;
		
		// Get the ID of the property in current graph
		res = await unary( client, GetPropertyId, { processor : {id : processor_id },  property_name  } );
		const property_id = res.id;
		
		
		// Set property value once we got the full property identifier
		res = await unary( client, SetPropertyValue, { property : property_id, value : property_value  } );
		
	}	
	
	await Promise.allSettled(jobs);
		
}


module.exports = {
	onSessionSave, 
	onSessionRestore
}