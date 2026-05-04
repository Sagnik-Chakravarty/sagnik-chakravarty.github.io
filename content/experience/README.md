# Experience Content Manual

Experience files control the Resume experience timelines and role detail pages.

## Add An Experience Entry

1. Copy an existing `.md` file.
2. Give the new file a unique `id`.
3. Set `section` to one of `research`, `teaching`, or `industry`.
4. Add the file path to the `experience` array in `../manifest.json`.
5. Regenerate `assets/js/content-data.js`.

## Remove An Experience Entry

1. Remove its path from the `experience` array in `../manifest.json`.
2. Search for its `id` in `../misc/*.csv`.
3. Remove rows that reference it, especially highlight rows.
4. Regenerate `assets/js/content-data.js`.

## Important Fields

- `id`: unique role key.
- `section`: timeline group: `research`, `teaching`, or `industry`.
- `date`: shown in the timeline.
- `org`: organization name.
- `title`: role title.
- `icon`: Font Awesome icon class, such as `fa-briefcase`.
- `result`: short outcome shown in cards.
- `metrics`: semicolon-separated `value|label` pairs.
- `tags`: comma-separated tags.
- `paper`, `website`, `poster`: optional links/buttons.
- `question`: prompt used by SagnikGPT.

## Body Sections

Use `## Details` for the expanded role description. Paragraphs inside this section are rendered in the detail page.

