# CATALOG-WAW-001: Warszawa, P0, partia 01

**Stan:** PR / review; nie opublikowano w hosted Supabase. Data weryfikacji: 2026-11-03.

## Cel i zakres

Pierwsza kontrolowana partia nowych obiektów na potrzeby rozszerzenia katalogu Warszawy: **9 muzeów + 6 restauracji**. Start: 50 obiektów, po tej partii w repo: **65**. Podstawą są oficjalne strony instytucji/lokali, dostępne źródła lokalizacji oraz aktualne adresy. To nie jest ranking „TOP”.

Wszystkie miejsca mają zewnętrzne źródło współrzędnych, udokumentowane w polu `metadata.source.coordinateSource`; gdy współrzędne pochodzą z **adresu budynku**, nie twierdzimy, że to dokładne wejście do restauracji. Współrzędne z Mapcarta są oparte na danych OpenStreetMap; wykorzystywanie ich wymaga odpowiedniej atrybucji © OpenStreetMap contributors i przestrzegania ODbL. Nie pobrano zdjęć z Google/Tripadvisor.

## Dodane miejsca

| ID | Miejsce | Kategoria | Adres | Źródło położenia | Strona obiektu |
|---|---|---|---|---|---|
| `warsaw-uprising-museum` | Muzeum Powstania Warszawskiego | Muzeum | Grzybowska 79 | [lokalizacja](https://muzea.org/muzeum/muzeum-powstania-warszawskiego/) | [operator](https://www.1944.pl/) |
| `polin-museum` | Muzeum Historii Żydów Polskich POLIN | Muzeum | Mordechaja Anielewicza 6 | [lokalizacja](https://mapcarta.com/pt/W186141946) | [operator](https://polin.pl/pl/o-muzeum) |
| `warsaw-city-museum` | Muzeum Warszawy | Muzeum | Rynek Starego Miasta 28–42 | [lokalizacja](https://mapcarta.com/36022060) | [operator](https://muzeumwarszawy.pl/) |
| `modern-art-museum-warsaw` | Muzeum Sztuki Nowoczesnej | Muzeum | Marszałkowska 103 | [lokalizacja](https://mapcarta.com/pt/W944207076) | [operator](https://artmuseum.pl/) |
| `polish-history-museum` | Muzeum Historii Polski | Muzeum | Gwardii 1 | [lokalizacja](https://mapcarta.com/W31102954) | [operator](https://muzhp.pl/zaplanuj-wizyte) |
| `polish-army-museum` | Muzeum Wojska Polskiego | Muzeum | Gwardii 4 | [lokalizacja](https://mapcarta.com/W31102940) | [operator](https://muzeumwp.pl/) |
| `asia-pacific-museum` | Muzeum Azji i Pacyfiku | Muzeum | Solec 24 | [lokalizacja](https://mapcarta.com/N11196230956) | [operator](https://www.muzeumazji.pl/wizyta/) |
| `polish-vodka-museum` | Muzeum Polskiej Wódki | Muzeum | Plac Konesera 1 | [lokalizacja](https://mapcarta.com/N6566541885) | [operator](https://muzeumpolskiejwodki.pl/) |
| `printing-museum-warsaw` | Muzeum Drukarstwa Warszawskiego | Muzeum | Ząbkowska 23/25 | [lokalizacja](https://mapcarta.com/N9937530280) | [operator](https://muzeumdrukarstwa.muzeumwarszawy.pl/o-muzeum/) |
| `bibenda-nowogrodzka` | Bibenda | Restauracja | Nowogrodzka 10 | [lokalizacja](https://sprawdzadres.pl/mazowieckie/warszawa/nowogrodzka/10) | lokal i adres potwierdzone w źródle lokalnym |
| `maka-i-woda-chmielna` | Mąka i Woda | Restauracja | Chmielna 13A | [lokalizacja](https://sprawdzadres.pl/mazowieckie/warszawa/chmielna/13A) | [operator](https://makaiwoda.pl/) |
| `uki-uki-krucza` | UKI UKI (Krucza) | Restauracja | Krucza 23 | [lokalizacja](https://sprawdzadres.pl/mazowieckie/warszawa/krucza/23_31) | lokal i adres potwierdzone w źródle lokalnym |
| `pyzy-flaki-brzeska` | Pyzy, Flaki Gorące! (Brzeska) | Restauracja | Brzeska 29/31 | [lokalizacja](https://sprawdzadres.pl/mazowieckie/warszawa/brzeska/29_31) | [operator](https://www.pyzyflakigorace.pl/) |
| `vegan-ramen-finlandzka` | Vegan Ramen Shop (Finlandzka) | Restauracja | Finlandzka 12A | [lokalizacja](https://pl.aroundus.com/p/171939459-vegan-ramen-shop-finlandzka) | [operator](https://veganramenshop.pl/contact/) |
| `soul-kitchen-nowogrodzka` | Soul Kitchen | Restauracja | Nowogrodzka 18A | [lokalizacja](https://sprawdzadres.pl/mazowieckie/warszawa/nowogrodzka/18A) | lokal i adres potwierdzone w źródle lokalnym |

## Jakie dane są celowo niepełne

- **Oceny i liczby opinii**: puste tablice `ratings: []`. Brak ocen = brak ocen, żadnych wymyślonych liczb.
- **Zdjęcia**: `image: null`; w UI ma działać neutralny placeholder. Dobór zdjęć z prawem do użycia i atrybucją to następny pakiet.
- **Koszt**: pole `cost` oznacza orientacyjny redakcyjny budżet na postój używany przez generator, **nie** oficjalną cenę biletu, wejścia lub posiłku; `metadata.priceSource = editorial-budget-estimate`. Przed launchowym UX QA powinniśmy jawniej opisać koszty jako szacunki.
- **Godziny i dostępność**: nie kodujemy aktualnych godzin jako stałych wartości; informacje weryfikuje się na stronie obiektu.
- **Zapis w Supabase**: brak automatycznej synchronizacji. Sama zmiana `data/places.json` nie wystarcza, bo katalog aplikacji czyta dane **Supabase-first**.

## Plan bezpiecznego wdrożenia (osobny gate)

1. Przejrzeć PR, uruchomić `npm test` i `npm run build`; sprawdzić źródła i 15 punktów mapy.
2. Po aprobacie zmergować PR z GitHub, **bez** założenia, że migracja jest już na hosted.
3. Founder uruchamia ręcznie `supabase/migrations/014_warsaw_museums_restaurants.sql` w **hosted Supabase SQL Editor**, tylko po zatwierdzeniu zmian danych produkcyjnych.
4. Sprawdzić na hosted, że istnieje 15 nowych rekordów published/public w Warszawie (przy katalogu początkowym 50 -> min. 65), oraz że starych 50 rekordów nie zmieniono.
5. Zweryfikować w aplikacji wyszukiwanie „Muzeum Powstania”, „Mąka i Woda” i „Saska Kępa”, filtry Muzea/Jedzenie, mapę, dodawanie do Mojej trasy i budowę spaceru.
6. Osobno zatwierdzić zamknięcie tasku w `AGENT_COORDINATION.md` dopiero po sprawdzeniu zarówno GitHuba, jak i hosted.

## Następne partie P0

- Więcej muzeów podzielonych tematycznie (historia, sztuka, nauka, technika).
- Restauracje według kuchni i dzielnicy, z jednoznaczną identyfikacją filii.
- Import przez zweryfikowane źródła OSM z deduplikacją po nazwie, adresie i odległości; selekcja redakcyjna i weryfikacja adresu przed publikacją.
- Bez wymuszania płatnych API: identyfikacja, kategorie i lokalizacja najpierw, wzbogacanie w zdjęcia/oceny jako osobny legalny proces.

**Powiązane:** [Issue #10](https://github.com/Zyczinho/city-route-app/issues/10) i [Issue #51](https://github.com/Zyczinho/city-route-app/issues/51). Brak zmian w runtime/social/planerze, brak ingerencji w migracje 003–013.
