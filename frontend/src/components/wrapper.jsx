import { StateDisplayer } from "./stateDisplayer";

export function ScComponentWrapper({name, config, component = {state:5}, Widget }){
	return (
		<article>
			<header>
				<h4>{name}</h4>
				< StateDisplayer state={component.state} />
			</header>
			
            < Widget config={config} component={component} />
		</article>
	);
	
}
