//Imports
const FuzzyMatcher = require('fuzzy-matching');
const { NODE_TYPES } = require('../analyzer/config');
const { traitDefinitions } = require('../analyzer/internals');
const { nodeHasType } = require('../analyzer/helpers');

//Internals
const errorType = 'Trait Prps';

//Checks
const traitPrps = (node, errors, mdaPackage, tree) => {
	if (!nodeHasType(node, NODE_TYPES.TRAIT) || ['%', '$', '(', '{'].some(t => node.value.trait.includes(t)))
		return;

	const prps = node.obj.traitPrps ?? node.parentNode.obj.traitPrps;
	if (!prps)
		return;

	const prpsFrom = JSON.parse(JSON.stringify(prps));
	const traitDefinition = traitDefinitions.find(t => t.path === `/dashboard/${node.value.trait}.json`);
	const acceptPrps = traitDefinition.obj.acceptPrps;
	const prpsTo = JSON.parse(JSON.stringify(acceptPrps));

	Object.entries(prpsFrom).forEach(([k, v]) => {
		const fm = new FuzzyMatcher(Object.keys(prpsTo));
		const match = fm.get(k);

		if (match.distance === 1 && match.value === k) {
			const type = acceptPrps[k].type;
			const vType = typeof(v);

			if (
				!type ||
				['mixed', 'object', 'array'].includes(type) ||
				vType === type ||
				(
					type === 'integer' &&
					vType === 'number' &&
					~~v === v
				) ||
				(
					vType === 'string' &&
					(
						v.indexOf('%') === 0 ||
						v.indexOf('$') === 0 ||
						v.indexOf('((') > -1 ||
						v.indexOf('{{') > -1
					)
				)
			)
				return;

			errors.push({
				errorType,
				message: `The traitPrp "${k}" is of type ${typeof(v)}, should be "${type}"`,
				severity: 2,
				node
			});

			return;
		}

		if (match.distance > 0) {
			errors.push({
				errorType,
				message: `The traitPrp "${k}" is not allowed, did you mean "${match.value}"?`,
				severity: 2,
				node
			});

			return;
		}

		errors.push({
			errorType,
			message: `The traitPrp "${k}" is not allowed for trait "${node.value.trait}"`,
			severity: 2,
			node
		});
	});
};

module.exports = {
	check: traitPrps,
	init: () => {}
};
