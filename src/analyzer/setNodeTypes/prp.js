//Imports
const { NODE_TYPES } = require('../config');
const { nodeHasType, ancestorHasType } = require('../helpers');

//Helper
const setPrpTypes = node => {
	const result = node.types;

	//PRP
	if (
		nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
	)
		result.push(NODE_TYPES.PRP);

	//SUB_PRP
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.PRP)
	)
		result.push(NODE_TYPES.SUB_PRP);

	//FLOWS_ARRAY
	if (
		node.name === 'flows' &&
		nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
	)
		result.push(NODE_TYPES.FLOWS_ARRAY);

	//FLOW
	if (
		nodeHasType(node.parentNode, NODE_TYPES.FLOWS_ARRAY)
	)
		result.push(NODE_TYPES.FLOW);
};

module.exports = setPrpTypes;
