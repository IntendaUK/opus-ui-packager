//Imports
const { NODE_TYPES } = require('../config');
const { nodeHasType, ancestorHasType } = require('../helpers');

//Helper
const setScpTypes = node => {
	const result = node.types;

	//SCPS_ARRAY
	if (
		node.name === 'scps' &&
		nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
	)
		result.push(NODE_TYPES.SCPS_ARRAY);

	//SCP
	if (
		nodeHasType(node.parentNode, NODE_TYPES.SCPS_ARRAY) ||
		(
			node.name === 'fireScript' &&
			nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
		) ||
		(
			node.name === 'dtaScps' &&
			node.valueType === 'object'
		) ||
		(
			node.parentNode?.name === 'dtaScps' &&
			node.valueType === 'object'
		)
	)
		result.push(NODE_TYPES.SCP);

	//SCP_TRIGGERS_ARRAY
	if (
		node.name === 'triggers' &&
		nodeHasType(node.parentNode, NODE_TYPES.SCP)
	)
		result.push(NODE_TYPES.SCP_TRIGGERS_ARRAY);

	//SCP_TRIGGER
	if (
		nodeHasType(node.parentNode, NODE_TYPES.SCP_TRIGGERS_ARRAY)
	)
		result.push(NODE_TYPES.SCP_TRIGGER);

	//SCP_TRIGGER_MATCH
	if (
		node.name === 'match' &&
		nodeHasType(node.parentNode, NODE_TYPES.SCP_TRIGGER)
	)
		result.push(NODE_TYPES.SCP_TRIGGER_MATCH);

	//SCP_ACTIONS_ARRAY
	if (
		(
			node.name === 'actions' &&
			nodeHasType(node.parentNode, NODE_TYPES.SCP)
		) ||
		(
			node.name === 'traitArray' &&
			nodeHasType(node.parentNode, NODE_TYPES.TRAIT_DEFINITION)
		) ||
		(
			node.parentNode?.name === 'branch' &&
			nodeHasType(node.parentNode.parentNode, NODE_TYPES.SCP_ACTION)
		)
	) 
		result.push(NODE_TYPES.SCP_ACTIONS_ARRAY);

	//SCP_ACTION
	if (
		nodeHasType(node.parentNode, NODE_TYPES.SCP_ACTIONS_ARRAY)
	)
		result.push(NODE_TYPES.SCP_ACTION);

	//SCP_ACTION_ENTRY
	if (
		nodeHasType(node.parentNode, NODE_TYPES.SCP_ACTION)
	)
		result.push(NODE_TYPES.SCP_ACTION_ENTRY);

	//SCP_ACTION_SUB_ENTRY
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.SCP_ACTION_ENTRY)
	)
		result.push(NODE_TYPES.SCP_ACTION_SUB_ENTRY);
};

module.exports = setScpTypes;
