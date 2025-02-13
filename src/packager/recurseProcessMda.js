/* eslint-disable max-lines-per-function, complexity */

const getMappedPath = (traitPath, currentPath) => {
	traitPath = traitPath.slice(2);

	let levelsUp = 0;
	while (traitPath.startsWith('../')) {
		levelsUp++;
		traitPath = traitPath.slice(3);
	}

	const segments = currentPath.split('/');

	if (levelsUp > segments.length)
		levelsUp = segments.length;

	segments.length -= levelsUp;

	const prefix = segments.join('/');

	return prefix + (traitPath[0] === '/' ? '' : '/') + traitPath;
};

const getCurrentPath = fullPath => {
	const start = 11;
	const jsonIndex = fullPath.indexOf('.json', start);
	const lastSlashBeforeJson = fullPath.lastIndexOf('/', jsonIndex);

	return fullPath.slice(start, lastSlashBeforeJson);
};

const recurseProcessMda = (mda, parentMda, fullPath = '') => {
	if (mda.inlineKeys !== undefined) {
		mda.inlineKeys.forEach(k => {
			mda[k] = mda[k].join(' ');
		});

		delete mda.inlineKeys;
	}

	Object.entries(mda).forEach(([k, v]) => {
		if (v !== null && typeof(v) === 'object')
			recurseProcessMda(v, mda, fullPath + '/' + k);
	});

	if (!parentMda || (!parentMda.acceptPrps && !parentMda.traitPrps)) {
		const { traits, trait } = mda;

		if (traits && typeof(traits) !== 'string' && traits.map !== undefined) {
			const currentPath = getCurrentPath(fullPath);

			const len = traits.length;
			for (let i = 0; i < len; i++) {
				const t = traits[i];

				if (typeof(t) === 'string' && t.indexOf('./') === 0) {
					traits[i] = getMappedPath(t, currentPath);

					continue;
				} else if (typeof(t.path) !== 'string')
					continue;

				const newPath = getMappedPath(t.path, currentPath);

				t.path = newPath;
			}
		} else if (trait && trait.indexOf('./') === 0) {
			const pathArray = fullPath
				.substring(11, fullPath.lastIndexOf('.json') + 5)
				.split('/');

			pathArray.pop();

			const currentPath = pathArray.join('/');

			mda.trait = getMappedPath(trait, currentPath);
		}
	}
};

module.exports = recurseProcessMda;
