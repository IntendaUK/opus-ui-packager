//External Imports
const FuzzyMatcher = require('fuzzy-matching');
const { readFileSync } = require('fs');

//Imports
const { NODE_TYPES } = require('../analyzer/config');
const { nodeHasType } = require('../analyzer/helpers');

//Internals
const errorType = 'Script';
const fmScript = new FuzzyMatcher(['id', 'actions', 'triggers', 'concurrency', 'comment', 'comments']);
const keywordsAction = ['type', 'actionCondition', 'comment', 'comments'];
const keysAction = [
	{
		key: 'type',
		type: 'string'
	},
	{
		key: 'actionCondition',
		type: 'object'
	},
	{
		key: 'comment',
		type: 'string'
	},
	{
		key: 'comments',
		type: 'array'
	}
];
const fmActions = {};
let configActions;
let configTriggers;

//Checks
const checkScript = (node, errors) => {
	if (!nodeHasType(node, NODE_TYPES.SCP))
		return;

	Object.keys(node.obj).forEach(k => {
		const match = fmScript.get(k);
		if (match.distance === 1)
			return;

		if (match.distance > 0) {
			errors.push({
				errorType,
				message: `Keyword "${k} not expected in script, did you mean "${match.value}"?`,
				severity: 2,
				node
			});

			return;
		}

		errors.push({
			errorType,
			message: `Keyword "${k} not expected in script.`,
			severity: 2,
			node
		});
	});
	
	const actions = node.obj.actions;
	actions.forEach(a => {
		const type = a.type;
		const actionConfig = configActions.find(c => c.type === type);

		if (a.traits)
			return;

		if (['log'].includes(type)) {
			errors.push({
				errorType,
				message: `The "${type}" action" should only be used for debugging purposes`,
				severity: 1,
				node
			});
		}

		const fmAction = fmActions[type];
		if (!fmAction) {
			console.log(`Unimplemented action config for ${type}`);

			return;
		}

		Object.entries(a).forEach(([k, v]) => {
			const key = k.includes('^') ? k.substr(1) : k;

			const keyConfig = actionConfig.keys.find(f => f.key === key);

			const match = fmAction.get(key);

			if (match.distance === 1) {
				const vType = typeof(v);

				const typeMatches = (
					(
						vType === keyConfig.type &&
						(
							keyConfig.type !== 'object' ||
							v !== null
						)
					) ||
					keyConfig.type === 'mixed' ||
					(
						keyConfig.type === 'stringOrObject' &&
						(
							vType === 'string' ||
							vType === 'object'
						)
					) ||
					(
						keyConfig.type === 'array' &&
						Array.isArray(v)
					) ||
					(
						(
							keyConfig.type === 'object' ||
							keyConfig.type === 'array' ||
							keyConfig.type === 'integer'
						) &&
						vType === 'string' &&
						v.includes('{{') ||
						(
							v[0] === '$' &&
							v[v.length - 1] === '$'
						)
					) ||
					(
						keyConfig.type === 'integer' &&
						vType === 'number' &&
						~~v === v
					)
				);

				if (!typeMatches) {
					errors.push({
						errorType,
						message: `Property "${key} is of type "${vType}", expected "${keyConfig.type}"`,
						severity: 2,
						node
					});
				}

				return;
			}

			if (match.distance > 0.6) {
				errors.push({
					errorType,
					message: `Keyword "${key} not expected in script action type "${type}", did you mean "${match.value}"?`,
					severity: 2,
					node
				});

				return;
			}

			errors.push({
				errorType,
				message: `Keyword "${key} not expected in script action type "${type}"`,
				severity: 2,
				node
			});
		});
	});
};

const init = () => {
	/* eslint-disable-next-line no-eval */
	configActions = eval(readFileSync('../../code/devx/src/components/scriptRunner/config/configActions.js', 'utf-8')
		.replace('/* eslint-disable max-lines */', '')
		.replace('const actions = ', '')
		.replace('export default actions;', '')
		.replace(';', ''));

	configActions.forEach(a => {
		const fm = new FuzzyMatcher([...keywordsAction, ...a.keys.map(({ key }) => key)]);

		fmActions[a.type] = fm;

		a.keys = [...a.keys, ...keysAction];
	});

	/* eslint-disable-next-line no-eval */
	configTriggers = eval(readFileSync('../../code/devx/src/components/scriptRunner/config/configTriggers.js', 'utf-8')
		.replace('const triggers = ', '')
		.replace('export default triggers;', '')
		.replace(';', ''));
};

module.exports = {
	check: checkScript,
	init
};
