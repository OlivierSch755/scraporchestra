const grpc = require("@grpc/grpc-js");


const ABANDON_TIMEOUT = 10_000; // how long we are willing to wait for sushi grpc to be available before we abandon.

function getGrpcClient(child) {
    const client = new grpc.Client(
        "localhost:51051",
        grpc.credentials.createInsecure()
    );

    return new Promise((resolve, reject) => {
        let settled = false;

        function cleanup() {
            child.off("exit", onExit);
        }

        function fail(err) {
            if (settled) return;
            settled = true;
            cleanup();
            client.close();
            reject(err);
        }

        function onExit(code, signal) {
            fail(new Error(
                `gRPC server process exited before readiness ` +
                `(code=${code}, signal=${signal})`
            ));
        }

        // Handle a process that has already exited.
        if (child.exitCode !== null || child.signalCode !== null) {
            fail(new Error("gRPC server process has already exited"));
            return;
        }

        child.on("exit", onExit);

        client.waitForReady(
            Date.now() + ABANDON_TIMEOUT,
            err => {
                if (err) {
                    fail(err);
                    return;
                }

                if (settled) return;
                settled = true;
                cleanup();
                resolve(client);
            }
        );
    });
}



function unary( client, method, data = {} ) {
	return new Promise((resolve, reject) => {
		client.makeUnaryRequest(
			method.path,
			x => method.resolvedRequestType.encode(x).finish(),
			d => method.resolvedResponseType.decode(d),
			data,
			new grpc.Metadata(),
			{},
			(err, res) => err ? reject(err) : resolve(res)
		);
	});
}


module.exports = {
	getGrpcClient,
	unary
}