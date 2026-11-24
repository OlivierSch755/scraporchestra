import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"

import { StateDisplayer } from './stateDisplayer.jsx';
import * as Project from '@/lib/project.js';
import { MidishWidget } from "./sc_components/midish.jsx";
import { SushiWidget } from "./sc_components/sushi.jsx";
import { MidiConnectionsWidget } from "./sc_components/midi-connections.jsx";
import { useEngineStore }  from "@/services/engine";

import { ProjectActionsModal }  from "./projectViewActions.jsx";



export function ProjectView(){

    const project = useEngineStore(
        (state) => state.engine?.project
    );
	
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
            id: 'sushi',
            name: 'DSP',
            config: project.config.components.sushi,
            component: project.components.sushi,
            Widget: SushiWidget,
        },
        {
            id: 'midish',
            name: 'MIDI transport',
            config: project.config.components.midish,
            component: project.components.midish,
            Widget: MidishWidget,
        },
        {
            id: 'midi_connections',
            name: 'MIDI routing',
            config: project.config.components.midi_connections,
            component: project.components.midi_connections,
            Widget: MidiConnectionsWidget,
        },
    ].filter(({ config }) => config);


	return (
		<section className="flex flex-col gap-2">
		
			<header>
			
				{/* Project title and state */}
				<h2 className="text-2xl">
					Project <span className="font-bold">{project.name}</span>
					<StateDisplayer state={project.state.state}/>
				</h2>
				
				{/* Project actions */}
				<ButtonGroup>
					<Button onClick={handleClose}>Close</Button>
					<Button onClick={handleSave}>Save</Button>
					<ProjectActionsModal project={project} />
				</ButtonGroup>
				
			</header>
			
			
			
			
			{/* Project components */}
			<section className="flex flex-col gap-2 border-y py-2">
			
				<header className="border-b pb-2" >
				
					{/* Nav and states */}
					<div className="min-w-12xs grid grid-cols-[repeat(4,minmax(5rem,var(--container-3xs)))] gap-2 items-center">
					
						{components.map(({ id, name, config, component }) => (
							<div key={id} className={`flex flex-col items-center gap-1 rounded`}>
								<Button  variant={(id === editingComponent)?"selected":"outline"} className="w-full whitespace-normal" onClick={() => setEditingComponent(id)}>
									{name}
								</Button>
								< StateDisplayer state={component?.state?.state} />
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
