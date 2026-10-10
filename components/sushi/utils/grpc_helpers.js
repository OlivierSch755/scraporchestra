const grpc = require("@grpc/grpc-js");


const ABANDON_TIMEOUT = 10_000; // how long we are willing to wait for sushi grpc to be available before we abandon.

function getGrpcClient(){
	const client = new grpc.Client("localhost:51051", grpc.credentials.createInsecure());
	return new Promise((resolve, reject) => {
		client.waitForReady(Date.now() + ABANDON_TIMEOUT, err =>
			err ? reject(err) : resolve(client)
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