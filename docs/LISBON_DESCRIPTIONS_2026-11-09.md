# Lisbon first30 description curation — 2026-11-09

24 previously blank records in the audited first30 now have original Polish editorial descriptions, based on the sources recorded per place in `scripts/data/lisbon-first30-descriptions-20261109.json` and `metadata.editorial.descriptionSources`. They are desk research, not field visits. Recommendations such as a coffee break are editorial suggestions based on the place's stated function, not copied reviews. No scores, review text, opening-hour guarantees, photos or licensing grants are inferred from these pages.

## Important source findings

- ALMA's own website explicitly says temporarily closed; retained with an in-description warning.
- A Cigarrinha's linked domain sells school uniforms; venue identity remains unverified. Its description warns against treating it as a confirmed restaurant.
- Amazonas's linked profile promotes markets/events rather than confirming this bar's location; retained with an identity warning.
- Former Atelier RE.AL ended its activity at the listed address in 2019 according to CCB/RTP. Description labels it historical, not an active gallery.

20 normal descriptions, 2 identity warnings, 1 temporary-closure warning, 1 historical-space warning. No record is deleted, silently hidden, moved or relabelled as verified. `visitStatus: listed` does not guarantee current opening. Closure/identity warnings must be considered in future recommendation and route-feasibility work.

## Source registry

| Place | Review scope | Sources |
|---|---|---|
| 100 Montaditos | listed | [Source](https://portugal.100montaditos.com/pt) |
| 100 Montaditos | listed | [Source](https://portugal.100montaditos.com/pt) |
| 1001 Nights | listed | [Source](https://www.tripadvisor.com/Restaurant_Review-g189158-d12446407-Reviews-1001_Nights_Iranian_Restaurant-Lisbon_Lisbon_District_Central_Portugal.html) · [Source](https://www.openstreetmap.org/node/8321839453) |
| A Brasileira | listed | [Source](https://www.visitlisboa.com/pt-pt/lisbon-stories/4-route-pessoa/pois) |
| A Casa do Bacalhau | listed | [Source](https://www.casadobacalhau.pt/) |
| A Cigarrinha | identity-unverified | [Source](https://www.fardascigarrinha.pt/) |
| A Flor da Selva | listed | [Source](https://pt.linkedin.com/company/a-flor-da-selva) · [Source](https://flordaselva.com/home--pt.html) |
| A Gaúcha | listed | [Source](https://www.agaucha.pt/) |
| A20 - Speaciality Coffee & Food | listed | [Source](https://a20.choiceqr.com/) · [Source](https://thirddesk.co/portugal/lisbon/a20-specialty-coffee-food) |
| Adega das Gravatas | listed | [Source](https://www.adegadasgravatas.com/) |
| Al-Café | listed | [Source](https://www.tripadvisor.pt/Restaurant_Review-g189158-d9563827-Reviews-Al_Cafe-Lisbon_Lisbon_District_Central_Portugal.html) · [Source](https://www.openstreetmap.org/node/3724793425) |
| Albå | listed | [Source](https://albalisbon.com/) |
| Alma (closed) | temporarily-closed | [Source](https://www.almalisboa.pt/) |
| Amazonas | identity-unverified | [Source](https://linktr.ee/amz.amazonas) |
| Aqueduto das Águas Livres | listed | [Source](https://www.epal.pt/EPAL/menu/museu-da-%C3%A1gua/exposi%C3%A7%C3%A3o-permanente-patrim%C3%B3nio-associado/aqueduto-das-%C3%A1guas-livres) |
| Arco de São Bento | listed | [Source](https://arquivomunicipal3.cm-lisboa.pt/x-arqweb/Result.aspx?id=3619671&type=PCD) |
| Arte Graça | listed | [Source](https://artegraca.pt/) · [Source](https://www.imagolisboa.pt/en-exposicao-gag.html) |
| atelier Re.al | historical | [Source](https://www.ccb.pt/evento/joao-fiadeiro-introspectiva/) · [Source](https://www.rtp.pt/noticias/cultura/projeto-de-danca-real-chega-hoje-ao-fim-com-atuacao-de-joao-fiadeiro-e-joana-gama_n1163189) |
| Babylon 360 | listed | [Source](https://www.vascodagamatower.com/spots/babylon-360/) |
| Baiwho Lisboa | listed | [Source](https://linktr.ee/baiwholisboa) · [Source](https://www.timeout.pt/lisboa/pt/coisas-para-fazer/baiwho-lisboa) |
| Bar Na Colina | listed | [Source](https://www.nit.pt/comida/cafes-e-bares/entre-o-xadrez-e-cocktails-o-novo-bar-de-lisboa-e-um-ponto-de-encontro-na-colina) |
| Barrio Latino | listed | [Source](https://www.allaboutportugal.pt/pt/lisboa/bares/barrio-latino-cafe) · [Source](https://www.cmjornal.pt/memoria-cm/lisbon-cool/drink/detalhe/learn-to-dance-at-barrio-latino) |
| Basílica da Estrela | listed | [Source](https://www.visitlisboa.com/en/places/basilica-da-estrela) |
| Belcanto | listed | [Source](https://www.belcanto.pt/) |

## Deployment and recovery

1. JSON fallback and source manifest go through PR/tests/build/review.
2. Run `scripts/staged-lisbon-descriptions-20261109.sql` against City Route only after code review. It must match exactly24 Lisbon legacy IDs with blank or identical descriptions; any mismatch or concurrently changed editorial provenance rolls back the statement. Both preflight and UPDATE accept editorial metadata only when absent/empty or containing the complete identical patch; extra nonconflicting keys survive. It updates description/editorial metadata only, preserving original OSM source, other metadata, coordinates, categories, ratings, images, visibility and user data.
3. Query `catalogue_places('lisbon')` and verify all24 exact descriptions + sources and first30 description coverage30/30. Check live REST/visible detail, reload and JSON fallback.
4. Recovery: revert JSON commit; hosted correction must be bounded to these same24 legacy IDs and only run where current description/editorial metadata still match this patch. Prior descriptions were empty and all24 prior editorial objects were absent. Do not restore blindly over subsequent edits.

This completes description coverage for this audited set, not #176: permanent exact-place licensed covers, broader catalogue curation, questionable-record resolution and real-device visual QA remain open.
