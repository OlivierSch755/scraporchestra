/*
	Suite of test for base component class
*/


const {describe,it,before,after} = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs/promises");
const path = require("node:path");

// Use our own set of dummy components instead of regular ones
process.env.COMPONENTS_PATH = path.join(__dirname, "/helpers/dummy_components");

const {RessourceState} = require("engine/states");
const ComponentErrors = require("engine/component/errors");
const {createTestApp, createTestProject, loadTestProject} = require("./helpers/create-test-app");
const CrasherComponent = require("./helpers/dummy_components/crasher/crasher.js");

const projectName = "test_project_components";

function assertEngineDegradedState(ctx){
	assert.equal(
		ctx.application.engine.state, 
		RessourceState.ERROR, 
		"Engine should be in ERROR state"
	);
	
	assert.equal(
		ctx.application.engine.degraded, 
		true,
		"Engine should have degraded flag"
	);
}

describe("Component discovery API", { concurrency: false }, () => {
	let ctx;
	
	before(async () => {
		ctx = await createTestApp();
	});

	after(async () => {
		await ctx?.close();
	});

	it("produces a valid list of available components", async () => {
		const response = await request(ctx.webServer.server)
			.get(`/components/list.json`)
			.expect(200);
			
		assert.ok(response.body.crasher)
		assert.ok(response.body.working)
	});
	
	
});

describe("Component API lifecycle", { concurrency: false }, () => {
	let ctx;
	
	before(async () => {
		ctx = await createTestApp();
		await createTestProject(ctx, projectName);
		await loadTestProject(ctx, projectName);
	});

	after(async () => {
		await ctx?.close();
	});

	it("verifies guard against installing unknown component", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send(["I_do_not_exist"])
			.set('Content-Type', 'application/json')
			.expect(404);
			
			assert.equal(ctx.application.engine.project.components.I_do_not_exist, undefined );
			
	});
	
	it("installs working component",  async () => {
		
		const component_name = "working";
		
		await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send([component_name])
			.set('Content-Type', 'application/json')
			.expect(200);
			
			assert.equal(ctx.application.engine.project.components[component_name].state, RessourceState.READY );
			assert.equal(ctx.application.engine.project.state, RessourceState.READY );	
			
	});
	
	it("verifies component cannot be installed multiple times",  async () => {
		const component_name = "working";
		 await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send([component_name])
			.set('Content-Type', 'application/json')
			.expect(409);
	});
	
	it("produces error when installing a crashing component in a running project", async () => {
		CrasherComponent.crash_on_init = true;
		
		const component_name = "crasher";
		
		try{
			const res = await request(ctx.webServer.server)
				.post(`/projects/api/add_components`)
				.send([component_name])
				.set('Content-Type', 'application/json')
		}
		finally{
			CrasherComponent.crash_on_init = false;	
		}
		assert.equal(ctx.application.engine.project.components[component_name].state, RessourceState.ERROR );
		assert.equal(ctx.application.engine.project.state, RessourceState.ERROR );	
	});
	
	it("can uninstall component after failed installation", async () => {
		
		const component_name = "crasher";
		
		const result = await request(ctx.webServer.server)
			.post(`/projects/api/delete_component/${component_name}`)
			.expect(200);
			
		assert.equal(ctx.application.engine.project.components[component_name], undefined );
		
		assert.equal(
			ctx.application.engine.project.state, 
			RessourceState.READY,
			"Project state should be READY after removing faulty component"
		);	
	});
	
	it("can uninstall working component", async () => {
		
		const component_name = "working";
		
		await request(ctx.webServer.server)
			.post(`/projects/api/delete_component/${component_name}`)
			.expect(200);
			
		assert.equal(ctx.application.engine.project.components[component_name], undefined );
		
		assert.equal(
			ctx.application.engine.project.state, 
			RessourceState.READY,
			"Project state should be READY after removing working component"
		);	
	});
	
});

describe("Component API no project", { concurrency: false }, () => {
	let ctx;
	
	before(async () => {
		ctx = await createTestApp();
	});

	after(async () => {
		await ctx?.close();
	});

	it("rejects component installation when no project is loaded", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send(["working"])
			.set('Content-Type', 'application/json')
			.expect(409);
	});
	
	it("rejects component uninstallation when no project is loaded", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/delete_component/working`)
			.expect(409);
	});
	
});

describe("Component API missing installation", { concurrency: false, todo: true },  () => {
	
	it("rejects loading a project when one of its components installation file(s) have been removed", {todo: true}, async () => {

	});
	
})

describe("Project close fatal errors (degraded state)", { concurrency: false},  () => {
	let ctx;
	
	before(async () => {
		ctx = await createTestApp();
		await createTestProject(ctx, projectName);
		await loadTestProject(ctx, projectName);
	});

	after(async () => {
		try{
			await ctx?.close();
		}
		catch(err){
			// expected here: this is what we are testing.
			if(err.message !== "Could not clean up system properly"){ 
				throw err;
			}
		}
	});


	it("goes to Engine Degraded path after a component close failure during project close",  async () => {
		CrasherComponent.crash_on_init = false;
		CrasherComponent.crash_on_close = true;
		const component_name = "crasher";
		
		try{
			await request(ctx.webServer.server)
				.post(`/projects/api/add_components`)
				.send([component_name])
				.set('Content-Type', 'application/json')
				.expect(200);
				
			await request(ctx.webServer.server)
				.post(`/projects/api/close`)
				.expect(500);
		}
		finally{
			CrasherComponent.crash_on_init = false;	
			CrasherComponent.crash_on_close = false;	
		}
		
		assertEngineDegradedState(ctx);
		
	});
	
});

describe("Live uninstallation fatal errors (degraded state)", { concurrency: false},  () => {
	let ctx;
	
	before(async () => {
		ctx = await createTestApp();
		await createTestProject(ctx, projectName);
		await loadTestProject(ctx, projectName);
	});

	after(async () => {
		try{
			await ctx?.close();
		}
		catch(err){
			// expected here: this is what we are testing.
			if(err.message !== "Could not clean up system properly"){ 
				throw err;
			}
		}
	});

	it("goes to Engine Degraded path after a component failed to close during component uninstallation",  async () => {
		CrasherComponent.crash_on_init = false;
		CrasherComponent.crash_on_close = true;
		try{
			const component_name = "crasher";
			
			// install without crashing
			await request(ctx.webServer.server)
				.post(`/projects/api/add_components`)
				.send([component_name])
				.set('Content-Type', 'application/json')
				.expect(200);
				
			// crash during uninstall
			await request(ctx.webServer.server)
				.post(`/projects/api/delete_component/${component_name}`)
				.expect(500);
			
		}
		finally{
			CrasherComponent.crash_on_init = false;	
			CrasherComponent.crash_on_close = false;	
		}
		
		assertEngineDegradedState(ctx);
		
	});
	
});

describe("Degraded state handling", { concurrency: false},  () => {
	let ctx;
	
	let component_name = "dummy_component_name"
	let component_instance = {};
	
	before(async () => {
		ctx = await createTestApp();
		await createTestProject(ctx, projectName);
		await loadTestProject(ctx, projectName);
	});

	after(async () => {
		try{
			await ctx?.close();
		}
		catch(err){
			// expected here: this is what we are testing.
			if(err.message !== "Could not clean up system properly"){ 
				throw err;
			}
		}
	});

	it("verifies Engine.handleCloseComponentError method",  async () => {
		
		// create a dummy error and pass it in the engine processor
		const dummy_child_error = new Error("Test-generated Error");
		const dummy_error = new ComponentErrors.ComponentNotProperlyClosedError();
		dummy_error.component_name = component_name;
		dummy_error.component_instance = component_instance;
		dummy_error.cause = dummy_child_error;

		assert.throws(
		    ()=> ctx.application.engine.handleCloseComponentError(dummy_error),
		  {
			name: 'EngineDegradedError',
			cause: dummy_error,
		  },
		);
		
		assertEngineDegradedState(ctx);
		
	});
	
	it("rejects project operations when engine is degraded",  async () => {
		
		// should not allow to close project
		let res = await request(ctx.webServer.server)
			.post(`/projects/api/close`);
			
		assert.equal(
			res.status,
			409,
			`Calling close project API when degraded should return HTTP 409, got ${res.status}: ${res.text}`
		);

		// should not allow to open project
		res = await request(ctx.webServer.server).post(`/projects/api/open/${projectName}`)
		assert.equal(
			res.status,
			409,
			`Calling open project API when degraded should return HTTP 409, got ${res.status}: ${res.text}`
		);

		const component_name = "working";
		
		// should not allow to install components
		res = await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send([component_name])
			.set('Content-Type', 'application/json');
			
		assert.equal(
			res.status,
			409,
			`Calling component installation API when degraded should return HTTP 409, got ${res.status}: ${res.text}`
		);
		
		
		// should not allow to uninstall components
		res = await request(ctx.webServer.server)
			.post(`/projects/api/delete_component/${component_name}`)
			.set('Content-Type', 'application/json');
			
		assert.equal(
			res.status,
			409,
			`Calling component installation API when degraded should return HTTP 409, got ${res.status}: ${res.text}`
		);
		
		
		
		
	});
	
	
});

describe("Degraded state error reporting", { concurrency: false, todo : true},  () => {
	
	it("returns degraded state in a consistent format", { todo:true },  async () => {
		
	});
	
	it("provides a user-readable way to understand degraded state", { todo:true },  async () => {
		
	});
	
})