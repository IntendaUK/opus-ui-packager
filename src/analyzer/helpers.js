//Imports
const { implementedTraitPaths } = require('./internals');

//Helpers
const getNodeFile = node => {
	let path = '';
	let jsonFound = false;

	while (node && node.name !== 'dashboard') {
		if (node.name.includes('.json'))
			jsonFound = true;

		if (jsonFound)
			path = node.name + (path ? '/' + path : '');

		node = node.parentNode;
	}

	if (path[0] === '@')
		path = path.substr(1);

	return path;
};

const nodeHasType = (node, checkType) => {
	if (!node)
		return false;

	return node.types?.includes(checkType);
};

const ancestorHasType = (node, checkType) => {
	if (!node)
		return false;
	else if (nodeHasType(node, checkType))
		return true;

	return ancestorHasType(node.parentNode, checkType);
};

const ancestorHasComponentType = (node, componentType) => {
	if (!node)
		return false;
	else if (node.value.type === componentType)
		return true;

	return ancestorHasComponentType(node.parentNode, componentType);
};

const keyExistsInChildren = (obj, key, allowPartial = false) => {
	let found = Object.keys(obj).some(k => {
		if (allowPartial && k.includes(key))
			return true;

		return k === key;
	});

	if (found)
		return true;

	found = Object.values(obj).some(v => {
		if (v === null || typeof(v) !== 'object')
			return false;

		if (keyExistsInChildren(v, key, allowPartial))
			return true;

		return false;
	});

	return found;
};

const countProperties = (obj, propertyList) => {
	const result = propertyList.filter(p => obj.hasOwnProperty(p)).length;

	return result;
};

const getNodeFilePath = node => {
	return node.path.substring(11, node.path.indexOf('.json') + 5);
};

const componentTraitPointsToNode = node => {
	const nodePath = getNodeFilePath(node);

	return implementedTraitPaths.some(n => n.traitPath === nodePath);
};

module.exports = {
	getNodeFile,
	nodeHasType,
	getNodeFilePath,
	countProperties,
	ancestorHasType,
	ancestorHasComponentType,
	keyExistsInChildren,
	componentTraitPointsToNode
};
