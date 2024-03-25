//Imports
const { NODE_TYPES } = require('../config');
const { ancestorHasType } = require('../helpers');

//Helper
const setPrpTypes = node => {
	const result = node.types;

	//COMMENTS
	if (
		node.name === 'comments'
	)
		result.push(NODE_TYPES.COMMENTS);

	//COMMENT
	if (
		node.name === 'comment' ||
			ancestorHasType(node.parentNode, NODE_TYPES.COMMENTS)
	)
		result.push(NODE_TYPES.COMMENT);
};

module.exports = setPrpTypes;
