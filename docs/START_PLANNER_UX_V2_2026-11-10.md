# Start City Route — planner UX V2, decyzja produktowa 2026-11-10

## Cel
Użytkownik wybiera **jeden** z dwóch sposobów ułożenia trasy: generator na ekranie Start lub ręczne wybieranie przystanków w istniejącym `#my-route`. Nie tworzymy drugiego kreatora ani drugiego magazynu tras.

## Etap 1 — odnajdywanie ręcznego planowania (w PR)
- Widoczna alternatywa „Ułóż sam” **nad formularzem** prowadzi do `#my-route`.
- Gdy nie ma przystanków, głównym CTA w `#my-route` jest „Wybierz pierwsze miejsce” prowadzące do `#places`. Generator i gotowe trasy są wtórne.
- Istniejący flow Dodaj miejsce → Moja trasa → kolejność → zapisz pozostaje niezmieniony.
- Kontrolki muszą być dotykalne i działać po odświeżeniu i na małych ekranach.

## Etap 2 — semantyka preferencji (do wdrożenia w algorytmie, nie tylko w copy)
| Preferencja | Znaczenie | Warunek |
|---|---|---|
| Wszystko po trochu | balans różnych typów | domyślna mieszanka, nie łączyć jako dodatkowego filtra |
| Klasyka | charakterystyczne atrakcje, landmarki i architektura | preferencja, nie wyłączne ograniczenie |
| Kultura | muzea, sztuka, zabytki, historia | sprawdź typ i wejście do środka, jeśli wybrano |
| Zieleń | parki, ogrody, naturę | uwzględnij dostępność i godziny |
| Widoki | punkty widokowe, panoramy, nabrzeża | uwzględnij czas i ukształtowanie terenu |
| Jedzenie | miejsca kulinarne jako część celu trasy | NIE blokuj miejsc food gdy `food=none`; to pole ma znaczyć „nie wymagaj osobnego postoju na posiłek” |
| Nieoczywiste | ukryte perełki, lokalne miejsca, mniej oczywiste okolice | wymagane wiarygodne tagi; brak tagu ≠ hidden gem |

- Dodaj „Czego unikać?” jako opcjonalne twarde wykluczenia (np. muzea, parki, obiekty religijne, bary), z walidacją sprzecznych preferencji. Wykluczenie wygrywa z pozytywną preferencją.
- Dla każdej preferencji dodaj prosty opis widoczny po dotknięciu „Co oznaczają kategorie?” (bez tooltipów działających tylko po najechaniu myszą).
- Test: zmiana jednego ustawienia powinna w odpowiednio różnorodnym katalogu powodować mierzalną zmianę wyniku lub czytelny komunikat o braku pasujących miejsc.

## Etap 3 — tryb oglądania atrakcji
- Pytanie „Jak chcesz oglądać atrakcje?”: „Również wewnątrz” oraz „Tylko z zewnątrz”.
- Nie ograniczaj semantyki do muzeów. Rozróżniaj, czy dany POI oferuje wejście, zewnętrzny punkt widokowy, czas zwiedzania, koszt i dostępność.
- Dodać do danych miejsca właściwości typu `interiorAvailable`, `exteriorWorthVisiting`, `outsideMinutes`, `insideMinutes`, `admissionCost`, `hoursStatus`.
- Jeśli nie znamy godzin, pokazuj „niepotwierdzone”, nie deklaruj otwarcia. Jeśli zwiedzanie z zewnątrz jest bez sensu, nie proponuj muzeum jako fasady.

## Etap 4 — początek trasy
- „Skąd ruszasz?”: „Moja lokalizacja”, „Dowolnie”, „Wybierz punkt”.
- „Wybierz punkt” obsługuje adres, rozpoznawalne miejsce oraz ustawienie pinezki na mapie; obowiązkowy podgląd wybranego wyniku przed generacją.
- Reuse istniejącego geokodowania city-scoped przez Worker /api/place-search z neutralnym źródłem OSM; nie aktywować płatnych Google API samodzielnie.
- Rozpoznawanie miejsca musi dać współrzędne, etykietę, zgodność z wybranym miastem i błędy bez cichego fallbacku na `null`.
- Punkt początkowy wpływa na pierwszą nogę i dobór przystanków. W ręcznym kreatorze także powinien być widoczny jako początek trasy, nie dodatkowa atrakcja.

## Etap 5 — budżet
- Pozwól na dowolną, nieujemną wartość liczbową, z walutą z `city().currency` (Lizbona EUR, Warszawa/Kraków PLN); „Bez limitu” również pozostaje.
- Budżet nie może pozostać pustą etykietą: silnik uwzględnia sumę cen przystanków, wstępów i, gdy znane, posiłków/przejazdów.
- Dzisiaj koszty w katalogu często mają 0 lub `metadata.costUnknown=true`: 0 bez wiarygodnego źródła NIE oznacza rzeczywiście bezpłatnie. Podawaj zakres i niepewność, a nie pozornie ścisły „koszt”.
- Predefiniowane progi dopiero jako szybkie opcje, dopasowane do waluty/miasta; nie używaj stałego `25/100 zł` w Lizbonie.

## Etap 6 — transport
- Pieszo: szacunkowe przejścia i czas między przystankami.
- Rower: wykluczenia tras nieprzejezdnych i różne realne czasy, kiedy dostawca pozwala.
- Komunikacja: **nie tylko zamiana prędkości z 4,5 na 8 km/h**. Powinna korzystać z czasu dojścia do przystanku, czekania, przejazdów i przesiadek oraz zależeć od daty i godziny.
- Do czasu realnej macierzy przejazdów oznaczyć „czas orientacyjny, bez rozkładów” i nie nazywać trybu zoptymalizowanym pod transport.
- Mieszany: decyzja o transporcie dla każdej nogi, a nie umowna średnia prędkość.

## Zasada interfejsu i kryteria odbioru
1. Ekran początkowy pokazuje prosto czas + zainteresowania, resztę na żądanie.
2. Rozszerzone ustawienia opisują, jak filtr wpłynie na wynik; opcje nie mogą być dekoracją.
3. Po generacji pokaż podsumowanie przyjętych preferencji i przyczyny ograniczeń.
4. Testy iPhone / WebKit: 320, 375, 390 px, także użytkownik bez GPS, poza miastem, bez sieci i ze starym zapisem trasy.
5. A/B testy tras dla czasu 2 h/8 h, Klasyka vs Nieoczywiste, Jedzenie vs brak wymaganej przerwy, 0/50/własny budżet i wnętrza vs zewnątrz.
6. Każdą iterację zamyka test i deploy parity, bez otwierania nowych dużych gałęzi UX równolegle.

## Stan kodu 2026-11-10
- `ux-cleanup.js` usuwał widoczny link do ręcznego buildera i zamieniał go na „Odkrywaj miejsca”; etap 1 to naprawia.
- `route-planner-v2.js` ma bezwzględną blokadę `food='none'` dla food POI i tylko `low=25, medium=100`.
- `app.js` kieruje transit do generatora V1, który nie korzysta z rozkładów; `core.js` używa szybkości 8 km/h jako proxy.
- `opening-hours.js` sprawdza godziny tylko dla wybranych muzeów.
- Powyższe etapy 2–6 są **specyfikacją**, nie ukończoną implementacją.

## Aktualizacja — Start V3 (audyt planera 2026-11-10)
Po audycie (ADR-012, ADR-013) Start pyta tylko o rzeczy, które zmieniają plan: zainteresowania, czas, datę i godzinę (widoczne od razu), a w „Więcej ustawień” o transport, start, przerwę na kawę i wykluczenia. Usunięte pytania: „Jak ściśle dobrać miejsca?”, „Jak chcesz oglądać atrakcje?”, „Styl zwiedzania”, „Jeszcze dokładniej”, zablokowane oferty partnerów i transport „Mieszany”. Wybrane kategorie znaczą „tylko te”, a gdy brakuje miejsc, trasa jest krótsza i proponuje „Uzupełnij po drodze”. Chipy pokazujemy tylko wtedy, gdy miasto ma co najmniej 5 pasujących miejsc. Godziny otwarcia pochodzą z OpenStreetMap; zamknięte kategorie dostają propozycję godziny („Zacznij o 23:00”), a trasy wieczorne mogą trwać po północy.
