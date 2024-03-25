//Imports
const { NODE_TYPES } = require('../config');
const { nodeHasType, ancestorHasType, keyExistsInChildren } = require('../helpers');

//Helper
const setBaseTypes = node => {
	const result = node.types;

	//MDA_PACKAGE
	if (
		node.parentNode === undefined
	) 
		result.push(NODE_TYPES.MDA_PACKAGE);

	//STARTUP
	if (
		node.name === 'index.json' &&
		node.parentNode.name === 'dashboard'
	)
		result.push(NODE_TYPES.STARTUP);

	//STARTUP_ENTRY
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.STARTUP)
	)
		result.push(NODE_TYPES.STARTUP_ENTRY);

	//FOLDER
	if (
		keyExistsInChildren(node.obj, '.json', true)
	)
		result.push(NODE_TYPES.FOLDER);

	//FILE
	if (
		node.name.includes('.json')
	)
		result.push(NODE_TYPES.FILE);

	//THEME
	if (
		node.parentNode?.name === 'theme' &&
		nodeHasType(node.parentNode, NODE_TYPES.FOLDER)
	)
		result.push(NODE_TYPES.THEME);

	//THEME_ENTRY
	if (
		node.name !== 'themeConfig' &&
		nodeHasType(node.parentNode, NODE_TYPES.THEME)
	)
		result.push(NODE_TYPES.THEME_ENTRY);

	//THEME_SUB_ENTRY
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.THEME_ENTRY)
	)
		result.push(NODE_TYPES.THEME_SUB_ENTRY);

	//THEME_CONFIG
	if (
		node.name === 'themeConfig' &&
		nodeHasType(node.parentNode, NODE_TYPES.THEME)
	)
		result.push(NODE_TYPES.THEME_CONFIG);

	//ENSEMBLE_CONFIG
	if (
		node.name === 'config.json' &&
		node.parentNode.name[0] === '@'
	)
		result.push(NODE_TYPES.ENSEMBLE_CONFIG);

	//ENSEMBLE_CONFIG
	if (
		ancestorHasType(node.parentNode, NODE_TYPES.ENSEMBLE_CONFIG)
	)
		result.push(NODE_TYPES.ENSEMBLE_CONFIG_ENTRY);
};

module.exports = setBaseTypes;
