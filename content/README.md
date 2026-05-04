# Content Editing Manual

This folder is the editable data layer for the site. Most page text, cards, projects, resume entries, contact links, prompts, navigation, and metrics live here instead of inside page JavaScript.

For a browser-based editor, open [../content-editor/index.html](../content-editor/index.html). It gives structured forms for Markdown and CSV files, including add/remove controls for fields, sections, rows, and columns.

## Folder Map

- [projects/README.md](projects/README.md): project cards, selected research projects, publications, posters, reports, project detail pages inside Resume.
- [experience/README.md](experience/README.md): resume work experience, research roles, teaching roles, industry roles.
- [education/README.md](education/README.md): education timeline and coursework.
- [skills/README.md](skills/README.md): skill cards and skill evidence.
- [metrics/README.md](metrics/README.md): rotating homepage KPI cards.
- [misc/README.md](misc/README.md): homepage, about, resume, research, assistant architecture, highlights, and page copy.
- [prompts/README.md](prompts/README.md): SagnikGPT suggested prompts and reusable prompt templates.
- [contact/README.md](contact/README.md): contact page links, contact intent cards, footer contact icons.
- [navigation/README.md](navigation/README.md): navbar page order and URLs.

## Add, Edit, Or Remove Content

For Markdown collections such as projects, experience, education, and skills:

1. Add or edit the `.md` file in the correct folder.
2. If it is a new file, add its path to [manifest.json](manifest.json).
3. Keep the `id` unique. Other CSV files may reference this `id`.
4. Regenerate the content bundle using the command below.

For CSV-driven sections:

1. Add, edit, or delete a row in the relevant CSV.
2. Keep the header row unchanged unless you also update the JavaScript renderer.
3. Leave empty fields blank instead of deleting columns.
4. Regenerate the content bundle.

## Regenerate The Content Bundle

Run this from the repo root after changing anything under `content/`:

```bash
python3 - <<'PY'
from pathlib import Path
import json

files = {
    str(path): path.read_text()
    for path in sorted(Path("content").rglob("*"))
    if path.is_file() and not any(part.startswith(".") for part in path.parts)
}

Path("assets/js/content-data.js").write_text(
    "window.SagnikContentFiles = " + json.dumps(files, ensure_ascii=False, indent=2) + ";\n"
)

print("wrote", len(files), "files")
PY
```

The site can fetch live `content/` files when served over a local server. The generated `content-data.js` file is the fallback that keeps direct file preview working.

## Common Rules

- Use commas carefully in CSV. If a value contains a comma, wrap that field in double quotes.
- Use semicolons to separate multiple list items in one CSV cell when the file already uses that pattern.
- Use `Label|URL` for link lists when the file already uses link cells.
- Asset paths should usually start from the repo root, such as `assets/papers/example.pdf`.
- Page links should use `pages/02-about.html`, `pages/03-resume.html`, `pages/04-publications.html`, `pages/04-research.html`, `pages/05-contact.html`, or `pages/06-thankyou.html`.
- Do not rename an `id` unless you also update every CSV row or Markdown link that references it.

## Manifest Rules

[manifest.json](manifest.json) tells the loader which content files exist.

- Add new Markdown collection files to the matching array: `projects`, `experience`, `education`, or `skills`.
- CSV and one-off Markdown files are listed inside `misc`, `metrics`, or related keys.
- Removing a file from the manifest removes it from rendered dynamic sections.
- Deleting a file without removing it from the manifest will cause content loading errors.
