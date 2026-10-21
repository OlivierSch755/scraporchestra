/*
	Suite of test for basic project lifecycle API
*/


const {describe,it,before,after} = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs/promises");
const path = require("node:path");

const {RessourceState} = require("engine/states");


const {
	createTestApp
} = require("./helpers/create-test-app");

const projectName = "test_project";


describe("Project lifecycle API", { concurrency: false },  () => {
	let ctx;
	let loaded_project;
	
	before(async () => {
		ctx = await createTestApp();
	});

	after(async () => {
		await ctx?.close();
	});

	it("creates an empty project", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/create/${projectName}`)
			.expect(200);
		
		const stat = await fs.stat( path.join(ctx.root, "projects", projectName ) );
		assert.ok(stat.isDirectory());
	});
	
	it("rejects duplicate project creation", async () => {
		await request(ctx.webServer.server)
			.post(`/projects/api/create/${projectName}`)
			.expect(409);
	});
	
	it("rejects invalid characters in project name", async () => {
		const invalid_project_name = "*$.test";
		await request(ctx.webServer.server)
			.post(`/projects/api/create/${invalid_project_name}`)
			.expect(400);
	});
	
	it("rejects deleting project that does not exist", async () => {
		const non_project = "I_do_not_exist";
		await request(ctx.webServer.server)
			.post(`/projects/api/delete/${non_project}`)
			.expect(404);
	});
	
	
	it("loads project", async () => {
		
		await request(ctx.webServer.server)
			.post(`/projects/api/open/${projectName}`)
			.expect(200);
			
		assert.equal(ctx.application.engine.project.name, projectName );
		assert.equal(ctx.application.engine.project.state, RessourceState.READY );
		assert.equal(ctx.application.engine.state, RessourceState.READY );
		
		loaded_project = ctx.application.engine.project;
	});
	
	it("closes project", async () => {
		
		await request(ctx.webServer.server)
			.post(`/projects/api/close`)
			.expect(200);
			
		assert.equal(ctx.application.engine.project, null );
		assert.equal(ctx.application.engine.state, RessourceState.CLOSED );
		assert.equal(loaded_project.state, RessourceState.CLOSED );
		
	});
	
	it("deletes project", async () => {
		
		await request(ctx.webServer.server)
			.post(`/projects/api/delete/${projectName}`)
			.expect(200);
			
		await assert.rejects(
			fs.stat(path.join(ctx.root, "projects", projectName)),
			{ code: "ENOENT" }
		);
	});
	
	
});


