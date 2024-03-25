const fixRelativePaths = (mda, parentMda, fullPath = '') => {
	if (
		(
			(
				mda.traits &&
				mda.traits[0] !== '$' &&
				mda.traits[0] !== '%'
			) ||
			(
				mda.trait &&
				typeof(mda.trait) === 'string' &&
				mda.trait.indexOf('./') === 0 &&
				mda.trait[0] !== '$' &&
				mda.trait[0] !== '%'
			)
		) &&
		!parentMda?.acceptPrps &&
		!parentMda?.traitPrps
	) {
		const pathArray = fullPath
			.substring(11, fullPath.lastIndexOf('.json') + 5)
			.split('/');

		pathArray.pop();

		const currentPath = pathArray.join('/');

		const getMappedPath = traitPath => {
			const newPathArray = currentPath.split('/');
			const levelsUp = traitPath.split('../').length - 1;
			newPathArray.splice(newPathArray.length - levelsUp, levelsUp);
			const appendPath = traitPath.substr(traitPath.lastIndexOf('../') + 2);
			const newPath = newPathArray.join('/') + appendPath;

			return newPath;
		};

		if (Array.isArray(mda.traits)) {
			mda.traits = mda.traits.map(t => {
				const path = t.trait ?? t;
				if (!path || typeof(path) === 'object')
					return t;

				if (path.indexOf('./') !== 0)
					return t;

				const newPath = getMappedPath(path);

				if (typeof(t) === 'object') {
					t.trait = newPath;

					return t;
				}

				return newPath;
			});
		} else if (mda.trait)
			mda.trait = getMappedPath(mda.trait);
	}

	Object.entries(mda).forEach(([k, v]) => {
		if (v !== null && typeof(v) === 'object')
			fixRelativePaths(v, mda, fullPath + '/' + k);
	});
};

module.exports = fixRelativePaths;
