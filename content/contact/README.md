# Contact Content Manual

This folder controls contact page cards and footer contact icons.

## Contact Links

`contact-links.csv` controls links shown in the contact section and footer.

Common columns:

- `placement`: where the link appears. `footer` is used by the bottom icon strip.
- `order`: display order.
- `label`: accessible label or card label.
- `href`: URL, `mailto:`, or other link.
- `icon`: Font Awesome class.
- `image`: optional contact-side image selector if used by the renderer.

To remove a contact link, delete its row and regenerate `assets/js/content-data.js`.

## Contact Intent Cards

`contact-intents.csv` controls contact reason cards or quick-intent blocks.

Edit rows to change the displayed contact options. Keep the header row unchanged.

