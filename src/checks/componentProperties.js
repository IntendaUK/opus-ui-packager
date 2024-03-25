//Imports
const FuzzyMatcher = require('fuzzy-matching');
const { readFileSync } = require('fs');
const { NODE_TYPES } = require('../analyzer/config');
const { nodeHasType } = require('../analyzer/helpers');

//Internals
const errorType = 'Component Property';
const propSpecs = {};

//Helpers
const inheritProps = (base, ...inherit) => {
	inherit.forEach(i => {
		const cloned = JSON.parse(JSON.stringify(i));

		Object.assign(base, cloned);
	});
};

const buildPropSpec = (componentType, path) => {
	const fileContents = readFileSync(path, 'utf-8');
	let propSpec = Object.fromEntries(
		(fileContents.match(/\t(.*?): {/g) ?? [])
			.map(m => {
				return [
					m.replace('\t', '').replace(': {', ''),
					{}
				];
			})
	);

	if (componentType !== 'base')
		inheritProps(propSpec, propSpecs.base);

	propSpecs[componentType] = propSpec;

	return propSpec;
};

const getPropSpec = componentType => {
	if (propSpecs[componentType])
		return propSpecs[componentType];

	const propSpec = buildPropSpec(componentType, `../../code/devx/src/components/${componentType}/props.js`);

	return propSpec;
};

//Checks
const componentProperties = (node, errors, mdaPackage) => {
	if (!nodeHasType(node, NODE_TYPES.PRPS_OBJECT) || !node.parentNode.value.type)
		return;

	const propSpec = getPropSpec(node.parentNode.value.type);
	if (!propSpec)
		return;

	const fm = new FuzzyMatcher(Object.keys(propSpec));

	const keys = Object.keys(node.value);
	node.children.forEach(c => keys.push(c.name));

	keys.forEach(k => {
		const match = fm.get(k);
		if (match.distance === 1 || match.distance < 0.75)
			return;

		errors.push({
			errorType,
			message: `Unexpected property found "${k}", did you mean "${match.value}"?`,
			severity: 2,
			node
		});
	});
};

const init = () => {
	//Base props
	buildPropSpec('base', '../../code/devx/src/components/baseProps.js');

	//Container props
	buildPropSpec('containerShared', '../../code/devx/src/components/container/propsShared.js');
	
	buildPropSpec('container', '../../code/devx/src/components/container/props.js');
	inheritProps(propSpecs.container, propSpecs.containerShared);
	
	buildPropSpec('containerSimple', '../../code/devx/src/components/containerSimple/props.js');
	inheritProps(propSpecs.containerSimple, propSpecs.containerShared);

	//DataLoader props
	buildPropSpec('dataLoaderShared', '../../code/devx/src/components/dataLoader/propsShared.js');
	
	buildPropSpec('dataLoader', '../../code/devx/src/components/dataLoader/props.js');
	inheritProps(propSpecs.dataLoader, propSpecs.dataLoaderShared);

	buildPropSpec('grid', '../../code/devx/src/components/grid/props.js');
	inheritProps(propSpecs.grid, propSpecs.dataLoaderShared);

	buildPropSpec('repeater', '../../code/devx/src/components/repeater/props.js');
	inheritProps(propSpecs.repeater, propSpecs.dataLoaderShared);

	buildPropSpec('treeview', '../../code/devx/src/components/treeview/props.js');
	inheritProps(propSpecs.treeview, propSpecs.dataLoaderShared);
};

module.exports = {
	check: componentProperties,
	init
};
