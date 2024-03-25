//External Imports
/* eslint-disable-next-line no-unused-vars */
const colors = require('colors');
const { readFile } = require('fs').promises;

//Imports
const buildTree = require('./analyzer/buildTree');
const setNodeTypes = require('./analyzer/setNodeTypes');
const logErrors = require('./analyzer/logErrors');

//Checks
const { check: checkFlows } = require('./checks/flows');
const { check: checkUntyped } = require('./checks/untyped');
const { check: checkTraitPrps } = require('./checks/traitPrps');
const { check: checkUnusedTrait } = require('./checks/unusedTrait');
const { check: checkScripts, init: initScripts } = require('./checks/scripts');
const { check: checkComponentTypes } = require('./checks/componentTypes');
const { check: checkComponentKeywords } = require('./checks/componentKeywords');
const { check: checkComponentProperties, init: initComponentProperties } = require('./checks/componentProperties');

const checks = [
	checkFlows,
	checkScripts,
	checkUntyped,
	checkTraitPrps,
	checkUnusedTrait,
	checkComponentTypes,
	checkComponentKeywords,
	checkComponentProperties
];

//Helpers
const recursivelyFindBugs = (node, tree, mdaPackage, errors = []) => {
	checks.forEach(c => {
		c(node, errors, mdaPackage, tree);
	});

	node.children.forEach(c => recursivelyFindBugs(c, tree, mdaPackage, errors));

	return errors;
};

//Analyzer
(async () => {
	const cwd = process.argv[2] ?? process.cwd();
	process.chdir(cwd);

	initScripts();
	initComponentProperties();

	const mdaPackage = JSON.parse(await readFile('./packaged/mdaPackage.json', 'utf-8'));

	console.log('\r\nRunning JSON Analyzer\r\n'.brightCyan.bold);
	
	const tree = buildTree('package', mdaPackage);
	setNodeTypes(tree);

	console.log();

	const errors = recursivelyFindBugs(tree, tree, mdaPackage);
	logErrors(errors);
})();
