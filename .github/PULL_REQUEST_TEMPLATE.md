## Summary

Describe the user-facing change and the smallest technical change that implements it.

## Why

Link an issue (if applicable) and explain the observed problem. Do not include sensitive conversations or signed file URLs.

## Validation

- [ ] `python3 scripts/build.py`
- [ ] `npm test`
- [ ] Relevant synthetic browser test(s)
- [ ] `python3 tests/package_integrity.py`
- [ ] Manually checked Chrome (if browser behavior changed)
- [ ] Manually checked Firefox (if browser behavior changed)

List any tests that were not run and why.

## Safety and compatibility

- [ ] No private chat content or credentials in changes, fixtures, or screenshots
- [ ] No new permissions, or new permissions explicitly justified and documented
- [ ] Error/partial export paths still report missing content honestly
- [ ] English and Portuguese strings updated if UI text changed
- [ ] Documentation updated for behavior changes
