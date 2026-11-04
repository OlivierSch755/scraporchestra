import { useEngineStore }  from "@/services/engine";
import { memo } from 'react';

export const  MidishWidget = memo( ()=> {
	
    const component = useEngineStore(
        (state) => state.engine?.project?.components?.midish
    );
	
    const config = useEngineStore(
        (state) => state.engine?.project?.config?.components?.midish
    );
	
	return (
		<div>Hello from Midish</div>
	);
});