# Prompts Content Manual

This folder controls reusable prompts for SagnikGPT buttons and prompt shortcuts.

## Files

- `assistant-prompts.csv`: visible prompt buttons inside the Research assistant section.
- `prompt-templates.csv`: reusable prompt keys referenced by other content files.

## Add A Visible Prompt Button

Add a row to `assistant-prompts.csv`.

Common columns:

- `key`: unique prompt key.
- `label`: button text.
- `prompt`: full prompt sent to the assistant.

## Add A Reusable Prompt Template

Add a row to `prompt-templates.csv`.

Use the `key` from another CSV when a field expects a prompt key. For example, `highlights.csv` can use a prompt key in the `target` column when `actionType` is `ask`.

## Remove A Prompt

Delete the row, then search for the prompt `key` in `content/`. If another file references that key, update or remove that reference too.

