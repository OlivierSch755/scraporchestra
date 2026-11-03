const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");
const request = require("supertest");
const assert = require("node:assert/strict");

const {RessourceState} = require("engine/states");
const Application = require("engine/application");

const {startWebAppServer} = require("web");

async function createTestApp(options = {}) {
	
	let root;
	let keep_root = options.keep_root || false;
	
	
	// let test provide its own root if needed
	if(options.root){
		root = options.root;
	}
	else{
		root = await fs.mkdtemp(
			path.join(os.tmpdir(), "scraporchestra-test-")
		);
	}
	
	let application;
	let webServer;

	try {
		application = new Application({
			dir: root
		});
		await application.init();

		webServer = await startWebAppServer(application, {
			port: 0,
			log_app_errors: false,
			log_unexpected_errors: false,
		});

		return {
			root,
			application,
			webServer,

			async close() {
				if (webServer) {
					await webServer.close();
					webServer = null;
				}

				try{
					await application.engine.close_project();
				}
				catch(err){
					if(application.engine.degraded) throw new Error("Could not clean up system properly");
				}
				finally{
					if(!keep_root){
						await fs.rm(root, {
							recursive: true,
							force: true
						});
					}
				}
			},
		};
	}
	catch(err){
		if (webServer) {
			await webServer.close();
		}
		await fs.rm(root, {
			recursive: true,
			force: true
		});
		throw err;
	}
}

async function createTestProject(ctx, projectName) {
	await request(ctx.webServer.server)
		.post(`/projects/api/create/${projectName}`)
		.expect(200);
	await verifyProjectDirectoryExists(ctx, projectName);
}

async function loadTestProject(ctx, projectName, options = {}, attempt = 0, max_attempts = 2) {
	
	const timeout_duration = options?.timeout_duration ?? 5000;
	let settled = false;
	
	const timeout_promise = new Promise( (_,reject)=>{
		setTimeout(
			()=>{
				if(settled) return;
				settled = true;
				reject();
			}, timeout_duration
		);
	});
	
	const request_promise = request(ctx.webServer.server)
		.post(`/projects/api/open/${projectName}`)
		.expect(200)
		.then( ()=>{
			if(settled) return;
			settled = true;
		});
	
	try{
		await Promise.race([timeout_promise, request_promise]);
	}
	catch(err){
		throw new Error("Could not load project in a timely fashion")
	}
	
	assert.equal(ctx.application.engine.project.name, projectName );
	assert.equal(ctx.application.engine.project.state, RessourceState.READY );
	assert.equal(ctx.application.engine.state, RessourceState.READY );
}

async function verifyProjectDirectoryExists(ctx, projectName){
	const stat = await fs.stat( path.join(ctx.root, "projects", projectName ) );
	assert.ok(stat.isDirectory());
}

module.exports = {
	createTestApp,
	createTestProject,
	loadTestProject,
	verifyProjectDirectoryExists
};
