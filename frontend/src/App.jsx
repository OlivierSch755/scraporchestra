
import { Toaster } from 'sonner';
import { useEngineSync, useEngineStore }  from "./services/engine.js";
import { ProjectView } from "./components/projectView.jsx";
import { ProjectList }  from "./components/projectList.jsx";


// keep in app.jsx
export default function App() {
	
	useEngineSync();

	const engine = useEngineStore((state) => state.engine);
	const initialized = useEngineStore((state) => state.initialized);
	const socketState = useEngineStore((state) => state.socketState);
	
	let main_view;

	const statusColors = {
		disconnected: "bg-red-500",
		connected: "bg-green-500",
		reconnecting: "bg-orange-500",
		connecting: "bg-orange-500",
	};


console.log(socketState)

	const socketStateDisplayer = (
		<div className="flex items-center gap-4 fixed right-0">
			{socketState !== "connected" && <small className="capitalize">{socketState}</small>}
			{socketState === "connected" && <span className="sr-only">{socketState}</span>}
			<div
				className={`w-4 h-4 rounded-full ${
					statusColors[socketState] ?? "bg-gray-400"
				}`}
				aria-hidden="true"
			/>

		</div>
	);
		

	if(!initialized && !engine) main_view = <div>Loading...</div> ;

	else if(engine?.project){
		main_view = <ProjectView/>;
	}
	else{
		main_view = <ProjectList/>
	}
	
	
	return (
		<>
		{socketStateDisplayer}
		<main className="m-2">
			{main_view}
		</main>
		<Toaster />
		</>
	);
}

