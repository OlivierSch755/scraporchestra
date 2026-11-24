const endpoint = "/components/midi_connections/api/"

export async function connect( sender, receiver, optional = false ) {
	const response = await fetch(
		endpoint + `connect/${encodeURIComponent(sender)}/${encodeURIComponent(receiver)}/${optional?"1":"0"}`,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not connect ports'
		);
	}
};

export async function deleteRule( id ) {
	const response = await fetch(
		endpoint + `delete_rule/${encodeURIComponent(id)}`,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not delete rule'
		);
	}
};
