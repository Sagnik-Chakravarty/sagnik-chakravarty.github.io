# Content Studio

This folder contains a browser-based editor for the portfolio content system.

Open `content-editor/index.html` from a local server. The editor changes files in your local working copy only. It does not commit, push, or write directly to GitHub.

The page can:

- Start with a guided choice: **Enter new content** or **Modify/Delete existing content**.
- Walk through General webpage information, Resume/research records, and Contact information.
- Show project-specific fields for paper links, poster links, dashboard links, selected research cards, publication status, homepage highlights, showcase/live-demo status, and homepage metrics.
- Control Research page project visibility from the Project form so the same project is not entered twice.
- Capture skill evidence through Project, Experience, Education, and the Resume skill matrix instead of maintaining a separate guided skill entry flow.
- Keep the raw file editor on `content-editor/advanced.html` so guided editing stays clean.
- Open your local `content/` folder with the File System Access API.
- Edit Markdown frontmatter and Markdown sections.
- Edit CSV rows and columns.
- Create new Markdown and CSV files under `content/`.
- Remove fields, sections, rows, and columns.
- Delete selected content files after confirmation.
- Save directly to local files when the browser grants folder write permission.
- Fall back to downloading edited files when direct saving is unavailable.

## Recommended Use

1. Open the site in Chrome or Edge.
2. Go to `content-editor/index.html`.
3. Click **Open Content Folder**.
4. Select the local `content/` folder from this working copy.
5. Edit the file you want.
6. Click **Save**.
7. Regenerate `assets/js/content-data.js` from the local repo root:

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

## Limits

Static websites cannot write to local files without explicit browser permission. If direct folder access is blocked, use **Load Bundled Snapshot**, edit a file, then **Download** and replace the local file manually. Commit and push through Git only after you are happy with the local changes.

## Advanced Editor

Use `content-editor/advanced.html` only when you need direct Markdown/CSV/JSON editing. README files and hidden system files are excluded from the editable list to avoid parsing documentation as site content.
