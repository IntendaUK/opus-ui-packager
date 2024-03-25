//Imports
const { NODE_TYPES } = require('../config');
const { implementedTraitPaths } = require('../internals');
const { nodeHasType, ancestorHasType } = require('../helpers');

//Helper
const setTraitTypes = node => {
	const result = node.types;

	//TRAITS_ARRAY
	if (
		(
			node.name === 'traits' &&
			nodeHasType(node.parentNode, NODE_TYPES.COMPONENT)
		) ||
		(
			node.name === 'traitsTreeNode' &&
			nodeHasType(node.parentNode, NODE_TYPES.PRPS_OBJECT)
		)
	) {
		result.push(NODE_TYPES.TRAITS_ARRAY);

		Object.values(node.value).forEach(v => {
			implementedTraitPaths.push({
				node,
				traitPath: v + '.json'
			});
		});
	}

	//TRAIT
	if (
		nodeHasType(node.parentNode, NODE_TYPES.TRAITS_ARRAY)
	) {
		result.push(NODE_TYPES.TRAIT);

		const traitPath = node.obj.trait ?? node.obj;
		implementedTraitPaths.push({
			node,
			traitPath: traitPath + '.json'
		});
	}

	//TRAIT_PRPS
	if (
		node.name === 'traitPrps' &&
		(
			nodeHasType(node.parentNode, NODE_TYPES.TRAIT) ||
			nodeHasType(node.parentNode, NODE_TYPES.COMPONENT)
		)
	) 
		result.push(NODE_TYPES.TRAIT_PRPS);

	//TRAIT_PRP
	if (
		nodeHasType(node.parentNode, NODE_TYPES.TRAIT_PRPS)
	) 
		result.push(NODE_TYPES.TRAIT_PRP);

	//TRAIT_SUB_PRP
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.TRAIT_PRP)
	) 
		result.push(NODE_TYPES.TRAIT_SUB_PRP);

	//TRAIT_CONDITION
	if (
		node.name === 'condition' &&
		nodeHasType(node.parentNode, NODE_TYPES.TRAIT)
	) {
		result.push(NODE_TYPES.TRAIT_CONDITION);
		result.push(NODE_TYPES.CONDITION);
	}

	//TRAIT_ACCEPT_PRPS
	if (
		node.name === 'acceptPrps' &&
		nodeHasType(node.parentNode, NODE_TYPES.TRAIT_DEFINITION)
	)
		result.push(NODE_TYPES.TRAIT_ACCEPT_PRPS);

	//TRAIT_CONFIG
	if (
		node.name === 'traitConfig' &&
		nodeHasType(node.parentNode, NODE_TYPES.TRAIT_DEFINITION)
	)
		result.push(NODE_TYPES.TRAIT_ACCEPT_PRPS);

	//TRAIT_ACCEPT_PRP
	if (
		nodeHasType(node.parentNode, NODE_TYPES.TRAIT_ACCEPT_PRPS)
	)
		result.push(NODE_TYPES.TRAIT_ACCEPT_PRP);

	//TRAIT_ACCEPT_SUB_PRP
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.TRAIT_ACCEPT_PRP)
	)
		result.push(NODE_TYPES.TRAIT_ACCEPT_SUB_PRP);
};

module.exports = setTraitTypes;
