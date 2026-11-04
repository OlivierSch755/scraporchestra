import ResourceState from 'engine/states_json';
import { Badge } from "@/components/ui/badge"

export function StateDisplayer({state = ResourceState.CLOSED}){
	const search = Object.entries(ResourceState).find( ([key,value]) => value === state );
	if(!search) throw new Error(`Unknown state ${state}`);
	
	if(search === ResourceState.ERROR ){
		return (
			<Badge variant="destructive">{search[0]}</Badge>
		)
	}
	if(search === ResourceState.READY ){
		return (
			<Badge variant="outline" className="bg-green-50">{search[0]}</Badge>
		)
	}
	return (
		<Badge variant="outline">{search[0]}</Badge>
	)
}
