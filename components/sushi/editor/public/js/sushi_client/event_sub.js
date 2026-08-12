import { commandInterface, unsubscribeRpc } from './client.js';


/*
	Subscriptions to notifications streams

*/
	
export class EventSubscription{
	
	constructor( method_name ){
		this.set = new Set();
		this.listening = false;
		
		this.subscriptionMethod = x=> commandInterface.NotificationController[method_name](x)
		this.unsubscriptionMethod = x=> unsubscribeRpc[method_name](x);
		
	}
	
	forget(item){
		this.set.delete(item);
		if(this.set.size === 0){
			this.stop_listening();
		}
	}
	
	register(item){
		this.set.add(item);
		if(this.set.size > 0){
			this.listen();
		}
	}
	
	async listen(){
		if(this.listening) return;
		this.listening = true;
		await this.subscriptionMethod({}).catch(err =>{
			this.listening = false;
			throw err;
		})
	}
	
	async stop_listening(){
		if(!this.listening) return;
		this.listening = false;
		await this.unsubscriptionMethod({}).catch(err =>{
			this.listening = true;
			throw err;
		})
	}
	
}
	
