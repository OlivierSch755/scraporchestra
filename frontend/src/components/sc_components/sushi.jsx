
import { useState, useEffect, useRef } from "react";
import { toast } from 'sonner';
import ResourceState from 'engine/states_json';

import { useEngineStore }  from "@/services/engine";

import { StateDisplayer } from '@/components/stateDisplayer';
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { SushiConfigurator } from "@/components/sc_components/sushiConfigurator"



async function startSushiEditor() {
	const response = await fetch( '/components/sushi/api/editor/start', { method:'POST'} );		
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not open Sushi editor'
		);
	}
};

async function stopSushiEditor() {
	const response = await fetch( '/components/sushi/api/editor/stop', { method:'POST'} );		
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not stop Sushi editor'
		);
	}
};

function SushiWebEditor({component}){
	
	
	if(!component) return null;
	
	function onStart(e) {
		const promise = startSushiEditor();
		toast.promise(promise, {
			loading: `Starting Sushi editor...`,
			success: `Sushi editor started.`,
			error: (err) => ({
				message: `Could not start Sushi editor`,
				description: err.message,
			}),
		});
	}
	
	function onStop(e) {
		const promise = stopSushiEditor();
		toast.promise(promise, {
			loading: `Stopping Sushi editor...`,
			success: `Sushi editor stopped.`,
			error: (err) => ({
				message: `Could not stop Sushi editor`,
				description: err.message,
			}),
		});
	}

	const iframeRef = useRef(null);

	async function openFullscreen() {
		try {
			await iframeRef.current.requestFullscreen();
		} 
		catch (err) {
			console.error("Fullscreen failed:", err);
		}
	}

	const iframeSrc = `${window.location.protocol}//${window.location.hostname}:${8081}`;

	return (	

		<section className="border">	
		
			<header className="flex justify-between p-2 items-center">
			
				{ component.editor_open ? "Editor is online " : "Editor is offline " }
				
				<ButtonGroup>
				
					{ component.editor_open &&  <Button className="pointer-fine:hidden" onClick={openFullscreen}> Go fullscreen</Button> }
					
					<Button onClick={ component.editor_open ? onStop : onStart } >
						{ component.editor_open ? "Disable" : "Enable" }
					</Button>
				</ButtonGroup>
				
			</header>
			
			{ component.editor_open &&  
				<div className="w-full min-h-[400px] h-[50dvh] resize-y overflow-auto [@media(pointer:coarse)]:h-0 @media(pointer:coarse)]:w-0" >
					<iframe 
						ref={iframeRef}
						src={iframeSrc}
						className="w-full h-full border-0"
					/>
				</div>
			}
		</section>	
		
	);
}

export function SushiWidget() {
	
    const component = useEngineStore(
        (state) => state.engine?.project?.components?.sushi
    );
	
    const config = useEngineStore(
        (state) => state.engine?.project?.config?.components?.sushi
    );
	
	return (
		<div className="flex flex-col gap-2">
			<SushiConfigurator config={config} />
			<SushiWebEditor component={component} />
		</div>
	)
}