# Projects Content Manual

Project files control project cards on Research, project timelines in Resume, publications, featured research systems, posters, papers, dashboards, and SagnikGPT project prompts.

## Add A Project

1. Copy an existing project file, such as `narrative-pulse.md`.
2. Rename it with a simple lowercase filename, such as `new-project.md`.
3. Set a unique `id` in the frontmatter.
4. Add the new path to the `projects` array in `../manifest.json`.
5. Regenerate `assets/js/content-data.js`.

## Remove A Project

1. Remove its path from the `projects` array in `../manifest.json`.
2. Search for its `id` in `../misc/*.csv`.
3. Remove or update rows that reference the deleted project.
4. Delete the Markdown file only after the references are cleaned up.
5. Regenerate `assets/js/content-data.js`.

## Important Fields

- `id`: unique project key. Used by highlight CSVs.
- `date`: shown in timelines and sorting.
- `title`: main project title.
- `meta`: short category line.
- `paper`: optional paper/report path.
- `website`: optional dashboard or live site.
- `poster`: optional poster image.
- `selected`: `true` to show in Research selected projects.
- `selectedOrder`: order for selected projects.
- `publication`: `true` to show in Publications.
- `publicationVenue`, `publicationDate`, `publicationOrder`: label, date, and sort order for the Publications page.
- `demo`: `true` to show in the Live Demos section.
- `demoOrder`, `demoLabel`, `demoTitle`: live demo sort order and display text.
- `demoSteps`: semicolon-separated `Step|Description` pairs for Live Demo how-it-works boxes.
- `featureOrder`: number to show as a featured research system.
- `metrics`: semicolon-separated `value|label` pairs.
- `links`: semicolon-separated `Label|URL` links.
- `question`: prompt used when asking SagnikGPT about the project.

## Body Sections

These sections are used in project detail views:

- `## Summary`
- `## Objective`
- `## Abstract`
- `## Motivation`
- `## Methods`
- `## Results`
- `## Insight`

Keep section names exactly as written if you want the current renderers to pick them up.
