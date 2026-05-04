---
type: project
id: gti
date: 2025
title: "GTI Rankings Through Event Data and Media Framing"
meta: "IISA 2025 | Machine Learning | Media Framing"
paper: assets/papers/GTD.pdf
github: https://github.com/Sagnik-Chakravarty/Media-Aware-GTI-ML
poster: assets/poster/GTDPoster.png
selected: true
selectedOrder: 5
selectedLabel: IISA 2025
selectedIcon: fa-globe
publication: true
publicationVenue: IISA 2025
publicationDate: 2025
publicationOrder: 3
metrics: 200K+|GTD terrorist incidents; 1970-2020|Historical event period; 1,000|Manually labeled news articles; 5|Framing categories
links: Paper|assets/papers/GTD.pdf; GitHub|https://github.com/Sagnik-Chakravarty/Media-Aware-GTI-ML
question: Explain the GTI/IISA project. Include GTD events, media framing labels, random forest modeling, ranking discrepancies, and index-bias insight.
---
## Summary
Built a media-aware alternative to the Global Terrorism Index using GTD event data and news framing.

## Objective
Evaluate whether a machine-learned terrorism index can incorporate both event-level severity and media framing.

## Abstract
The project integrates Global Terrorism Database features with supervised media-frame classification and random forest regression to construct an interpretable GTI-like score.

## Motivation
Fixed-weight terrorism indices may overstate or understate country risk when they ignore media framing and contextual severity.

## Methods
GTD feature extraction, news scraping, supervised framing classification, country-level framing ratios, random forest regression, residual/rank-difference analysis.

## Results
The model mirrored conflict-heavy countries but identified discrepancies where fixed GTI scores appeared inflated or suppressed.

## Insight
Terrorism exposure indices can become more interpretable and bias-aware by incorporating event severity and media framing.
