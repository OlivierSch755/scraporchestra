function tokenize(input) {
	const regex = /\{|\}|>|\.\.|-?\d+|[A-Za-z_][A-Za-z0-9_]*|\S/g;
	return input.match(regex) ?? [];
}


function parseLine(line) {
	
    const tokens = tokenize(line);
    let i = 0;

    function readValue() {
        if (i >= tokens.length)
            throw new Error("Unexpected end of input");

        const tok = tokens[i++];

        if (tok === "{") {
            const items = [];

            while (true) {
                if (i >= tokens.length)
                    throw new Error("Missing closing '}'");

                if (tokens[i] === "}") {
                    i++; // consume }
                    return items;
                }

                items.push(readValue());
            }
        }

		if (/^-?\d+$/.test(tok)) {
			const n = Number(tok);

			if (tokens[i] === "..") {
				i++; // consume ".."

				if (i >= tokens.length || !/^-?\d+$/.test(tokens[i]))
					throw new Error("Expected number after '..'");

				return {
					type: "range",
					from: n,
					to: Number(tokens[i++])
				};
			}

			return n;
		}
		
        return tok;
    }

	const result = [];

	while (i < tokens.length) {
		result.push(readValue());
	}

	return result;
}


function parseFilterRules(lines){
	return lines.slice(1,-1).map( line => {
		
		const rule_tokens = parseLine(line);
		
		const ruleType = rule_tokens[0];


		const rule = {type : ruleType};

		switch (ruleType) {
			
			case "evmap" : {
				const arrow = rule_tokens.indexOf(">");
				let match = rule_tokens.slice(1, arrow);
				let action = rule_tokens.slice(arrow + 1);

				rule.action = parseEvmap(action);
				rule.match = parseEvmap(match);
				break;
			}	
			case "transp" : {
				rule.transpose = parseTranspose(rule_tokens.slice(1));
				break;
			}	
			
			case "vcurve" : {
				rule.velocityCurve = parseVelocityCurve(rule_tokens.slice(1));
				break;
			}
			
		}

		return rule;
	
	});
}

function parseVelocityCurveWeight(x){
  return x < 64 ? x : x - 128;
} 

function parseVelocityCurve(subset){
	const type = subset[0];
	const result = {type};
	result.devices = subset[1][0];
	result.channels = subset[1][1];
	result.weight = parseVelocityCurveWeight(subset[2]);
	return result;
}

function parseTranspose(subset){
	const type = subset[0];
	const result = {type};
	result.devices = subset[1][0];
	result.channels = subset[1][1];
	result.semitones = subset[2];
	return result;
}

function parseEvmap(subset){
	
	const type = subset[0];
	const result = {type};
	result.devices = subset[1][0];
	result.channels = subset[1][1];
	
	switch(type){
		
		case "any" : 
		case "bend" : 
		break;
			
		case "xctl" :
			result.controllers = subset[2];
		break;
		
		case "note" : 
			result.notes = subset[2];
		break;
		
		case "xpc" : 
			result.bank = subset[2];
			result.patch = subset[3];
		break;
		
		case "nrpn" : 
			result.NRPN_parameter_number = subset[2];
			result.NRPN_parameter_value = subset[3];
		break;
	}
		return result;
	
	
}
		


module.exports = {
	parseFilterRules,
	parseLine
}