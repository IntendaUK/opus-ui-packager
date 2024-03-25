//Imports
const { NODE_TYPES } = require('../config');
const { nodeHasType, ancestorHasType } = require('../helpers');

//Helper
const setConditionTypes = node => {
	const result = node.types;

	//CONDITION
	if (
		node.valueType === 'object' &&
		nodeHasType(node.parentNode, NODE_TYPES.CONDITION_ARRAY)
	)
		result.push(NODE_TYPES.CONDITION);

	//CONDITION_ARRAY
	if (
		node.valueType === 'array' &&
		(
			node.name === 'comparisons' ||
			node.name === 'match'
		)
	)
		result.push(NODE_TYPES.CONDITION_ARRAY);

	//CONDITION_SUB_ENTRY
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.CONDITION)
	)
		result.push(NODE_TYPES.CONDITION_SUB_ENTRY);
};

module.exports = setConditionTypes;
