/**
 * E2E Test Configuration
 * Defines test levels and datasets for parametrized testing
 */

import path from 'path';

export const TEST_LEVELS = {
  BASIC_SINGLE: 'basic-single',
  FULL_SINGLE: 'full-single',
  BASIC_ALL: 'basic-all',
  FULL_ALL: 'full-all',
};

// Get test level from environment or default to basic-single
export const TEST_LEVEL = process.env.TEST_LEVEL || TEST_LEVELS.BASIC_SINGLE;

// Get test type and scope from TEST_LEVEL
export function parseTestLevel(level) {
  const isBasic = level.includes('basic');
  const isAll = level.includes('all');
  return {
    isBasic,
    isAll,
    level,
  };
}

// Available test datasets
export const TESTSETS = [
  {
    name: 'Johannes-202411',
    zip: 'tests/testdata/kita-anonym-72229327.zip',
    kids: 39,
    staff: 13,
  },
  {
    name: 'Johannes-202505',
    zip: 'tests/testdata/kita-anonym-71814654.zip',
    kids: 34,
    staff: 12,
  },
  {
    name: 'Johannes-202511',
    zip: 'tests/testdata/kita-anonym-29247781.zip',
    kids: 43,
    staff: 11,
  },
  {
    name: 'Johannes-202602',
    zip: 'tests/testdata/kita-anonym-55055120.zip',
    kids: 43,
    staff: 11,
  },
];

/**
 * Get datasets to use for the current test level
 */
export function getTestsetsForLevel(level = TEST_LEVEL) {
  const { isAll } = parseTestLevel(level);
  
  if (isAll) {
    return TESTSETS;
  }
  
  // For single: use first dataset
  return [TESTSETS[0]];
}

/**
 * Determine which tests should run based on level
 */
export function shouldRunBasicTests(level = TEST_LEVEL) {
  const { isBasic } = parseTestLevel(level);
  return true; // Basic tests always run
}

export function shouldRunFullTests(level = TEST_LEVEL) {
  const { isBasic } = parseTestLevel(level);
  return !isBasic; // Full tests only in full modes
}

/**
 * Get human-readable description of test level
 */
export function getTestLevelDescription(level = TEST_LEVEL) {
  const { isBasic, isAll } = parseTestLevel(level);
  const testType = isBasic ? 'Basic' : 'Full';
  const dataScope = isAll ? 'All Datasets' : 'Single Dataset';
  return `${testType} Tests with ${dataScope}`;
}
