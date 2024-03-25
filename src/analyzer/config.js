const NODE_TYPES = {
	COMMENT: Symbol('COMMENT'),
	COMMENTS: Symbol('COMMENTS'),
	COMPONENT: Symbol('COMPONENT'),
	COMPONENT_AUTH_ARRAY: Symbol('COMPONENT_AUTH_ARRAY'),
	COMPONENT_CONDITION: Symbol('COMPONENT_CONDITION'),
	COMPONENT_POPOVER_MDA: Symbol('COMPONENT_POPOVER_MDA'),
	CONDITION: Symbol('CONDIITON'),
	CONDITION_ARRAY: Symbol('CONDITION_COMPARISON_ARRAY'),
	CONDITION_SUB_ENTRY: Symbol('CONDIITON_COMPARISON_ENTRY'),
	DASHBOARD: Symbol('DASHBOARD'),
	DASHBOARD_OR_TRAIT_DEFINITION: Symbol('DASHBOARD_OR_TRAIT_DEFINITION'),
	ENSEMBLE_CONFIG: Symbol('ENSEMBLE_CONFIG'),
	ENSEMBLE_CONFIG_ENTRY: Symbol('ENSEMBLE_CONFIG_ENTRY'),
	FILE: Symbol('FILE'),
	FLOW: Symbol('FLOW'),
	FLOWS_ARRAY: Symbol('FLOWS_ARRAY'),
	FOLDER: Symbol('FOLDER'),
	MDA_PACKAGE: Symbol('MDA_PACKAGE'),
	PRP: Symbol('PRP'),
	PRPS_OBJECT: Symbol('PRPS_OBJECT'),
	SCP: Symbol('SCP'),
	SCPS_ARRAY: Symbol('SCPS_ARRAY'),
	SCP_ACTION: Symbol('SCP_ACTION'),
	SCP_ACTIONS_ARRAY: Symbol('SCP_ACTIONS_ARRAY'),
	SCP_ACTION_ENTRY: Symbol('SCP_ACTION_ENTRY'),
	SCP_ACTION_SUB_ENTRY: Symbol('SCP_ACTION_SUB_ENTRY'),
	SCP_TRIGGER: Symbol('SCP_TRIGGER'),
	SCP_TRIGGERS_ARRAY: Symbol('SCP_TRIGGERS_ARRAY'),
	SCP_TRIGGER_MATCH: Symbol('SCP_TRIGGER_MATCH'),
	STARTUP: Symbol('STARTUP'),
	STARTUP_ENTRY: Symbol('STARTUP_ENTRY'),
	SUB_PRP: Symbol('SUB_PRP'),
	THEME: Symbol('THEME'),
	THEME_CONFIG: Symbol('THEME_CONFIG'),
	THEME_ENTRY: Symbol('THEME_ENTRY'),
	THEME_SUB_ENTRY: Symbol('THEME_SUB_ENTRY'),
	TRAIT: Symbol('TRAIT'),
	TRAITS_ARRAY: Symbol('TRAITS_ARRAY'),
	TRAIT_ACCEPT_PRP: Symbol('TRAIT_ACCEPT_PRP'),
	TRAIT_ACCEPT_PRPS: Symbol('TRAIT_ACCEPT_PRPS'),
	TRAIT_ACCEPT_SUB_PRP: Symbol('TRAIT_ACCEPT_SUB_PRP'),
	TRAIT_CONDITION: Symbol('TRAIT_CONDITION'),
	TRAIT_CONFIG: Symbol('TRAIT_CONFIG'),
	TRAIT_DEFINITION: Symbol('TRAIT_DEFINITION'),
	TRAIT_PRP: Symbol('TRAIT_PRP'),
	TRAIT_PRPS: Symbol('TRAIT_PRPS'),
	TRAIT_SUB_PRP: Symbol('TRAIT_SUB_PRP'),
	TRAIT_UNUSED: Symbol('TRAIT_UNUSED'),
	TRAIT_UNUSED_SUB_ENTRY: Symbol('TRAIT_UNUSED_SUB_ENTRY'),
	WGTS_ARRAY: Symbol('WGTS_ARRAY')
};

const NODE_PROPERTIES = {
	COMPONENT: ['prps', 'wgts', 'scope', 'relId', 'traits', 'container']
};

const NODE_PROPERTIES_NEEDED = {
	COMPONENT: 2
};

const SYSTEM_TRAITS = [
	'@l2_canvas_shared/canvas/visual/tabManager/visual/tabContents/visual/shared/dataObjectHeader/visual/field/index',
	'@l2_canvas_shared/canvas/visual/tabManager/visual/tabContents/visual/canvasView/visual/dataObjectHeader/index',
	'@l2_canvas_shared/canvas/visual/tabManager/visual/tabContents/visual/canvasUnion/visual/unionFields/visual/dataObjectHeader/index',
	'@l2_canvas_shared/canvas/visual/tabManager/visual/tabContents/visual/canvasUnion/visual/unionDefinition/visual/unionDefinitionAliasesHeader/visual/field/index',
	'@l2_canvas_shared/canvas/visual/tabManager/visual/tabContents/visual/canvasUnion/visual/unionDefinition/visual/unionDefinitionAliasesHeader/index',
	'@l2_canvas_shared/canvas/visual/tabManager/visual/tabContents/visual/canvasUnion/visual/unionDefinition/visual/unionDefinitionHeader/visual/field/index',
	'@l2_canvas_shared/canvas/visual/tabManager/visual/tabContents/visual/canvasUnion/visual/unionDefinition/visual/unionDefinitionHeader/index',
	'@l2_data_pedigree/visual/header/visual/field/index',
	'@l2_data_pedigree/visual/header/visual/history/index',
	'@l2_data_pedigree/visual/header/index',
	'@l2_data_pedigree/visual/calculatedField/visual/calculatedFieldLine/index',
	'@l2_data_pedigree/visual/calculatedField/index',
	'@l2_sidebar/index.json'
];

module.exports = {
	NODE_TYPES,
	NODE_PROPERTIES,
	NODE_PROPERTIES_NEEDED,
	SYSTEM_TRAITS
};
