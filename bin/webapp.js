#!/usr/bin/env node

console.time("load dependencies");
const path = require ("node:path");
const fs = require ("node:fs");
const {startWebAppServer} = require ("web");
const Application = require ("engine/application");
console.timeEnd("load dependencies");

const options = {
	projects_dir : path.join("/", "udata", "scraporchestra", "projects")
}
fs.mkdirSync(options.projects_dir, { recursive: true });

console.time("App Start");
new Application(options).init().then( async ( application )=>{
	console.time("Webapp Start");
	await startWebAppServer( application );
	console.timeEnd("Webapp Start");
	console.timeEnd("App Start");
});


