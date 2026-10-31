# Development instructions

- Develop and maintain the novel RPG in `pon-user/Novel_RPG`. This repository is the working source for the game; do not implement game changes in `pon-user/obsidian-vault`.
- The Obsidian repository is a reference for existing specifications and approved prose. Do not change or remove its files or PRs unless the user explicitly requests that separate work.
- The only deployed game is MVP v0.5 in `docs/`. Keep runtime resource references relative so GitHub Pages works under `/Novel_RPG/`. Tests and developer documentation belong outside `docs/`.
- Keep the game free to run as static HTML/CSS/JavaScript, with no paid API or backend requirement. Preserve approved prose and the five-section/four-battle flow unless a requested feature changes them.
- Run `npm test` for logic changes. For runtime/UI changes, also serve `docs/` with `python3 run.py --no-open` and run `BASE_URL=http://127.0.0.1:8765/ npm run test:browser`. Use `npm ci` to install the pinned browser-test dependencies when needed.
- Browser tests use isolated saves. Do not overwrite a user's save; retain JSON export/import and corrupt-save protection.
- Use existing checkouts in the isolated cloud task; do not create a Git worktree unless explicitly requested.
- Follow the user's authorization for merging and publishing. For normal development, prepare a branch and PR; do not assume this migration's merge/publication authorization applies to future changes.
