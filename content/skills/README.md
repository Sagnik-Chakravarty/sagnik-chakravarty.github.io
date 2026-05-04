# Skills Content Manual

Skill files control skill evidence cards in Resume and other skill-driven sections.

## Add A Skill

1. Copy an existing skill `.md` file.
2. Set a unique `id`.
3. Add the path to the `skills` array in `../manifest.json`.
4. Regenerate `assets/js/content-data.js`.

## Remove A Skill

1. Remove its path from the `skills` array in `../manifest.json`.
2. Search for the `id` in `../misc/*.csv`.
3. Remove any rows that reference it.
4. Regenerate `assets/js/content-data.js`.

## Important Fields

- `id`: unique skill key.
- `title`: skill card title.
- `icon`: Font Awesome icon class.
- `description`: short explanation.
- `evidence`: comma-separated evidence tags.
- `question`: SagnikGPT prompt.

The Markdown body can include longer explanatory text, but the current Resume skill card mainly uses frontmatter.

