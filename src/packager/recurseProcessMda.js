/* eslint-disable max-lines-per-function, complexity */
const { readFile } = require('fs').promises;
const babel = require('@babel/core');

let appDir;
let fullMda;
let remappedPaths;
let promisesToAwait;

const getMappedPath = (traitPath, currentPath) => {
	if (!traitPath.startsWith('./'))
		return traitPath;

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

	return prefix + (traitPath[0] === '/' || prefix === '' ? '' : '/') + traitPath;
};

const getCurrentPath = fullPath => {
	const start = 11;
	const jsonIndex = fullPath.indexOf('.json', start);
	const lastSlashBeforeJson = fullPath.lastIndexOf('/', jsonIndex);

	return fullPath.slice(start, lastSlashBeforeJson);
};

const init = ({ fullMda: _fullMda, remappedPaths: _remappedPaths, appDir: _appDir }) => {
	appDir = _appDir;
	fullMda = _fullMda;
	remappedPaths = _remappedPaths;

	promisesToAwait = [];
};

const recurseProcessMda = (mda, parentMda, fullPath = '') => {
	let currentPath;

	if (mda.inlineKeys !== undefined) {
		mda.inlineKeys.forEach(k => {
			mda[k] = mda[k].join(' ');
		});

		delete mda.inlineKeys;
	}

	if (mda.srcActions !== undefined) {
		if (!currentPath)
			currentPath = getCurrentPath(fullPath);

		let newPath = getMappedPath(mda.srcActions, currentPath);
		if (newPath[0] === '/')
			newPath = newPath.substr(1);

		const splitAccessor = newPath.split('/');
		const fileName = splitAccessor.pop() + '.js';
		
		const parentOfFile = splitAccessor.reduce((p, n) => {
			if (!p[n])
				p[n] = {};

			return p[n];
		}, fullMda.dashboard);

		const remappedEntry = remappedPaths.find(f => `dashboard\\${splitAccessor.join('\\')}` === f.remappedPath);
		let importPath;
		if (remappedEntry)
			importPath = `${remappedEntry?.path ?? newPath}/${fileName}`;
		else
			importPath = `${appDir}/dashboard/${newPath}.js`;

		if (!parentOfFile[fileName]) {
			promisesToAwait.push((async () => {
				const fileString = (await readFile(importPath, 'utf-8'));

				parentOfFile[fileName] = fileString;
			})());
		}

		mda.srcActions = {
			path: newPath
		};
	}

	if (mda.src !== undefined && mda.prps !== undefined) {
		if (!currentPath)
			currentPath = getCurrentPath(fullPath);

		const newPath = getMappedPath(mda.src, currentPath);

		const splitAccessor = newPath.split('/');
		const fileName = splitAccessor.pop() + '.jsx';

		const parentOfFile = splitAccessor.reduce((p, n) => {
			if (!n)
				return p;

			if (!p[n])
				p[n] = {};

			return p[n];
		}, fullMda.dashboard);

		const remappedEntry = remappedPaths.find(f => `dashboard\\${splitAccessor.join('\\')}` === f.remappedPath);
		let importPath;
		if (remappedEntry)
			importPath = `${remappedEntry.path}/${fileName}`;
		else
			importPath = `${appDir}/dashboard/${newPath}.jsx`; 

		if (!parentOfFile[fileName]) {
			promisesToAwait.push((async () => {
				const fileString = (await readFile(importPath, 'utf-8'));

				const { code } = babel.transformSync(fileString, {
					presets: ['@babel/preset-react'],
					sourceType: 'module'
				});

				parentOfFile[fileName] = code;
			})());
		}

		mda.src = {
			path: newPath,
			loadFromMda: true
		};
	}

	Object.entries(mda).forEach(([k, v]) => {
		if (v !== null && typeof(v) === 'object')
			recurseProcessMda(v, mda, fullPath + '/' + k);
	});

	if (!parentMda || (!parentMda.acceptPrps && !parentMda.traitPrps)) {
		const { traits, trait } = mda;

		if (traits && typeof(traits) !== 'string' && traits.map !== undefined) {
			if (!currentPath)
				currentPath = getCurrentPath(fullPath);

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

			mda.trait = getMappedPath(trait, pathArray.join('/'));
		}
	}
};

const waitForCompletion = async () => {
	await Promise.all(promisesToAwait);
};

module.exports = {
	init,
	run: recurseProcessMda,
	waitForCompletion
};
