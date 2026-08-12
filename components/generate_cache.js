const {buildComponentsCache} = require("engine/component/utils");


; ( async ()=>{
	
	console.log("building component cache...")
	await buildComponentsCache();
	console.log("building component cache. OK.")
		
})();

