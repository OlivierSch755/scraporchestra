import { sushiStub, commandInterface, sushiClient } from '../sushi_client/client.js';
import { EventSubscription } from '../sushi_client/event_sub.js';
import {sushiStore} from '../stores/sushi.js'
import {registry} from '../stores/sushi.js'

export const processorMonitor = new EventSubscription( "subscribeToProcessorChanges" );
await processorMonitor.listen(); // should not do that but watch graph and do this dynamically with register / forget

const ProcessorActionStub = sushiStub.lookupType("ProcessorUpdate").Action;
let deletedProcessors = new Map(); // cache deleted proc so we can reinsert them easily when it moves (delete + add)

sushiClient.addEventListener("ProcessorUpdate", async (e)=>{ 

	const ProcessorUpdate = e.detail.notification;
	
	const processorIdentifier = ProcessorUpdate.processor;
	const processor_id = processorIdentifier.id;
	
	const track = registry.getTrack( ProcessorUpdate.parent_track.id  );
	
	
	if(!track){
		console.warn("unknown track event");
		return;
	}
	
	let processor;
	let index;
	
	switch( ProcessorUpdate.action ){
		
		case ProcessorActionStub.PROCESSOR_DELETED : 
		
			deletedProcessors.set(processor_id, registry.getProcessor(processor_id) );
			track.removeProcessor(processor_id);
		break;
		
		case ProcessorActionStub.PROCESSOR_ADDED : 
			
			
			console.log("processor added")
			
			let cached = deletedProcessors.get(processor_id);
			
			let res = await commandInterface.AudioGraphController.getTrackProcessors(track);
			let updated_graph = res.processors;
			
			index = updated_graph.findIndex( proc => proc.id === processor_id )
			
		
			processor = updated_graph[index];
			
			processor = updated_graph[index];
			track.addProcessor(processor, index, cached);
			
			deletedProcessors = new Map();;
			
		break;
		
		default :
			throw new TypeError("Unknown ProcessorUpdate action");
	}
	
}) 