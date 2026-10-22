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
const {createTestApp, createTestProject, loadTestProject} = require("./helpers/create-test-app");
const CrasherComponent = require("./helpers/dummy_components/crasher/crasher.js");

const projectName = "test_project_components";


describe("Component discovery API", { concurrency: false }, () => {
	let ctx;
	
	before(async () => {
		ctx = await createTestApp();
	});

	after(async () => {
		await ctx?.close();
	});

	it("Produces a valid list of available components", async () => {
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
	
	it("Rejects loading a project when one of its components installation file(s) have been removed", {todo: true}, async () => {

	});
	
})

describe("Handling Component not being properly terminated on project close", { concurrency: false},  () => {
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
			// expected here
			if(err.message !== "Could not clean up system properly"){ 
				throw err;
			}
		}
	});


	it("Goes to Engine Degraded path after a component close failure during project close",  async () => {
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
		
	});
	
});

describe("Handling Component not being properly terminated when removed from running project", { concurrency: false},  () => {
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
			// expected here
			if(err.message !== "Could not clean up system properly"){ 
				throw err;
			}
		}
	});


	it("Goes to Engine Degraded path after a component failed to close during component uninstallation",  async () => {
		CrasherComponent.crash_on_init = false;
		CrasherComponent.crash_on_close = true;
		try{
			const component_name = "crasher";
		
			await request(ctx.webServer.server)
				.post(`/projects/api/add_components`)
				.send([component_name])
				.set('Content-Type', 'application/json')
				.expect(200);
				
			await request(ctx.webServer.server)
				.post(`/projects/api/delete_component/${component_name}`)
				.expect(500);
			
		}
		finally{
			CrasherComponent.crash_on_init = false;	
			CrasherComponent.crash_on_close = false;	
		}
		
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
		
	});
	
});