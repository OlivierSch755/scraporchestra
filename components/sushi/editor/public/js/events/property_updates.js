import { sushiStub, commandInterface, sushiClient } from '../sushi_client/client.js';
import { EventSubscription } from '../sushi_client/event_sub.js';
import {registry} from '../stores/sushi.js'

export const propertyMonitor = new EventSubscription( "subscribeToPropertyUpdates");
await propertyMonitor.listen(); // should watch graph and do this dynamically with register / forget

sushiClient.addEventListener("PropertyValue", async (e)=>{ 
	const propertyValue = e.detail.notification;
	const {property_id, processor_id} = propertyValue.property;
	const property = registry.getProperty(processor_id, property_id);
	property.state.set(propertyValue.value);
}) 


