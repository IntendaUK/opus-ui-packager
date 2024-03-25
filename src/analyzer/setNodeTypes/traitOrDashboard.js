//Imports
const { NODE_TYPES } = require('../config');
const { stringsWithSlashes, traitDefinitions } = require('../internals');
const { nodeHasType, componentTraitPointsToNode } = require('../helpers');

//Helper
const setTDTypes = node => {
	const result = node.types;

	//TRAIT_DEFINITION
	if (
		nodeHasType(node, NODE_TYPES.FILE)
	) {
		if (
			!nodeHasType(node, NODE_TYPES.COMPONENT) &&
			!nodeHasType(node, NODE_TYPES.THEME) &&
			!nodeHasType(node, NODE_TYPES.ENSEMBLE_CONFIG) &&
			!nodeHasType(node, NODE_TYPES.ENSEMBLE_CONFIG_ENTRY) &&
			!nodeHasType(node, NODE_TYPES.STARTUP) &&
			!node.children.some(c => c.name === 'traitArray')
		)
			result.push(NODE_TYPES.COMPONENT);

		if (
			componentTraitPointsToNode(node) ||
			(
				node.children.some(c => c.name === 'acceptPrps') &&
				stringsWithSlashes.some(s => node.path === `/dashboard/${s}.json`)
			)
		) {
			result.push(NODE_TYPES.TRAIT_DEFINITION);

			traitDefinitions.push(node);
		} else if (
			stringsWithSlashes.some(s => node.path === `/dashboard/${s}.json`)
		)
			result.push(NODE_TYPES.DASHBOARD_OR_TRAIT_DEFINITION);
	}

	//DASHBOARD
	if (
		node.name.indexOf('.json') > -1 &&
		nodeHasType(node.parentNode, NODE_TYPES.FOLDER) &&
		!nodeHasType(node, NODE_TYPES.TRAIT_DEFINITION) &&
		!nodeHasType(node, NODE_TYPES.DASHBOARD_OR_TRAIT_DEFINITION) &&
		!node.children.some(c => c.name === 'acceptPrps')
	)
		result.push(NODE_TYPES.DASHBOARD);
};

module.exports = setTDTypes;
