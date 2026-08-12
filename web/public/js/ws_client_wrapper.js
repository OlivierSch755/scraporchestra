/*

should write a small protocol to negociate subs on a running socket
instead of recreating it kafka style

*/

class WsClientWrapper extends EventTarget{
	
	subscriptions = new Set();
	
	active_ws = null;
	next_task = null;
	busy = false;
	
	addEventListener(name){
		super.addEventListener(...arguments);
		const size_before = this.subscriptions.size;
		this.subscriptions.add(name);
		if( this.subscriptions.size !== size_before ){
			this.reconnect();
		}
	}
	
	reconnect(){
		const wsUrl = new URL(window.location);
		for(let sub of this.subscriptions){
			wsUrl.searchParams.append(sub, 1);
		}
		this.next_task = wsUrl;
		this.wake_up();
	}
	
	wake_up(){
		if( this.busy || !this.next_task ) return;
		this.busy = true;
		
		const url = this.next_task;
		this.next_task = null;
		
		
		new Promise( ( resolve, reject ) => {
			const wsClient = new WebSocket( url );
			
			let resolved = false;
			
			function open_cb(){
				if(resolved) return;
				resolved = true;
				cleanUp();
				resolve(wsClient);
			}
			
			function error_cb(err){
				if(resolved) return;
				resolved = true;
				cleanUp();
				reject(err);
			}
			
			function cleanUp(){
				wsClient.removeEventListener("open", open_cb, {once:true})
				wsClient.removeEventListener("error", error_cb, {once:true})
			}
			
			wsClient.addEventListener("open", open_cb ,{once:true})
			wsClient.addEventListener("error", error_cb ,{once:true})
			
		} )
		.catch(err => { console.warn("ws client error", err, url) } )
		.then( (wsClient)=>{
			const obsolete_ws = this.active_ws;
			this.active_ws = wsClient;
			this.handleWsMessages(wsClient);
			obsolete_ws?.close();
			this.busy = false;
			if( ! this.next_task ) return;
			this.wake_up();
		})
	}
	
	handleWsMessages(wsClient){
		wsClient.addEventListener("message", (message) =>{ 
			const parsed = JSON.parse(message.data);
			console.log(parsed)
			this.dispatchEvent( new CustomEvent (parsed.notif, {detail : parsed.data} ) )
			if( window._debug_ws_client ) console.log(parsed)
		})
	}
}

export const wsClient = new WsClientWrapper();
