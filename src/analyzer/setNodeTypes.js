//Imports
const { NODE_TYPES, SYSTEM_TRAITS } = require('./config');
const { implementedTraitPaths, stringsWithSlashes } = require('./internals');
const {
	nodeHasType, ancestorHasType, componentTraitPointsToNode, getNodeFilePath
} = require('./helpers');

//Builders
const buildBase = require('./setNodeTypes/base');
const buildComponent = require('./setNodeTypes/component');
const buildTD = require('./setNodeTypes/traitOrDashboard');
const buildTrait = require('./setNodeTypes/trait');
const buildPrp = require('./setNodeTypes/prp');
const buildScp = require('./setNodeTypes/scp');
const buildCondition = require('./setNodeTypes/condition');
const buildOther = require('./setNodeTypes/other');

//Internals
let untypedNodeCount = 0;
let warnedNodeCount = 0;

//Helpers
const getNodeTypes = node => {
	const result = node.types;

	if (SYSTEM_TRAITS.some(s => node.path === `/dashboard/${s}.json`)) {
		result.push(NODE_TYPES.TRAIT_DEFINITION);
		result.push(NODE_TYPES.COMPONENT);

		implementedTraitPaths.push({
			node,
			traitPath: getNodeFilePath(node)
		});
	}

	buildBase(node);
	buildComponent(node);
	buildTD(node);
	buildTrait(node);
	buildPrp(node);
	buildScp(node);
	buildCondition(node);
	buildOther(node);

	//TRAIT_UNUSED
	if (
		node.name.includes('.json') &&
		nodeHasType(node.parentNode, NODE_TYPES.FOLDER) &&
		!nodeHasType(node, NODE_TYPES.DASHBOARD) &&
		!nodeHasType(node, NODE_TYPES.TRAIT_DEFINITION) &&
		!nodeHasType(node, NODE_TYPES.DASHBOARD_OR_TRAIT_DEFINITION) &&
		!componentTraitPointsToNode(node) &&
		!stringsWithSlashes.some(s => node.path === `/dashboard/${s}.json`) &&
		!nodeHasType(node, NODE_TYPES.THEME)
	) 
		result.push(NODE_TYPES.TRAIT_UNUSED);

	//TRAIT_UNUSED_SUB_ENTRY
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.TRAIT_UNUSED)
	)
		result.push(NODE_TYPES.TRAIT_UNUSED_SUB_ENTRY);

	if (
		nodeHasType(node, NODE_TYPES.TRAIT_UNUSED) &&
		!nodeHasType(node, NODE_TYPES.TRAIT_DEFINITION)
	)
		warnedNodeCount++;
};

const registerStringsWithSlashes = (node, includeChildren) => {
	Object.values(node.value).forEach(v => {
		if (typeof(v) !== 'string' || !v.includes('/') || v.includes(' '))
			return;

		stringsWithSlashes.push(v);
	});

	if (!includeChildren)
		return;

	node.children.forEach(c => registerStringsWithSlashes(c, true));
};

const recursivelyTypeNodes = node => {
	registerStringsWithSlashes(node, false);

	node.types = [];
	getNodeTypes(node);

	if (node.types.length === 0) {
		untypedNodeCount++;

		registerStringsWithSlashes(node, true);

		return;
	}

	node.children.forEach(c => recursivelyTypeNodes(c));
};

const setNodeTypes = node => {
	let iterations = 0;

	let warnedBefore;
	let untypedBefore;

	do {
		warnedBefore = warnedNodeCount;
		untypedBefore = untypedNodeCount;

		warnedNodeCount = 0;
		untypedNodeCount = 0;

		console.log('Running iteration:', (++iterations + '').magenta);

		recursivelyTypeNodes(node);
	} while (untypedBefore !== untypedNodeCount || warnedBefore !== warnedNodeCount);
};

module.exports = setNodeTypes;
