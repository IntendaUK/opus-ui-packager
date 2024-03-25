const applyInlineKeys = (mda, parentMda, fullPath = '') => {
	if (mda.inlineKeys !== undefined) {
		mda.inlineKeys.forEach(k => {
			mda[k] = mda[k].join(' ');
		});

		delete mda.inlineKeys;
	}

	Object.entries(mda).forEach(([k, v]) => {
		if (v === null || typeof(v) !== 'object')
			return;

		applyInlineKeys(v, mda, fullPath + '/' + k);
	});
};

module.exports = applyInlineKeys;
