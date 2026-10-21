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
		await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send(["working"])
			.set('Content-Type', 'application/json')
			.expect(200);
			
			assert.equal(ctx.application.engine.project.components.working.state, RessourceState.READY );
			assert.equal(ctx.application.engine.project.state, RessourceState.READY );	
			
	});
	
	it("verifies component cannot be installed multiple times",  async () => {
		 await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send(["working"])
			.set('Content-Type', 'application/json')
			.expect(409);
	});
	
	it("produces error when installing a crashing component in a running project", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/add_components`)
			.send(["crasher"])
			.set('Content-Type', 'application/json')
			.expect(500);
			
		assert.equal(ctx.application.engine.project.components.crasher.state, RessourceState.ERROR );
		assert.equal(ctx.application.engine.project.state, RessourceState.ERROR );	
	});
	
	it("can uninstall faulty component", async () => {
		const result = await request(ctx.webServer.server)
			.post(`/projects/api/delete_component/crasher`)
			.expect(200);
			
		assert.equal(ctx.application.engine.project.components.crasher, undefined );
		
		assert.equal(
			ctx.application.engine.project.state, 
			RessourceState.READY,
			"Project state should be READY after removing faulty component"
		);	
	});
	
	
	
});

describe("Component API: no project error handling", { concurrency: false }, () => {
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

describe("Handling Component not being properly terminated", { concurrency: false, todo: true },  () => {
	
	it("Notifies engine degraded after error detection", {todo: true}, async () => {

	});
	
})