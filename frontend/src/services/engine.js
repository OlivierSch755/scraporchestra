import {create} from 'zustand';
import {useEffect} from 'react';

function SushiNotificationHandler(component, notification){
	
	if (!component || !notification) {
		return component;
	}
	
	switch (notification.notif) {
		case 'component.sushi.editor':
			const next_component = {
				...component,
				editor_open : notification.data
			}
			return next_component;
	}
	
	return component;
}

function applyNotification(engine, notification) {

	if (!engine || !notification) {
		return engine;
	}

	// console.log(notification)

	switch (notification.notif) {
		
		case 'engine.snapshot':
			return notification.data;

		case 'project.state': {
			
			const project = engine.project;
			if(!project) return engine;
			
			return {
				...engine,
				project: {
					...engine.project,
					state: notification.data
				},
			};
			
		}
			
		case 'component.state': {
			
			const {name,state} = notification.data ?? {};
			const components = engine.project?.components;
		
			if (!components) {
				return engine;
			}
			
			let next_component
			if( !Object.hasOwn(components, name) ){
				next_component = {state}
			}
			else{
				next_component = {
					...components[name],
					state,
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
	
	return engine;
}

export const useEngineStore = create((set) => ({
	engine: null,
	isLoading: true,
	error: null,

	setSnapshot: (snapshot) =>
		set({
			engine: snapshot,
			isLoading: false,
			error: null,
		}),

	setLoading: (isLoading) => set({
		isLoading
	}),

	setError: (error) =>
		set({
			error,
			isLoading: false,
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
	
	const setSnapshot = useEngineStore(
		(state) => state.setSnapshot
	);

	const setLoading = useEngineStore(
		(state) => state.setLoading
	);

	const setError = useEngineStore(
		(state) => state.setError
	);

	const applyNotification = useEngineStore(
		(state) => state.applyNotification
	);

	useEffect(() => {
		
		const controller = new AbortController();

		let disposed = false;
		let initialized = false;

		// Preserve messages received while the initial HTTP
		// snapshot is being fetched (chances of multiple devices/users are low, but not zero...)
		const pendingNotifications = [];

		setLoading(true);

		const protocol =
			window.location.protocol === 'https:' ? 'wss:' : 'ws:';

		const socket = new WebSocket(
			`${protocol}//${window.location.host}/ws`
		);

		socket.addEventListener('open', () => {
			console.info('WebSocket connected');
		});

		socket.addEventListener('message', (event) => {
			let notification;
			try {
				notification = JSON.parse(event.data);
			} catch (error) {
				console.error('Invalid WebSocket message:', error);
				return;
			}

			if (!notification || typeof notification.notif !== 'string') {
				console.warn('Unexpected WebSocket message:', notification);
				return;
			}

			if (!initialized) {
				pendingNotifications.push(notification);
				return;
			}

			applyNotification(notification);
		});

		socket.addEventListener('error', (event) => {
			console.error('WebSocket error:', event);
		});

		socket.addEventListener('close', () => {
			console.info('WebSocket disconnected');
		});

		async function initialize() {
			try {
				const response = await fetch('/engine/api/snapshot', {
					signal: controller.signal,
				});

				if (!response.ok) {
					throw new Error(
						`Failed to fetch engine state: HTTP ${response.status}`
					);
				}

				const snapshot = await response.json();

				if (disposed) return;

				setSnapshot(snapshot);

				// Apply updates received while the HTTP request was pending.
				for (const notification of pendingNotifications) {
					applyNotification(notification);
				}

				pendingNotifications.length = 0;
				initialized = true;
			} catch (error) {
				if (error.name === 'AbortError' || disposed) {
					return;
				}

				setError(error.message);
			}
		}

		initialize();

		return () => {
			disposed = true;
			controller.abort();
			socket.close();
		};
	}, [setSnapshot, setLoading, setError, applyNotification]);

}