//Imports
const FuzzyMatcher = require('fuzzy-matching');
const { NODE_TYPES } = require('../analyzer/config');
const { nodeHasType, ancestorHasComponentType } = require('../analyzer/helpers');

//Internals
const errorType = 'Component Keywords';

const fmComponent = new FuzzyMatcher(['id', 'type', 'prps', 'wgts', 'scope', 'relId', 'traits', 'trait', 'traitPrps', 'container', 'auth', 'comment', 'condition', 'comments']);
const fmTrait = new FuzzyMatcher(['acceptPrps', 'traitConfig', 'id', 'type', 'prps', 'wgts', 'scope', 'relId', 'traits', 'trait', 'traitPrps', 'container', 'auth', 'comment', 'condition', 'comments']);
const fmComponentInsideRowMda = new FuzzyMatcher(['rowPrps', 'id', 'type', 'prps', 'wgts', 'scope', 'relId', 'traits', 'trait', 'traitPrps', 'container', 'auth', 'comment', 'condition', 'comments']);
const fmComponentPopoverMda = new FuzzyMatcher(['position', 'popoverZIndex', 'id', 'type', 'prps', 'wgts', 'scope', 'relId', 'traits', 'trait', 'traitPrps', 'container', 'auth', 'comment', 'condition', 'comments']);

//Checks
const componentKeywords = (node, errors, mdaPackage) => {
	if (!nodeHasType(node, NODE_TYPES.COMPONENT))
		return;

	const keys = Object.keys(node.value);
	node.children.forEach(n => keys.push(n.name));

	keys.forEach(k => {
		let match;

		if (
			nodeHasType(node, NODE_TYPES.TRAIT_DEFINITION) || 
			nodeHasType(node, NODE_TYPES.TRAIT_UNUSED)
		)
			match = fmTrait.get(k);
		else if (ancestorHasComponentType(node.parentNode, 'repeater'))
			match = fmComponentInsideRowMda.get(k);
		else if (nodeHasType(node, NODE_TYPES.COMPONENT_POPOVER_MDA))
			match = fmComponentPopoverMda.get(k);
		else
			match = fmComponent.get(k);

		if (match.distance === 1)
			return;

		if (match.distance > 0) {
			errors.push({
				errorType,
				message: `Component keyword ${k} does not exist, did you mean "${match.value}"?`,
				severity: 2,
				node
			});
		} else {
			errors.push({
				errorType,
				message: `Component keyword ${k} does not exist`,
				severity: 2,
				node
			});
		}
	});
};

module.exports = {
	check: componentKeywords,
	init: () => {}
};

