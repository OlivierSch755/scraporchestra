import {create} from 'zustand';
import {useEffect} from 'react';

function SushiNotificationHandler(component, notification){
	
	if (!component || !notification) {
		return component;
	}
	
	switch (notification.notif) {
		
		case 'component.sushi.editor': {
			
			// if(notification.data.rev <= component.editor.rev){
				// return component
			// }
			const next_component = {
				...component,
				editor : notification.data
			}
			return next_component;
		}
	}
	
	return component;
}

function MidishNotificationHandler(component, notification){
	
	if (!component || !notification) {
		return component;
	}
	switch (notification.notif) {
		
		case 'component.midish.transport':{
		
			if(component.transport?.rev && notification.data.rev <= component.transport.rev ) return;
		
			const next_component = {
				...component,
				transport : notification.data
			}
			return next_component;
		}	
		
		case 'component.midish.position':{
		
			if(component.transport?.position?.rev && notification.data.rev <= component.transport.position.rev ) return;
		
			const next_component = {
				...component,
				transport : {
					...component.transport,
					position : notification.data
				}
			}
			return next_component;
		}		
		
		case 'component.midish.session':{
		
			if(component.session?.rev  && notification.data.rev <= component.session.rev ) return;
		
			const next_component = {
				...component,
				session : notification.data
			}
			return next_component;
		}
	}
	
	return component;
}

function applyNotification(engine, notification) {

	if (!notification || !engine) {
		return engine;
	}

	switch (notification.notif) {
		
		case 'engine.snapshot':
			return notification.data;

		case 'project.state': {
			
			const project = engine.project;
			if(!project || notification.data.rev <= project.state.rev ) return engine;
			
			return {
				...engine,
				project: {
					...engine.project,
					state: notification.data
				},
			};
			
		}
			
		case 'component.state': {
			
			const state_update = notification.data ?? {};
			const {name} = state_update;
			const components = engine.project?.components;
		
			if (!components) {
				return engine;
			}
			
			let next_component
			
			if( !Object.hasOwn(components, name) ){
				next_component = {state : state_update}
				console.warn("pre-init component", name, state_update)
			}
			else if(notification.data.rev <= components[name].rev ){
				console.warn("skipped notification", notification, components[name] )
				return engine;
			}
			else{
				next_component = {
					...components[name],
					state : state_update,
				}
			}
			
			return {
				...engine,
				project: {
					...engine.project,
					components: {
						...components,
						[name]: next_component ,
					},
				},
			};
		}
	}
	
	if(notification.notif.startsWith("component.sushi")){
		
		const components = engine.project?.components;
		let sushi = components?.sushi;
		if(!sushi) return engine;
		const next_sushi = SushiNotificationHandler( sushi ,notification);
		if(!next_sushi) return engine;
		return {
			...engine,
			project: {
				...engine.project,
				components: {
					...engine.project.components,
					sushi : next_sushi,
				},
			},
		};
	}
	
	if(notification.notif.startsWith("component.midish")){
		
		const components = engine.project?.components;
		let midish = components?.midish;
		if(!midish) return engine;
		const next_midish = MidishNotificationHandler( midish ,notification);
		if(!next_midish) return engine;
		return {
			...engine,
			project: {
				...engine.project,
				components: {
					...engine.project.components,
					midish : next_midish,
				},
			},
		};
	}
	
	return engine;
}

export const useEngineStore = create((set) => ({
	
	engine: null,
	initialized: false,
	socketState : "disconnected",

	setSocketState: (socketState) => set((state) => ({
		socketState,
		initialized: socketState === "connected"
			? state.initialized
			: false
	})),
	
    setSnapshot: (engine) => set({
        engine,
        initialized: true
    }),


	applyNotification: (notification) =>
		set((current) => {
			const nextEngine = applyNotification(
				current.engine,
				notification
			);

			// Avoid unnecessary updates for ignored notifications.
			if (nextEngine === current.engine) {
				return current;
			}

			return {
				engine: nextEngine
			};
		}),

}));

export function useEngineSync() {
	
	const setSocketState = useEngineStore(
		(state) => state.setSocketState
	);

	const setSnapshot = useEngineStore(
		(state) => state.setSnapshot
	);
	
	const applyNotification = useEngineStore(
		(state) => state.applyNotification
	);


	useEffect(() => {
		
	
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const ws_url = `${protocol}//${window.location.host}/ws`;
			
		const onMessage = (event) => {
			
			let message;
			try {
				message = JSON.parse(event.data);
			} catch (error) {
				console.error('Invalid WebSocket message:', error, event.data);
				return;
			}
			if (!message || typeof message.notif !== 'string') {
				console.warn('Unexpected WebSocket message:', event.data );
				return;
			}
			
			if (message.notif === "engine.snapshot") {
				setSnapshot(message.data);
				return;
			}
			
			const initialized = useEngineStore.getState().initialized;

			if (!initialized) {
				console.warn("Ignoring notification before snapshot:", message);
				return;
			}
			
			applyNotification(message);
		}
			
		const onWsStateChange = (state)=>{
			setSocketState(state)
		}
			
		const socket = new ReconnectionManager(ws_url, {onMessage, onStateChange : onWsStateChange} );

		return () => {
			socket?.dispose();
		};
	}, [setSocketState, applyNotification, setSnapshot]);

}

function createBackoff({ base = 500, max = 30000, jitter = true } = {}) {
	let attempt = 0;

	return {
		next() {
			const exponential = Math.min(base * Math.pow(2, attempt), max);
			const delay = jitter
				? exponential * (0.5 + Math.random() * 0.5)
				: exponential;
			attempt++;
			return Math.floor(delay);
		},
		reset() {
			attempt = 0;
		},
	};
}

class ReconnectionManager {
	
	constructor(url, {onMessage,onStateChange}) {
		this.url = url;
		this.onMessage = onMessage;
		this.onStateChange = onStateChange;
		this.backoff = createBackoff();
		this.maxRetries = 12;
		this.retryCount = 0;
		this.connect();
	}
	connect() {
		if (this.disposed) return;
		this.ws = new WebSocket(this.url);
		this.onStateChange?.("connecting");

		this.ws.onerror = (event) => {
			console.error("WebSocket error:", event);
		};

		this.ws.onopen = () => {
			this.backoff.reset();
			this.retryCount = 0;
			this.onStateChange?.("connected");
		};

		this.ws.onmessage = (event) => {
			this.onMessage?.(event);
		};

		this.ws.onclose = (event) => {
			if (event.code === 1000) {
				this.onStateChange?.("disconnected");
				return;
			}
			this.scheduleReconnect();
		};
	}
	scheduleReconnect() {
		if (this.disposed) return;
		if (this.retryCount >= this.maxRetries) {
			this.onStateChange?.("disconnected");
			return;
		}
		this.retryCount++;
		this.onStateChange?.("reconnecting");
		this.reconnectTimer = setTimeout(() => this.connect(), this.backoff.next());
	}
	
	dispose() {
		this.disposed = true;
		clearTimeout(this.reconnectTimer);
		this.ws?.close(1000, "Component disposed");
	}
	
}
