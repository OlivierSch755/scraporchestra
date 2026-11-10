export async function toggleTrackMute( track_name, muted = false ) {
	const response = await fetch(
		`/components/midish/api/mute/${encodeURIComponent(track_name)}/${muted?"0":"1"}`, {method: 'POST'}
	);
	if (!response.ok) {
		throw new Error(
			await response.text() || 'Could not toggle mute state for track '+ track_name
		);
	}
};