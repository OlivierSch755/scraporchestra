const endpoint = "/components/midish/api/"

/*
	------------ Transport Requests ------------
*/

export async function transport_play() {
	const response = await fetch(
		endpoint + "transport/play",
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not start transport'
		);
	}
};

export async function transport_record(track_name) {
	track_name = encodeURIComponent(track_name);
	const response = await fetch(
		endpoint + "transport/record/" + track_name,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not start transport recording'
		);
	}
};

export async function transport_stop() {
	const response = await fetch(
		endpoint + "transport/stop",
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not stop transport'
		);
	}
};

export async function transport_idle() {
	const response = await fetch(
		endpoint + "transport/idle",
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not set transport idle mode'
		);
	}
};

export async function transport_seek(measure) {
	const response = await fetch(
		endpoint + "transport/seek/" + Number(measure) ,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not set transport idle mode'
		);
	}
};

export async function tempo_set_factor(tempo_factor) {
	
	if(tempo_factor < 50 || tempo_factor > 200){
		throw new Error("Tempo must be between 50 and 200");
	}
	
	const response = await fetch(
		endpoint + "transport/tempo_factor/" + Number(tempo_factor) ,
		{method: 'POST'}
	);
	
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not set tempo factor'
		);
	}
	
};

/*
	------------ Track Requests ------------
*/

export async function create_track(track_name) {
	track_name = encodeURIComponent(track_name);
	const response = await fetch(
		endpoint + `track/create/${track_name}`,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not create track'
		);
	}
};

export async function delete_track(track_name) {
	track_name = encodeURIComponent(track_name);
	const response = await fetch(
		endpoint + `track/delete/${track_name}`,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not delete track'
		);
	}
};

export async function select_filter(track_name, filter_name) {
	track_name = encodeURIComponent(track_name);
	track_name = encodeURIComponent(filter_name);
	const response = await fetch(
		endpoint + `track/filter/select/${track_name}/${filter_name}`,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not delete track'
		);
	}
};

export async function rename_track(old_name, new_name) {
	
	old_name = encodeURIComponent(old_name);
	new_name = encodeURIComponent(new_name);
	
	const response = await fetch(
		endpoint + `track/rename/${old_name}/${new_name}`,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not rename track'
		);
	}
};

export async function toggle_track_mute( track_name, muted = false ) {
	const response = await fetch(
		endpoint + `mute/${encodeURIComponent(track_name)}/${muted?"1":"0"}`,
		{method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not toggle mute state for track '+ track_name
		);
	}
};


/*
	------------ Session requests ------------
*/


export async function session_import_midi(data) {
	
	if( !data.get("midi_file") instanceof File ){
		throw new Error("File expected")
	}
	
	const response = await fetch(
		endpoint + "import",
		{
			method: 'POST',
			body: data
		}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not import MIDI file'
		);
	}
};