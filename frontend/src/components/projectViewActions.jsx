import * as projectHttp from '@/lib/project.js';

import { useRef, useState, useEffect, memo } from "react";
import { useEngineStore }  from "@/services/engine";
import { toast } from 'sonner';

import {
  ScModal
} from "@/components/ui/dialog"

import {Input} from  "@/components/ui/input"
import {Button} from  "@/components/ui/button"
import {ButtonGroup} from "@/components/ui/button-group"

export function ProjectActionsModal({className, project}){
	
	const [open, setOpen] = useState(false);
	
	const installComponent = (component_name)=>{
		const promise = projectHttp.installComponent(component_name);
		toast.promise(promise, {
			loading:  `Installing component ${component_name}...`,
			success:  `Component ${component_name} installed`,
			error: (err) => ({
				message: `Could not install component ${component_name}`,
				description: err.message,
			}),
		});
	}
	const removeComponent = (component_name)=>{
		const promise = projectHttp.unInstallComponent(component_name);
		toast.promise(promise, {
			loading:  `Removing component ${component_name}...`,
			success:  `Component ${component_name} removed `,
			error: (err) => ({
				message: `Could not remove component ${component_name}`,
				description: err.message,
			}),
		});
	}

	const installed_components = project.config.components;
	
	return (
		<>
			<Button className={className} onClick={ e => setOpen(true) }>
				More
			</Button>
					
			<ScModal 
				open={open}
				setOpen={setOpen}
				header="Project actions"
			>
			
				<div className="grid gap-2 items-center">
					<h3 className="border-b">Manage components</h3>
						
					<div className="grid grid-cols-[2fr_1fr] gap-2 items-center">
						<div><strong>DSP</strong> <i>Sushi</i></div>
						
						{!installed_components.sushi 
							&& 
							<Button onClick={ e=>{installComponent("sushi")} }>Install</Button>
							|| 
							<Button variant="destructive" onClick={ e=>{removeComponent("sushi")} }>Remove</Button>
						}
						
						<div><strong>MIDI transport</strong> <i>Midish</i></div>
						{!installed_components.midish 
							&& 
							<Button onClick={ e=>{installComponent("midish")} }>Install</Button>
							|| 
							<Button variant="destructive" onClick={ e=>{removeComponent("midish")} }>Remove</Button>
						}
						
						<div><strong>MIDI Connections manager</strong></div>
						{!installed_components.midi_connections 
							&& 
							<Button onClick={ e=>{installComponent("midi_connections")} }>Install</Button>
							|| 
							<Button variant="destructive" onClick={ e=>{removeComponent("midi_connections")} }>Remove</Button>
						}
						
						<div><strong>Pure Data</strong></div>
						{!installed_components.pure_data 
							&& 
							<Button onClick={ e=>{installComponent("pure_data")} }>Install</Button>
							|| 
							<Button variant="destructive" onClick={ e=>{removeComponent("pure_data")} }>Remove</Button>
						}
					</div>
				</div>
			</ScModal>	
					
		</>
	);
}
