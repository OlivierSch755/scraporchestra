const Evspec = require("./evspec.js");

const defaultState = {
	outlist: [],
	inlist: [],
	filtlist: [],
	tracklist: [],
	sysexlist: [],
	curout: null,
	curin: null,
	curfilt: null,
	curtrack: null,
	cursysex: null,
	curquant: null,
	curev: null,
	curpos: 0,
	curlen: 0,
	tap: null,
	tapev: null
};

function parseMetaTrackinfo(lines) {
  return lines.map(line => {
		const match = line.match(
			/^\s*(\d+)\s+\{(\d+)\s+(\d+)\}\s+(\d+)(?:\s+#\s*-\s*(\d+))?/
		);

		if (!match) return null;

		const [, meas, beats, unit, tempo, endTempo] = match;

		return {
			measure: Number(meas),
			timeSignature: {beats : Number(beats), unit : Number(unit)},
			endTempo: Number(endTempo ?? tempo),
			startTempo: Number(tempo),
		};
    })
    .filter(Boolean);
}

function parseConfig(lines) {
	
	const result = structuredClone(defaultState)

	let currentBlock = null;

	for (const rawLine of lines) {
		const line = rawLine.trim();

		// block start
		const blockMatch = line.match(/^(\w+)\s*\{$/);
		if (blockMatch) {
			currentBlock = blockMatch[1];
			continue;
		}

		// block end
		if (line === "}") {
			currentBlock = null;
			continue;
		}

		// inside a block
		if (currentBlock) {
			if (line.startsWith("#")) continue;

			switch (currentBlock) {
				case "tracklist": {
					const match = line.match(/^\s*(\S+)\s+(\S+)\s+(\{.*\})(?:\s+(.+))?\s*$/);

					if (!match) break;

					const [, name, filter, channelsRaw, flagsRaw] = match;

					const flags = new Set( flagsRaw ? flagsRaw.trim().split(/\s+/) : [] );
					flags.toJSON = ()=>([...flags]);
					result.tracklist.push({
						name,
						flags,
						filter: filter === "nil" ? null : filter,
						channels: [...channelsRaw.matchAll(/\{(\d+)\s+(\d+)\}/g)]
							.map(([, device, channel]) => ({
								device: Number(device),
								channel: Number(channel)
							}))
					});
					break;
				}

				case "outlist":
				case "inlist":
					// TODO: parse channel entries
					break;

				case "filtlist":
					result.filtlist.push(line);
					break;

				case "sysexlist":
					// TODO: parse sysex entries
					break;
			}

			continue;
		}

		// key/value lines outside blocks
		const kv = line.match(/^(\w+)\s+(.*)$/);
		if (!kv) continue;

		const [, key, value] = kv;

		switch (key) {
			case "curev":
				result[key] = Evspec.hydrateString(value);
				break;

			case "tap":
				result[key] = value;
				break;

			case "curpos":
			case "curlen":
				result[key] = Number(value);
				break;

			case "tapev" : 
				result[key] = value === "nil" ? null : value;
				try{
					result[key] = Evspec.hydrateString(value);
				}	
				catch(err){
					console.log(err)
				}
				break;


			default:
				result[key] = value === "nil" ? null : value;
		}
	}

	return result;
}


module.exports = {
	parseMetaTrackinfo, 
	parseConfig, 
}