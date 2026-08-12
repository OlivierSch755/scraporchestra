import { sushiStub, commandInterface, sushiClient } from '../sushi_client/client.js';
import { EventSubscription } from '../sushi_client/event_sub.js';
import {sushiStore} from '../stores/sushi.js'

export const trackMonitor = new EventSubscription( "subscribeToTrackChanges" );
await trackMonitor.listen(); // should watch graph and do this dynamically with register / forget

const TrackActionStub = sushiStub.lookupType("TrackUpdate").Action;

sushiClient.addEventListener("TrackUpdate", async (e)=>{ 

	const trackUpdate = e.detail.notification;
	
	const track_id =  trackUpdate.track.id;
	let track;
	
	switch( trackUpdate.action ){
		case TrackActionStub.TRACK_DELETED : 
			console.log("track deleted")
			sushiStore.removeTrack(track_id);
		break;
		
		case TrackActionStub.TRACK_ADDED : 
			console.log("track added")
			let res = await commandInterface.AudioGraphController.getTrackInfo( trackUpdate.track );
			track = res.info;
			sushiStore.addTrack(track);
		break;
		
		default :
			throw new TypeError("Unknown TrackUpdate action");
	}
	
}) 


