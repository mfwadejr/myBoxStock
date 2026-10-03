# Releasing

Every version that is published must have release notes. This is enforced, not just recommended.

1. Bump `version` in `package.json` (SemVer).
2. Add a `## [x.y.z] - YYYY-MM-DD` section to the top of `CHANGELOG.md` (Added / Changed / Fixed / Security / Known limitations).
3. `npm test` — the standards test fails if the current version has no changelog entry.
4. Commit, then tag and push: `git tag vX.Y.Z && git push origin main --tags`.

What happens automatically:
- `release.yml` checks the tag matches `package.json` and that the changelog has the entry, then creates the GitHub Release using that entry as the notes. It fails (no release) if either is missing.
- `docker.yml` publishes the image as `ghcr.io/mfwadejr/myboxstock:x.y.z` and `:latest`.
- The running app shows `vX.Y.Z` in the corner and in `/healthz`.
