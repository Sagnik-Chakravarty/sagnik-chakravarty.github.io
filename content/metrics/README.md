# Metrics Content Manual

`home-kpis.csv` controls the rotating Project Metrics cards on the homepage.

## Add A Metric Card

Add a row to `home-kpis.csv`.

Columns:

- `group`: cards with the same group rotate together.
- `source`: small label at the top of the KPI card.
- `value`: large KPI value.
- `label`: KPI description.
- `actionLabel`: link/action text.
- `url`: destination opened when clicked.

## Remove A Metric Card

Delete the row from `home-kpis.csv`, then regenerate `assets/js/content-data.js`.

## Add A New Rotation Group

Use a new `group` value. All rows with that group value will appear together in one rotation set.

