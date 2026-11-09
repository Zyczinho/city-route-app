# Coordinator — notes

Short, dated lessons this role must know on its next run. Newest first.

- 2026-11-09 — P0 #200 consumed repeated patch/test/merge cycles because mocked smoke was treated as user acceptance. After two unsuccessful changes freeze feature work (including #176) and assign one Incident Debugger. Keep one issue and require actual provider + device/city reproduction before a third fix. See incident protocol and postmortem. Update in the same PR as the work.

- 2026-11-05 — Two agents edited icons at once (PR #96 and a stacked follow-up); stack or sequence instead, never parallel writers on the same files.
- 2026-11-05 — Squash merges make stacked branches conflict on every shared file; merge main into the follow-up and keep the follow-up's side.
