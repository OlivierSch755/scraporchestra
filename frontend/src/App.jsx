
import { Toaster } from 'sonner';
import { useEngineSync, useEngineStore }  from "./services/engine.js";
import { ProjectView } from "./components/projectView.jsx";
import { ProjectList }  from "./components/projectList.jsx";


// keep in app.jsx
export default function App() {
	
	useEngineSync();

	const engine = useEngineStore((state) => state.engine);
	const isLoading = useEngineStore((state) => state.isLoading);
	const error = useEngineStore((state) => state.error);

	let main_view;

	if(isLoading) main_view = <div>Loading...</div> ;
	else if(error){
		main_view = <div>Error:<br/><p>{error}</p></div> ;
	}
	else if(engine?.project){
		main_view = <ProjectView/>;
	}
	else{
		main_view = <ProjectList/>
	}
	
	
	return (
		<>
		<main className="m-2">
			{main_view}
		</main>
		<Toaster />
		</>
	);
}

