import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"


import { StateDisplayer } from './stateDisplayer.jsx';
import * as Project from '../services/project.js';
import { MidishWidget } from "./sc_components/midish.jsx";
import { SushiWidget } from "./sc_components/sushi.jsx";


export function ProjectView({project}){

	const [editingComponent, setEditingComponent] = useState(null);


	function handleClose() {
		const promise = Project.close();
		toast.promise(promise, {
			loading: `Closing project ${project.name}...`,
			success: `Project ${project.name} closed`,
			error: (err) => ({
				message: 'Could not close project',
				description: err.message,
			}),
		});
	}
	
	function handleSave() {
		const promise = Project.save();
		toast.promise(promise, {
			loading: `Saving project ${project.name}...`,
			success: `Project ${project.name} saved`,
			error: (err) => ({
				message: `Could not save project ${project.name}`,
				description: err.message,
			}),
		});
	}
	
    // Component definitions
    const components = [
        {
            id: 'midish',
            name: 'Midish',
            config: project.config.components.midish,
            component: project.components.midish,
            Widget: MidishWidget,
        },
        {
            id: 'sushi',
            name: 'Sushi',
            config: project.config.components.sushi,
            component: project.components.sushi,
            Widget: SushiWidget,
        },
    ].filter(({ config }) => config);


	return (
		<section className="flex flex-col gap-6">
		
			<header>
			
				{/* Project title and state */}
				<h2 className="text-2xl">
					Project <span className="font-bold">{project.name}</span>
					<StateDisplayer state={project.state}/>
				</h2>
				
				{/* Project actions */}
				<ButtonGroup>
					<Button onClick={handleClose}>Close project</Button>
					<Button onClick={handleSave}>Save project</Button>
				</ButtonGroup>
				
			</header>
			
			
			{/* Project components */}
			<section className="flex flex-col gap-2 border p-2">
			
				<header className="border-b pb-2" >
				
					<h3 className="text-1xl font-bold">Components</h3>
					
					{/* Nav and states */}
					<div className="flex gap-2">
						{components.map(({ id, name, config, component }) => (
							<div
								key={id}
								className="flex items-center justify-between border rounded-lg p-2 gap-3"
							>
								<div>
									<h4 className="font-semibold">{name}</h4>
									< StateDisplayer state={component?.state} />
								</div>

								<Button onClick={() => setEditingComponent(id)}>
									Edit
								</Button>
								
							</div>
						))}
					</div>
				
				</header>
			
				{/* Components widgets */}
				{components.map(({ id, name, config, component, Widget }) => (	
					<div
						key={id}
						className={editingComponent === id ? 'block' : 'hidden'}
					>
						<h4 className="text-1xl font-bold border-b mb-2">Editing <span className="italic">{name}</span></h4>
						<Widget/>
					</div>
						
				))}
				
			</section>
			

		</section>
	);
	
}
