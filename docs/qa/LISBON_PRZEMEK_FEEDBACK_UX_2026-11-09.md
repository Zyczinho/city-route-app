# Pilot Lizbona — feedback Przemka i kontrolowany eksperyment UX (2026-11-09)

**Status:** hipotezy z beta feedbacku, nie decyzje o przebudowie produkcji. **Właściciel strumienia:** ChatGPT, wyłącznie `assets/prototypes/lisbon-route-entry-compare.html`, `tests/lisbon-ux-prototype.test.js` i ten raport. Nie dotykać `app.js`, `index.html`, `styles.css`, `scripts/build.mjs`, `service-worker.js`, Supabase ani auth; drugi agent może równolegle obsługiwać inny zakres.

## Rzeczywisty feedback (screenshoty dostarczone przez właściciela)

1. **Trasa i menu:** tester widzi „Nowa trasa”, lecz konkurują z nią liczne inne opcje; sugeruje mniej decyzji na ekranie i prostszy dolny pasek.
2. **Społeczność / dzwonek:** tester uważa, że wejście przez dzwonek prowadzi do tego samego miejsca co dolna zakładka Społeczność; podejrzewa duplikację. Sprawdzić faktyczne deep linki i różnicę między centrum powiadomień a hubem społeczności.
3. **Karta miejsca:** duży obszar ocen, źródeł i wyjaśnień zanim użytkownik zobaczy zwięzłe „dlaczego warto”, czynności i opis miejsca. Plan drugiego, osobnego eksperymentu: zwięzłe podsumowanie + oceny w sekcji rozwijanej.
4. **Gęstość / mikrointerakcje:** tester prosi o mniejszą liczbę widocznych przycisków, hierarchię, mniej kliknięć, mikroanimacje i preferencje na początku planowania. To hipotezy do walidacji, nie automatyczna zgoda na usunięcie funkcji. Zachować redukcję ruchu i dostępność.

Interpretacja produktowa: „UX jak dla pięciolatka” przekładamy na **jasny następny krok, czytelny język i progresywne ujawnianie zaawansowanych funkcji**, nie infantylne etykiety ani rezygnację z mocy produktu.

## Po pierwsze — zweryfikowany stan pilota

Sprawdzenie read-only Supabase 2026-11-09: `lisbon` status `next`, **188 publicznych miejsc**, **0 publicznych tras**, **0 bezpośrednich `image_url`** w tabeli miejsc. Pośrednie, licencjonowane zdjęcia runtime mogą się pojawić, ale nie ma tu zmierzonego pokrycia. Migracje 020/021 aktywne. Historyczne uwagi o braku miasta w DB są nieaktualne.

Oznacza to: NIE pokazywać kart „top tras Lizbona” jako gotowych realnych tras. Można testować budowanie własnego planu z istniejących miejsc; nie udawać, że przykładowy zestaw przystanków to trasa wygenerowana przez bieżący algorytm.

## Eksperyment (zasady Emil Kowalski / `prototype`)

**Jedno pytanie:** jak najczytelniej zacząć nową trasę podczas pierwszych 30 sekund używania City Route?

- **Centrum — jedno miejsce, mocna hierarchia.** Sześć tabów i możliwość bezpośredniej eksploracji, ale silne pojedyncze CTA „Ułóż nową trasę”; wybór zainteresowań i czasu razem; ustawienia zaawansowane za `details`. Koszt: użytkownik nadal widzi wiele kierunków oraz 6 tabów.
- **Przewodnik — progresywne decyzje.** Cztery taby; jedno dominujące wejście „Ułóż moją trasę”; etap 1 preferencje → etap 2 czas → etap 3 propozycja. Koszt: więcej kroków zanim pojawi się plan; społeczność jest odkrywana kontekstowo, nie ma osobnego taba.

W obu przypadkach liczby/miejsca użyte tylko do nawigacyjnego demo, bez zapisu do Supabase, wykonywania autoryzacji lub udawania prognoz. **Plik prototypu ma mini-licznik kliknięć i czasu wykonywania zadania, lokalny w pamięci strony i bez wysyłki danych.** Nie jest to automatyczny eksperyment A/B na produkcji.

### Linki

- Samodzielny prototyp: `assets/prototypes/lisbon-route-entry-compare.html`. Dwie wersje za pickerem Emil: `?v=1` / `?v=2`, klawisze 1/2, strzałki lewo/prawo, R odtwarza.
- `scripts/build.mjs` już kopiuje cały `assets/`, więc plik zostanie opublikowany pod `/assets/prototypes/lisbon-route-entry-compare.html` **wyłącznie na preview gałęzi**, jeśli Cloudflare wystawi preview. Nie scalać eksperymentu do produkcji przed wyborem wariantu.
- Interaktywna kopia HTML może być też uruchomiona lokalnie bez serwera i logowania.

## Metodologia porównania — test zadaniowy, a nie konkurs upodobań

Zadanie dla Przemka i 2–4 innych osób: **„Jesteś w Lizbonie. Ułóż własny plan na 2 godziny, wybierając historię, a następnie zapisz propozycję”.** Użytkownik nie otrzymuje instrukcji, gdzie kliknąć.

Testuj A/B w naprzemiennej kolejności (połowa A→B, połowa B→A). Obserwuj:
- **Czy rozpoczął bez podpowiedzi?** (0/1)
- **Czas do znalezienia pierwszego kroku** (sekundy)
- **Ukończenie procesu** (0/1)
- **Kliknięcia, cofnięcia i nietrafione próby** (liczba; licznik prototypu jest tylko pomocniczy)
- **Poczucie jasności** 1–5 i „Co było niezrozumiałe?” zadane po obu wariantach
- **Dostępność** iPhone 13 Pro, 320/375/390px, dynamiczny tekst, VoiceOver, `prefers-reduced-motion`.

Nie wybierać na podstawie samego czasu: Przewodnik naturalnie ma dodatkowy krok, za to może zmniejszyć odsetek użytkowników, którzy się gubią.

## Oddzielne follow-upy, których TEN prototyp nie rozwiązuje

- Dzwonek: po kliknięciu ma prowadzić do dokładnej listy powiadomień, z jednoznaczną ścieżką powrotu do społeczności. Udokumentować realną nawigację i usunąć powtarzające się pozycje tylko, jeśli powielają tę samą funkcję.
- Karta miejsca: główny widok: nazwa, fotografia właściwego miejsca, wiarygodny krótki opis „dlaczego warto”, jeden widoczny CTA Zapisz / Dodaj do trasy. Dane źródłowe i szczegółowe oceny w rozwijanym widoku, a City Route rating pozostaje osobny (fioletowy).
- Pilot Przemka: prawdziwa próba w produkcji logowania, wyboru Lizbony, tworzenia trasy, zapisywania, propozycji publicznego miejsca i moderacji na drugim koncie. Test prototypu NIE dowodzi poprawności tych backendowych działań.

## Zweryfikowane technicznie / brakujące bramki

Lokalny Chromium Playwright uruchomił obie ścieżki kliknięć do „Zapisano w prototypie” przy 320/375/390/900/1280 px; brak poziomego overflow i błędów JS w przetestowanych przebiegach. Trzeba przejść GitHub CI w PR i ocenić faktyczny wygląd na iPhone Safari oraz feedback uczestników. Nadal brak użytkowej decyzji o zmianie docelowej nawigacji (RED w `AGENTS.md`).

**Po wyborze:** przenieść wybraną architekturę do realnych ekranów i usunąć prototyp z gałęzi zgodnie z zasadami `prototype` Emila, a następnie przetestować pełny City Route, zamiast scalić makietę jako aplikację.
