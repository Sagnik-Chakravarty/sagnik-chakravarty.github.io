# Education Content Manual

Education files control the Resume education timeline and About education list.

## Add An Education Entry

1. Copy an existing `.md` file.
2. Set a unique `id`.
3. Add the path to the `education` array in `../manifest.json`.
4. Regenerate `assets/js/content-data.js`.

## Remove An Education Entry

1. Remove its path from the `education` array in `../manifest.json`.
2. Delete or archive the file.
3. Regenerate `assets/js/content-data.js`.

## Important Fields

- `id`: unique education key.
- `date`: timeline date range.
- `institution`: school name.
- `degree`: degree/program.
- `focus`: short academic focus.
- `metrics`: semicolon-separated `value|label` pairs.
- `courses`: semicolon-separated course names.

Course names become clickable buttons in Resume.

