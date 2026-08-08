export default {
  extends: ['stylelint-config-standard-scss'],
  rules: {
    'custom-property-empty-line-before': null,
    'declaration-block-single-line-max-declarations': null,
    'declaration-empty-line-before': null,
    'rule-empty-line-before': null,
    'color-function-notation': null,
    'color-function-alias-notation': null,
    'alpha-value-notation': null,
    'media-feature-range-notation': null,
    'selector-class-pattern': ['^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:__(?:[a-z0-9]+(?:-[a-z0-9]+)*)+)?(?:--[a-z0-9-]+)?$', { resolveNestedSelectors: true }],
  },
};
