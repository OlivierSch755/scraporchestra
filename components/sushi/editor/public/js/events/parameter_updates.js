import { sushiStub, commandInterface, sushiClient } from '../sushi_client/client.js';
import { EventSubscription } from '../sushi_client/event_sub.js';
import {registry} from '../stores/sushi.js'

export const parameterMonitor = new EventSubscription( "subscribeToParameterUpdates");
await parameterMonitor.listen(); // should watch graph and do this dynamically with register / forget

sushiClient.addEventListener("ParameterUpdate", async (e)=>{ 
	const parameterUpdate = e.detail.notification;
	const {processor_id, parameter_id} = parameterUpdate.parameter;
	const parameter = registry.getParameter(processor_id, parameter_id);
	parameter.state.set(parameterUpdate);
}) 


