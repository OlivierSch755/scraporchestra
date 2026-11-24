import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { useEngineStore }  from "@/services/engine";
import { toast } from 'sonner';
import * as MidiCoHttp from '@/lib/midi_connections.js';


import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from  "@/components/ui/input";
import { CircleCheck, CircleX , ArrowBigRight, Trash , SquareArrowRightEnter, SquareArrowRightExit, ArrowRightLeft } from "lucide-react";

const ClientTypes = ['System', 'Hardware' , 'Software'];

import {
  ScModal
} from "@/components/ui/dialog"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"



const autoCompleteGraph= (graph) => {
	
	if(!graph) return null;
	graph = JSON.parse(JSON.stringify(graph))
	
	graph.ports = [];

	for(let client of Object.values(graph.clients) ){
		client.ports.forEach( port => {
			port.ui_connections = {
				ui_from : [], 
				ui_to : []
			}
			graph.ports.push(port);
		});  
	}

	graph.ports.forEach( port => {
		port.connections.forEach( connection =>{
			let receiver = graph.clients[ connection.receiver_client_id ]?.ports?.find( p => p.id === connection.receiver_port_id )
			if(!receiver) return;
			receiver.ui_connections.ui_from.push(port) 
			port.ui_connections.ui_to.push(receiver);
		});
	});

	return graph;
}


export function PortConnectionDialog({className, clientPort, graph, open, setOpen}){
	
	const [mode,setMode] = useState( "IN" );
	const [sender,setSender] = useState( null );
	const [receiver,setReceiver] = useState( null );
	
	useEffect( ()=>{
		setMode(clientPort?.port?.direction !== "IN" ? "OUT" : "IN" );
	}, [clientPort])
	
	useEffect( ()=>{
		setSender(null);
		setReceiver(null);
	}, [open,setOpen])
	
	if(!clientPort) return null;
	const {client,port} = clientPort;
	
	const nodes = Object.values(graph.clients).map( (client)=>{
		return client.ports.flat().map(port=>{
			
			const item = {
				port,
				client,
				selected : port === clientPort.port
			}
			
			return item;
		})
	})
	.filter(x=>true)
	.flat()
	.map( (x,id)=>{x.id = id; return x})
   
   
	const receive_nodes = nodes.filter(node=>node.port.direction !== "OUT" && !node.selected && !node.port.ui_connections.ui_from.includes(port)  );
	const send_nodes = nodes.filter(node=>node.port.direction !== "IN" && !node.selected && !node.port.ui_connections.ui_to.includes(port) );
	
	const getPortIdentifier=(port)=>{
		return `${port.client_id}:${port.id}`;
	};
	
	
	const onConnect = ()=>{
	
		let send,receive;
		
		if(mode === "OUT"){
			send = clientPort;
			receive = receiver;
		}
		else if(mode==="IN"){
			send = sender;
			receive = clientPort;
		}
		
	
		const send_id = getPortIdentifier(send.port);
		const rec_id = getPortIdentifier(receive.port);
		
		const promise = MidiCoHttp.connect(send_id, rec_id ).then(x=>setOpen(false));
		toast.promise(promise, {
			loading:  `Connecting MIDI ports`,
			success:  `MIDI connection established`,
			error: (err) => ({
				message: `Could not connect ${send.port.name} to ${receive.port.name}`,
				description: err.message,
			}),
		})
	}

	const itemToStringLabel=(item)=>`${item.client.name} : ${item.port.name}`;
	
	return (
			<ScModal 
				open={open}
				setOpen={setOpen}
				header=<>Connecting client <i>{client.name}</i></>
				description=<>Port <i>{port.name}</i> <small>( {port.direction} )</small></>
			>
				<div className="grid gap-2 items-center">
				
				<ButtonGroup className="w-full">
					<Button
						className="w-1/2"
						variant={mode === "IN" ? "selected" : "outline"}
						disabled={port.direction === "OUT"}
						onClick={() => setMode("IN")}
					>
						Receive
					</Button>

					<Button
						className="w-1/2"
						variant={mode === "OUT" ? "selected" : "outline"}
						disabled={port.direction === "IN"}
						onClick={() => setMode("OUT")}
					>
						Send
					</Button>
				</ButtonGroup>
				

					{mode === "IN" &&
						<Combobox 
							items={send_nodes}
							itemToStringLabel={itemToStringLabel}     
							value={sender}
							onValueChange={setSender}
						>
							<ComboboxInput placeholder="Receive from..." />
							<ComboboxContent>
								<ComboboxList>
									{(item) => (
										<ComboboxItem key={item.id} value={item}>
											{`${item.client.name} : ${item.port.name}`}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					}
					
					{mode === "OUT" &&
						<Combobox 
							items={receive_nodes}
							itemToStringLabel={itemToStringLabel}
							value={receiver}
							onValueChange={setReceiver}
						>
							<ComboboxInput placeholder="Send to..." />
							<ComboboxContent>
								<ComboboxList>
									{(item) => (
										<ComboboxItem key={item.id} value={item}>
											{`${item.client.name} : ${item.port.name}`}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					}
				
					<Button onClick={onConnect}>Connect</Button>
					
				</div>
			</ScModal>	
	);
}

function Rule({ rule }) {


	const onDeleteRule = ()=>{
		const promise = MidiCoHttp.deleteRule(rule.id);
		toast.promise(promise, {
			loading:  `Deleting persistent MIDI connection...`,
			success:  `Deleted persistent MIDI connection`,
			error: (err) => ({
				message: `Could not delete persistent MIDI connection`,
				description: err.message,
			}),
		})
	}

	
	return (
		<div className="
			border rounded
			grid grid-cols-7 
			gap-2 items-center
			justify-items-center
			w-full
			p-2 
			max-w
		">

			{rule.passed ? <CircleCheck className="text-success" /> : <CircleX className="text-destructive"/>}

			<div className="col-span-2 min-w-0 w-full text-end">
				<div>{rule.sender_client_name}</div>
				<i>{rule.sender_port_name}</i>
			</div>

			<ArrowBigRight/>

			<div className="col-span-2 min-w-0 w-full">
				<div>{rule.receiver_client_name}</div>
				<i>{rule.receiver_port_name}</i>
			</div>

			<Button onClick={onDeleteRule}className="justify-self-end w-fit shrink-0" variant="destructive"><Trash /></Button>
    </div>
  );
}


function Port({ port, client, onPortSelect }){
	
	
	return(<li className="flex gap-2 border rounded p-1 items-center h-fit">
		
		<Button onClick={ ()=>onPortSelect(port, client) }>
			{port.direction === "DUPLEX" && 
				<ArrowRightLeft />
			}
		
			{port.direction === "IN" && 
				<SquareArrowRightEnter/>
			}
		
			{port.direction === "OUT" && 
				<SquareArrowRightExit />
			}
		</Button>
		{port.name}
		
	</li>)
	
}




function Client({ client,  onPortSelect }) {
  return (
    <div className="
      border rounded
      grid 
	  grid-cols-[1fr_3fr]
	  content-start
	  gap-2 
	  w-full
      p-2 
	  max-w
    ">
		<div className="justify-self-start">
			Client:
		</div>
		<div> {client.name}
		</div>
		
		<div className="justify-self-start">Ports:</div>
		<ul className="grid gap-1">
			{client.ports.map( port => <Port key={port.id} port={port} client={client} onPortSelect={onPortSelect} /> )}
		</ul>
	
	
	
    </div>
  );
}



export const  MidiConnectionsWidget = memo( ()=> {
	
    const component = useEngineStore(
        (state) => state.engine?.project?.components?.midi_connections
    );
	
    const config = useEngineStore(
        (state) => state.engine?.project?.config?.components?.midi_connections
    );
	
	

	const [selectedPort, setSelectedPort] = useState(null);
	const [open, setOpen] = useState(false);
	
	const editPort = (port, client)=>{
		setOpen(true);
		setSelectedPort({port, client})
	}

	const graph = useMemo(
		() => autoCompleteGraph(component?.graph?.graph),
		[component?.graph]
	);
	
	if(!component) return null;
	
	return (
		<>
		<div className="grid gap-2 text-sm">
			<strong>Rules</strong>
			<div className="
				grid gap-2 
				md:grid-cols-2
				xl:grid-cols-3
				items-start 
			">
				{component.rules && component.rules.rules.map( rule => <Rule key={rule.id} rule={rule}/> )  }
			</div>
			
			
			<strong>Graph</strong>
			<div className="
				text-sm
				grid gap-2 
				md:grid-cols-2
				lg:grid-cols-2
				xl:grid-cols-4
				justify-items-start
				
			">
				{graph && Object.entries(graph.clients).map( ([id,client]) => <Client key={id} client={client}  onPortSelect={editPort}/> )  }
			</div>
		</div>
		< PortConnectionDialog clientPort={selectedPort} open={open} setOpen={setOpen} graph={graph} />
		</>
	);
});