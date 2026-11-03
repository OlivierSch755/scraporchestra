#!/usr/bin/env node

console.time("load dependencies");
const path = require ("node:path");

const {startWebAppServer} = require ("web");
const Application = require ("engine/application");
console.timeEnd("load dependencies");


const scraporchestra_dir = path.join("/", "udata", "scraporchestra");

const options = {
	dir : scraporchestra_dir,
}


console.time("App Start");
new Application(options).init().then( async ( application )=>{
	console.time("Webapp Start");
	await startWebAppServer( application );
	console.timeEnd("Webapp Start");
	console.timeEnd("App Start");
});


