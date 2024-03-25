//Imports
const FuzzyMatcher = require('fuzzy-matching');
const { NODE_TYPES } = require('../analyzer/config');
const { nodeHasType } = require('../analyzer/helpers');

//Internals
const errorType = 'Untyped';

//Checks
const fmComponent = new FuzzyMatcher(['id', 'prps', 'wgts', 'scope', 'relId', 'traits', 'trait', 'traitPrps', 'acceptPrps', 'container', 'auth']);
const checkComponentKeywords = (node, errors) => {
	const match = fmComponent.get(node.name);

	if (match.distance === 1)
		return false;
	
	if (match.distance > 0) {
		errors.push({
			errorType,
			message: `Component contains unexpected entry "${node.name}", did you mean "${match.value}"?`,
			severity: 2,
			node
		});
	} else {
		errors.push({
			errorType,
			message: `Component contains unexpected entry "${node.name}"`,
			severity: 2,
			node
		});
	}

	return true;
};

const untyped = (node, errors) => {
	if (!node.types || node.types.length > 0)
		return;

	//If we are inside a component check keywords
	if (nodeHasType(node.parentNode, NODE_TYPES.COMPONENT)) {
		if (checkComponentKeywords(node, errors))
			return;
	}

	errors.push({
		errorType,
		message: 'Analyzer could not determine node type',
		severity: 2,
		node
	});
};

module.exports = {
	check: untyped,
	init: () => {}
};
