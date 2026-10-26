# E2E Test Levels

The E2E tests are now organized in different levels to support quick feedback loops and comprehensive testing.

## Test Levels

### Level 1: `basic-single` (Default - Fast)
- **Basic tests only** + **Single dataset** (fastest Johannes dataset)
- Best for: Quick feedback during development
- Time: ~5-10 minutes
- Tests: Manual data entry, Export/Import roundtrip, Chart validation basics

```bash
npm run test:e2e
npm run test:e2e:basic
npm run test:e2e:headed        # with browser UI
npm run test:e2e:basic:headed
```

### Level 2: `full-single` (Complete - Single Dataset)
- **All tests** + **Single dataset**
- Best for: Full validation before merging, single dataset verification
- Time: ~10-20 minutes
- Tests: All basic tests + detailed chart tests, event management, analysis filters

```bash
npm run test:e2e:full
npm run test:e2e:full:headed
```

### Level 3: `basic-all` (Quick Coverage)
- **Basic tests only** + **All 4 datasets**
- Best for: Multi-dataset coverage with quick feedback
- Time: ~20-40 minutes
- Tests: Manual data + basic validation × 4 datasets

```bash
npm run test:e2e:basic:all
npm run test:e2e:basic:all:headed
```

### Level 4: `full-all` (Comprehensive)
- **All tests** + **All 5 datasets**
- Best for: Final validation and scheduled/manual exhaustive runs
- Time: ~40-120 minutes
- Tests: All tests × 5 datasets (manual + all imports, detailed validations, filters)

Note: GitHub Pages push workflow runs unit tests + production build. The GitHub Release workflow runs `test:e2e:smoke`; it does not run `full-all`.

```bash
npm run test:e2e:full:all
npm run test:e2e:full:all:headed
```

## Environment Variable

You can also set the test level manually:

```bash
TEST_LEVEL=basic-single npm run test:e2e
TEST_LEVEL=full-single npm run test:e2e:headed
TEST_LEVEL=basic-all npm run test:e2e
TEST_LEVEL=full-all npm run test:e2e
```

## Available Test Datasets

The following anonymized datasets are used:

| Dataset | File | Children | Staff | Description |
|---------|------|----------|-------|-------------|
| Johannes-202411 | kita-anonym-72229327.zip | 39 | 13 | Nov 2024 snapshot |
| Johannes-202505 | kita-anonym-71814654.zip | 34 | 12 | May 2025 snapshot |
| Johannes-202511 | kita-anonym-29247781.zip | 43 | 11 | Nov 2025 snapshot |
| Johannes-202602 | kita-anonym-55055120.zip | 43 | 11 | Feb 2026 snapshot |
| Johannes-202605 | kita-anonym-53181382.zip | ? | ? | May 2026 snapshot |

## Test Structure

### Basic Tests
- ✅ Manual data entry and visualization
- ✅ Export/Import roundtrip
- ✅ Chart presence and basic rendering
- ✅ Data import and basic validation
- ✅ Data-list sidepanel: right placement, collapse/expand, filters, archive toggle, capture queue, selection, bulk archive/restore/delete and bulk validity/qualification/cost edits
- ✅ Scenario picker: rename selected scenario; reject blank and duplicate names

### Full Tests (Additional)
- ✅ Event management (toggle events)
- ✅ Analysis filters (charts, dimensions, groups)
- ✅ Detailed chart validations (axes, bins, scaling)
- ✅ Data point accuracy
- ✅ Responsive scaling

## CI/CD Recommendation

CI coverage is split by workflow:

- `deploy-pages.yml` (every push to `main`): unit tests + production build; **no Playwright**.
- `release.yml` (release/tag): `npm run test:e2e:smoke` (targeted Playwright smoke suite, desktop/tablet/smartphone responsive projects).
- `full-all` is available for exhaustive manual runs; it is not currently a CI gate.

For a full local run:

```bash
npm run test:e2e:full:all
```

## Quick Development Workflow

1. **During development**: Use `basic-single` (fastest)
   ```bash
   npm run test:e2e
   ```

2. **Before committing**: Use `full-single` (complete validation, one dataset)
   ```bash
   npm run test:e2e:full
   ```

3. **Before merge request**: Use `basic-all` (multi-dataset quick check)
   ```bash
   npm run test:e2e:basic:all
   ```

4. **Final validation/CI**: Use `full-all` (comprehensive, all datasets)
   ```bash
   npm run test:e2e:full:all
   ```
