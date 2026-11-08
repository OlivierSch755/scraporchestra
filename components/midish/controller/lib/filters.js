const Evspec = require("./evspec.js");

function parseLine(line){
	
	const {type, rule} = /^\s+(?<type>\S+)\s(?<rule>.*)$/.exec(line).groups;
	
	switch(type){
		
		case "evmap" : {
			
			/*
				Here rule looks like this : 
					any {1 1..15} > any {0 1..15}
				two string-encoded evspecs separated by a ">" token
			*/
			
			const [raw_match,raw_action] = rule.split(">");
			const match = Evspec.hydrateString(raw_match);
			const action = Evspec.hydrateString(raw_action);
			
			return ( {
				type : "evmap",
				match,
				action
			});
		
		}
		
		case "transp" : {
			/*
				Here rule looks like this : 
					 note {0..15 0..15} 0..127 2
					 evspec halftones
				a string-encoded evspec and integer (transposition factor)
			*/
			let {match,halftones} = /^(?<match>.*)\s(?<halftones>\d+)$/.exec(rule).groups;
			match = Evspec.hydrateString(match);
			halftones = Number(halftones);
			
			return ( {
				type : "transp",
				match,
				halftones
			});
		}
		
		case "vcurve" : {
			/*
				Here rule looks like this : 
					 note {0..15 0..15} 0..127 2
					 evspec weight
				a string-encoded evspec and integer (transposition factor)
			*/
			let {match,weight} = /^(?<match>.*)\s(?<weight>\d+)$/.exec(rule).groups;
			match = Evspec.hydrateString(match);
			weight = Number(weight);
			weight = parseVelocityCurveWeight(weight);
			
			return ( {
				type : "vcurve",
				match,
				weight
			});
		}
		
	}
	
	
}

function parseFilterRules(lines){
	return lines.slice(1,-1).map( parseLine );
}

function parseVelocityCurveWeight(x){
	return x < 64 ? x : x - 128;
} 

module.exports = {
	parseFilterRules,
	parseLine
}