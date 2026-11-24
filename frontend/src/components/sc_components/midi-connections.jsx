import { memo, useState, useRef, useEffect, useMemo } from 'react';

import { useEngineStore }  from "@/services/engine";
import * as MidiCoHttp from '@/lib/midi_connections.js';

import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from  "@/components/ui/input";
import { 
	CircleCheck,
	CircleX,
	ArrowBigRight,
	Trash,
	SquareArrowRightEnter, 
	SquareArrowRightExit,
	ArrowRightLeft ,
	BellOff, 
	BellCheck, 
} from "lucide-react";

import {ScModal} from "@/components/ui/dialog"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"

const ClientTypes = ['System', 'Hardware' , 'Software'];


/*
This produces (hydrates) a copy of the audio graph with each port object mapped with one another based on their connection 
	So if client0:port0 is connected to client1:port1, then
		- client0:port0 representation has a reference to client1:port1 (ui_to)
		- client1:port1 representation has a reference to client0:port0 (ui_from)
*/

const autoCompleteGraph= (graph) => {
	
	if(!graph) return null;
	graph = JSON.parse(JSON.stringify(graph));
	
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
	const [optional, setOptional] = useState(false);
	
	useEffect( ()=>{
		/*
			Selector works both ways, but if port is bidirectionnal (duplex), user needs to specify a direction for the connection being created.
			I find it more natural to have default direction being "out". But this is a matter of personal preference
		*/ 
		setMode(clientPort?.port?.direction !== "IN" ? "OUT" : "IN" );
	}, [clientPort])
	
	useEffect( ()=>{
		setSender(null);
		setReceiver(null);
	}, [open,setOpen])
	
	if(!clientPort) return null;
	const {client,port} = clientPort;
	
	// Build a list of items that can be connected to/from this port
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
	
	// Ports that can receive data from current port
	const receive_nodes = nodes.filter(node =>
		node.port.direction !== "OUT" 			 				// Exclude ports that are OUTPUT-only
		&& !node.selected 									 	// Exclude current port (avoid port connecting to itself)
		&& !node.port.ui_connections.ui_from.includes(port) 	// Exclude ports that are already receiving from current port
	);
	
	// Ports that can send data to current port
	const send_nodes = nodes.filter(node=>
		node.port.direction !== "IN" 							// Exclude ports that are INPUT-only
		&& !node.selected 										// Exclude current port (avoid port connecting to itself)
		&& !node.port.ui_connections.ui_to.includes(port) 		// Exclude ports that are already sending to current port
	);
	
	const getPortIdentifier=(port)=>{
		return `${port.client_id}:${port.id}`;
	};
	
	const getClientPortName=(item)=>`${item.client.name} : ${item.port.name}`;
	
	// Connection creation API
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
		
		if(!send || !receive){
			throw new Error("A MIDI connection requires a sender and a receiver")
		}
		
		const send_id = getPortIdentifier(send.port);
		const rec_id = getPortIdentifier(receive.port);
		const promise = MidiCoHttp.connect(send_id, rec_id, optional ).then(x=>setOpen(false));
		
		toast.promise(promise, {
			loading:  `Connecting MIDI ports`,
			success:  `MIDI connection established`,
			error: (err) => ({
				message: `Could not connect ${send.port.name} to ${receive.port.name}`,
				description: err.message,
			}),
		})
	}

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
						>Receive</Button>
						<Button
							className="w-1/2"
							variant={mode === "OUT" ? "selected" : "outline"}
							disabled={port.direction === "IN"}
							onClick={() => setMode("OUT")}
						>Send</Button>
					</ButtonGroup>
				
					{mode === "IN" &&
						<Combobox 
							items={send_nodes}
							itemToStringLabel={getClientPortName}     
							value={sender}
							onValueChange={setSender}
						>
							<ComboboxInput aria-label="source port" placeholder="Receive from..." />
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
							itemToStringLabel={getClientPortName}
							value={receiver}
							onValueChange={setReceiver}
						>
							<ComboboxInput aria-label="destination port" placeholder="Send to..." />
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
					
					  <Field orientation="horizontal">
						<Checkbox
						  id="midico_opt_con"
						  checked={optional} onCheckedChange={setOptional}
						/>
						<FieldContent>
						  <FieldLabel htmlFor="midico_opt_con">
							Optional
						  </FieldLabel>
						  <FieldDescription>
							Do not warn if this connection is missing.
						  </FieldDescription>
						</FieldContent>
					  </Field>	
					  
					<Button disabled={!sender && !receiver} onClick={onConnect}>Connect</Button>
					
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
		
			min-w-xs
			relative
			border rounded
			grid
			grid-cols-[minmax(0,1fr)_auto]
			gap-2 
			items-center
			justify-items-around
			w-full
			p-2 
		">
	
			<div className="col-start-1 row-span-2 flex gap-2 items-center">
			
				<div className="min-w-0 text-end">
					<div className="break-words">{rule.sender_client_name}</div>
					<i className="break-words">{rule.sender_port_name}</i>
				</div>

				<ArrowBigRight className="size-6 "/>
				
				<div className="min-w-0">
					<div className="break-words">{rule.receiver_client_name}</div>
					<i className="break-words">{rule.receiver_port_name}</i>
				</div>
			</div>
			
			<div className="gap-1 flex col-start-2 justify-self-end border-b border-l pr-2 pl-1 -mt-2 -mr-2 rounded-bl py-1 bg-secondary">
				{rule.optional ? <BellOff className="size-5 text-muted"/> : <BellCheck className="size-5"/>}
				{rule.passed ? <CircleCheck className="size-5 text-success-foreground" /> : <CircleX className="text-destructive size-5 "/>}
			</div>
			
			<Button onClick={onDeleteRule}  className="col-start-2 justify-self-end" variant="destructive"><Trash /></Button>
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
	  content-start
	  gap-2 
	  w-full
      p-2 
    ">

		<div className="flex gap-2 justify-between">
			<i>{client.name}</i> 
			<Badge variant="outline" className="bg-secondary">{ClientTypes[client.type]}</Badge>
		</div>
		
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
			<strong>Connections</strong>
			<div className="
				grid gap-2 
				md:grid-cols-2
				lg:grid-cols-3
				xl:grid-cols-4
				items-start 
			">
				{component.rules && component.rules.rules.map( rule => <Rule key={rule.id} rule={rule}/> )  }
			</div>
			
			
			<strong>Clients</strong>
			<div className="
				text-sm
				grid gap-2 
				md:grid-cols-2
				lg:grid-cols-3
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