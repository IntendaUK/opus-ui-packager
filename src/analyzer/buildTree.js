const buildTree = (nodeName, obj, parentNode, fullPath = '') => {
	if (nodeName[0] === '^')
		nodeName = nodeName.substr(1);

	let valueType = typeof(obj);
	if (valueType === 'object') {
		if (obj === null)
			valueType = 'null';
		else if (Array.isArray(obj)) 
			valueType = 'array';
	}

	const node = {
		parentNode,
		children: [],
		name: nodeName,
		path: fullPath,
		value: {},
		valueType,
		obj
	};

	Object.entries(obj).forEach(([k, v]) => {
		const type = typeof(v);
		if (v === null)
			return;

		if (type === 'object') {
			node.children.push(buildTree(k, v, node, fullPath + '/' + k));

			return;
		}

		node.value[k] = v;
	});

	return node;
};

//Exports
module.exports = buildTree;
