//Imports
const { NODE_TYPES, NODE_PROPERTIES, NODE_PROPERTIES_NEEDED } = require('../config');
const { implementedTraitPaths } = require('../internals');
const { nodeHasType, countProperties } = require('../helpers');

//Helper
const setComponentType = node => {
	const result = node.types;

	//COMPONENT
	if (
		nodeHasType(node.parentNode, NODE_TYPES.WGTS_ARRAY) ||
		countProperties(node.obj, NODE_PROPERTIES.COMPONENT) >= NODE_PROPERTIES_NEEDED.COMPONENT ||
		(
			node.name === 'value' &&
			nodeHasType(node.parentNode, NODE_TYPES.SCP_ACTION) &&
			node.parentNode.value.type === 'setState' &&
			node.parentNode.value.key === 'extraWgts' &&
			node.parentNode.value.valueType === 'object'
		) ||
		(
			node.name === 'rowMda' &&
			nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
		) ||
		(
			node.name === 'mdaLabel' &&
			nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
		) ||
		(
			node.name === 'popoverMda' &&
			node.valueType === 'object' &&
			nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
		) ||
		(
			node.name === 'tooltipMda' &&
			node.valueType === 'object' &&
			nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
		)
	) {
		result.push(NODE_TYPES.COMPONENT);

		if (node.value.trait) {
			implementedTraitPaths.push({
				node: node,
				traitPath: node.value.trait + '.json'
			});
		}
	}

	//COMPONENT_AUTH_ARRAY
	if (
		node.name === 'auth' &&
		node.valueType === 'array' &&
		nodeHasType(node.parentNode, NODE_TYPES.COMPONENT)
	)
		result.push(NODE_TYPES.COMPONENT_AUTH_ARRAY);

	//COMPONENT_CONDITION
	if (
		node.name === 'condition' &&
		nodeHasType(node.parentNode, NODE_TYPES.COMPONENT)
	) {
		result.push(NODE_TYPES.COMPONENT_CONDITION);
		result.push(NODE_TYPES.CONDITION);
	}

	//PRPS_OBJECT
	if (
		node.name === 'prps' &&
		nodeHasType(node.parentNode, NODE_TYPES.COMPONENT)
	)
		result.push(NODE_TYPES.PRPS_OBJECT);

	//WGTS_ARRAY
	if (
		(
			(
				node.name === 'wgts' &&
				nodeHasType(node.parentNode, NODE_TYPES.COMPONENT)
			) ||
			(
				node.name === 'value' &&
				nodeHasType(node.parentNode, NODE_TYPES.SCP_ACTION) &&
				node.parentNode.value.type === 'setState' &&
				node.parentNode.value.key === 'extraWgts' &&
				node.parentNode.value.valueType === 'array'
			) ||
			(
				node.name === 'popoverMda' &&
				node.valueType === 'array' &&
				nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
			)
		)
	)
		result.push(NODE_TYPES.WGTS_ARRAY);

	//COMPONENT_POPOVER_MDA
	if (
		(
			(
				node.name === 'popoverMda' ||
				node.name === 'tooltipMda'
			) &&
			node.valueType === 'object'
		)
	)
		result.push(NODE_TYPES.COMPONENT_POPOVER_MDA);

	//COMPONENT_POPOVER_MDA
	if (
		(
			node.parentNode?.name === 'popoverMda' &&
			node.parentNode?.valueType === 'array'
		)
	)
		result.push(NODE_TYPES.COMPONENT_POPOVER_MDA);
};

module.exports = setComponentType;
