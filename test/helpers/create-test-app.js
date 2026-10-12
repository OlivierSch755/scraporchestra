const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs/promises");

const Application = require("engine/application");
const {
	startWebAppServer
} = require("web");

async function createTestApp() {
	const root = await fs.mkdtemp(
		path.join(os.tmpdir(), "scraporchestra-test-")
	);

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

				// Close application-owned resources here,
				// using your actual application shutdown API.

				await fs.rm(root, {
					recursive: true,
					force: true
				});
			},
		};
	}
	catch (err) {
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

module.exports = {
	createTestApp
};
