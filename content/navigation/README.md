# Navigation Content Manual

`pages.csv` controls the navbar links.

## Columns

- `order`: numeric order in the navbar.
- `title`: visible nav label.
- `url`: page URL.
- `match`: filename used to detect the active page.

## Add A Page To The Navbar

1. Add the page HTML file under `../../pages` in the repo, usually named with an order prefix such as `07-new-page.html`.
2. Add a row to `pages.csv`.
3. Regenerate `assets/js/content-data.js`.

Example:

```csv
6,New Page,pages/07-new-page.html,07-new-page.html
```

## Remove A Page From The Navbar

Delete its row from `pages.csv`. This removes it from navigation but does not delete the HTML page.
