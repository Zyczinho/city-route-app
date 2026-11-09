# Lisbon permanent licensed covers — first bounded batch

Scope: issue #176, first30 audited catalogue places. Eight exact-entity photographs added; **8/30 permanent covers**, not 30/30. Four flagged entries remain untouched. Other unresolved venues retain existing on-demand Google/Commons fallbacks; no claim of permanent coverage there.

Assets are unmodified Wikimedia-generated 960px JPEG thumbnails, redistributed under each file's CC BY / CC BY-SA license. Author, source page and license link are retained in both hosted `image_meta` and JSON fallback. Existing detail UI shows the credit visibly on mobile. Original embedded watermarks remain intact. CSS may crop covers; caption identifies a thumbnail, interior or detail where relevant. File hashes and original download URLs are recorded in `scripts/data/lisbon-first30-photos-20261109.json`.

## Identity review

All eight files were opened and visually checked, alongside file-page descriptions. This is a manually curated import, not a relaxation of the automatic Commons geographic gate. A river viewpoint or the camera position along a long aqueduct is not the venue entrance; these exceptions are explicitly recorded per file. No guessed coordinates added.

| Place | Photograph |
|---|---|
| Arco da Rua Augusta | Arch facade from Praça do Comércio |
| Mosteiro dos Jerónimos | Church interior |
| Praça do Comércio | Square from the Tagus |
| Sé de Lisboa | Main facade |
| A Brasileira | Named Chiado entrance, Rua Garrett 120–122 |
| Arco de São Bento | Stone arch detail, not a whole-monument view |
| Aqueduto das Águas Livres | Alcântara valley arcades |
| Basílica da Estrela | Facade and dome |

Rejected misleading candidates include `Tasca do Chico (55243057868).jpg` (description/camera identify Vila Nova de Gaia) and `Agua Livres Aqueduct in Lisbon, Portugal.jpg` (description identifies Amoreira in Elvas). Wikimedia API search later returned HTTP429; broad search stopped. The remaining22 are a backlog, not proven unavailable on Commons. Four are operational/identity flags already documented by PR195.

## Release and recovery

1. Run full unit/build and mobile gates, independent review; merge PR.
2. Verify deployed JPEG hashes and service worker precache (v83).
3. Apply `scripts/staged-lisbon-photos-20261109.sql`: atomic8-row DML; per-target baseline image metadata and concurrent-change guards. Descriptions/ratings/coordinates/other metadata are untouched.
4. Verify hosted parity with the eight-file manifest and all192 rows' unrelated-field hashes.
5. Recovery: run `scripts/rollback-lisbon-photos-20261109.sql` only if the exact owned image fields still match; then revert the PR. Rollback aborts atomically if any image metadata changed.

No schema/RLS changes, provider key activation, user-photo edits, generated images, or copying of Google/social image bytes. Assets total about1.7MB and are precached; the mobile gate checks decoding8 files, visible source/license at320/375/390 and an offline detail reload. Real iPhone acceptance remains separate.
