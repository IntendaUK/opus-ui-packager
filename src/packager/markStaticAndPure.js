/*
	Marks components with `static` / `pure` hints that the Opus UI wrapper uses to take a
	cheaper render path.

	A component is STATIC when nothing about it requires the dynamic wrapper machinery, and
	PURE when its whole subtree is static (so it can be rendered once and frozen).

	The blockers fall into groups:
	  - behavioural (truly reactive): flows, scripts, dynamic prop accessors, condition, dynamic
	  - template (need build-time expansion before we know the result): trait/traits/blueprint/acceptPrps
	  - context (rendered in a dynamic position): src, index, container
	  - addressing (id/scope/relId/tags): these ONLY matter if something elsewhere references
	    them. The wrapper's pure path keeps all scope/flow/state registration and still
	    re-renders on flow-driven state changes, so an UNREFERENCED addressing key is safe to
	    promote. We therefore relax these via a whole-app reference scan.

	Conservative throughout: a missed promotion only forgoes an optimisation, a wrong one could
	change behaviour, so anything uncertain stays non-static.
*/

const behaviouralBlockingKeys = ['condition', 'dynamic'];
const templateBlockingKeys = ['trait', 'traits', 'blueprint', 'blueprintPrps', 'acceptPrps'];
const contextBlockingKeys = ['src', 'index', 'container'];

const dynamicAccessorTokens = ['morph.', 'state.', 'variable.', 'scopedVariable.', 'eval.', 'fn.'];

const stringHasDynamicAccessor = s => {
	if (s.indexOf('{{') === -1 && s.indexOf('((') === -1)
		return false;

	return dynamicAccessorTokens.some(t => s.includes('{{' + t) || s.includes('((' + t));
};

const hasDynamicAccessors = value => {
	if (typeof(value) === 'string')
		return stringHasDynamicAccessor(value);

	if (!value || typeof(value) !== 'object')
		return false;

	if (Array.isArray(value))
		return value.some(hasDynamicAccessors);

	return Object.values(value).some(hasDynamicAccessors);
};

const componentHasScriptsOrFlows = prps => {
	if (!prps || typeof(prps) !== 'object')
		return false;

	return (
		prps.flows !== undefined ||
		prps.scps !== undefined ||
		prps.dtaScps !== undefined ||
		prps.fireScript !== undefined
	);
};

const isComponent = mda => (
	typeof(mda.type) === 'string' &&
	(mda.prps !== undefined || mda.wgts !== undefined)
);

// ---------------------------------------------------------------------------
// Phase 1: collect every id / scope / relId / tag referenced anywhere in the app.
// ---------------------------------------------------------------------------

//Keys whose string value is a literal id reference (flow/trigger source/target, portal target).
const idReferenceKeys = new Set(['from', 'to', 'container']);
//Keys whose value references a tag.
const tagReferenceKeys = new Set(['fromTag', 'toTag']);

const scopedIdRegex = /\|\|([^|]+)\|\|/g;
//Matches {{state.ID , {{sA.state.ID , ((state.ID  (ID stops at . } ) or |)
const stateAccessorRegex = /(?:\{\{|\(\()(?:sA\.)?state\.([^.}|)]+)/g;

const collectFromString = (s, refs) => {
	if (s.indexOf('||') !== -1) {
		scopedIdRegex.lastIndex = 0;
		let m;
		while ((m = scopedIdRegex.exec(s)) !== null) {
			let parts = m[1].split('.');
			if (parts[0] === 'local')
				parts = parts.slice(1);

			if (parts[0])
				refs.scopes.add(parts[0]);
			if (parts[1])
				refs.relIds.add(parts[1]);
		}
	}

	if (s.indexOf('state.') !== -1) {
		stateAccessorRegex.lastIndex = 0;
		let m;
		while ((m = stateAccessorRegex.exec(s)) !== null) {
			const id = m[1];
			if (id && id.indexOf('|') === -1)
				refs.ids.add(id);
		}
	}

	if (s.indexOf('{{eval.') !== -1 || s.indexOf('((eval.') !== -1)
		refs.hasEval = true;
};

const collectReferences = root => {
	const refs = {
		ids: new Set(),
		relIds: new Set(),
		scopes: new Set(),
		tags: new Set(),
		hasEval: false,
		hasLateBound: false
	};

	const walk = value => {
		if (typeof(value) === 'string') {
			collectFromString(value, refs);

			return;
		}

		if (!value || typeof(value) !== 'object')
			return;

		if (Array.isArray(value)) {
			value.forEach(walk);

			return;
		}

		Object.entries(value).forEach(([k, v]) => {
			if (k === 'lateBound' && v === true)
				refs.hasLateBound = true;

			if (idReferenceKeys.has(k) && typeof(v) === 'string')
				refs.ids.add(v);

			if (tagReferenceKeys.has(k)) {
				if (typeof(v) === 'string')
					refs.tags.add(v);
				else if (Array.isArray(v))
					v.forEach(t => typeof(t) === 'string' && refs.tags.add(t));
			}

			walk(v);
		});
	};

	walk(root);

	return refs;
};

// ---------------------------------------------------------------------------
// Phase 2: mark static / pure (bottom-up so `pure` can roll up from children).
// ---------------------------------------------------------------------------

const isAddressingReferenced = (mda, refs) => {
	if (mda.id !== undefined && refs.ids.has(mda.id))
		return true;

	//A relId/scope is rebound at runtime when lateBound triggers exist, so treat them as
	// referenced in that case.
	if (mda.relId !== undefined && (refs.hasLateBound || refs.relIds.has(mda.relId)))
		return true;

	if (mda.scope !== undefined) {
		const scopes = Array.isArray(mda.scope) ? mda.scope : [mda.scope];
		if (refs.hasLateBound || scopes.some(s => refs.scopes.has(s)))
			return true;
	}

	const tags = mda.prps && mda.prps.tags;
	if (Array.isArray(tags) && tags.some(t => refs.tags.has(t)))
		return true;

	return false;
};

const markNode = (mda, refs, counts) => {
	if (!isComponent(mda))
		return;

	const blocked = (
		behaviouralBlockingKeys.some(k => mda[k] !== undefined) ||
		templateBlockingKeys.some(k => mda[k] !== undefined) ||
		contextBlockingKeys.some(k => mda[k] !== undefined) ||
		componentHasScriptsOrFlows(mda.prps) ||
		hasDynamicAccessors(mda.prps) ||
		isAddressingReferenced(mda, refs)
	);

	if (blocked)
		return;

	mda.static = true;
	counts.static++;

	if (mda.id !== undefined || mda.scope !== undefined || mda.relId !== undefined)
		counts.promoted++;

	if (Array.isArray(mda.wgts)) {
		const allChildrenPure = mda.wgts.every(w => w && typeof(w) === 'object' && w.pure === true);
		if (!allChildrenPure)
			return;
	}

	mda.pure = true;
	counts.pure++;
};

const markPass = (value, refs, counts) => {
	if (!value || typeof(value) !== 'object')
		return;

	if (Array.isArray(value)) {
		value.forEach(v => markPass(v, refs, counts));

		return;
	}

	//Children first so `pure` rolls up correctly.
	Object.values(value).forEach(v => markPass(v, refs, counts));

	markNode(value, refs, counts);
};

const markStaticAndPure = root => {
	const refs = collectReferences(root);
	const counts = { static: 0, pure: 0, promoted: 0 };

	markPass(root, refs, counts);

	return counts;
};

module.exports = markStaticAndPure;
