import { sushiStub, commandInterface, sushiClient } from '../sushi_client/client.js';
import { EventSubscription } from '../sushi_client/event_sub.js';
import { sushiStore } from '../stores/sushi.js'

export const transportMonitor = new EventSubscription( "subscribeToTransportChanges");
await transportMonitor.listen();

sushiClient.addEventListener("TransportUpdate", async (e)=>{ 
	const transportUpdate = e.detail.notification;
	
	switch (transportUpdate.Transport) {
	  case "tempo":
			sushiStore.tempo.set(transportUpdate.tempo);
		break;
	  case "playing_mode":
			sushiStore.playingMode.set(transportUpdate.playing_mode);
		break;
	  case "sync_mode":
			sushiStore.syncMode.set(transportUpdate.sync_mode);
		break;
	  case "time_signature":
			sushiStore.timeSignature.set(transportUpdate.time_signature);
		break;
	}
	
}) 


