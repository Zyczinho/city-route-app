# City Route — oceny i feedback (REVIEWS-027)

Status: implementacja w osobnym PR, **bez wdrożonej migracji 016**.

## Trzy źródła ocen — bez mieszania wyników
- **Google Maps i Tripadvisor**: zewnętrzna średnia i liczba opinii pochodzą tylko z danych dostarczonych przez legalnie używane oficjalne API lub wcześniej zweryfikowane źródło. Istniejący wynik ważony liczbą opinii pozostaje oparty **wyłącznie** na tych dwóch serwisach. Normalizator `review-source-model.js` mapuje wyłącznie metadane liczbowych ocen z autoryzowanych odpowiedzi API.
- **City Route**: osobna liczba opinii i średnia z naszych użytkowników oraz osobne sortowanie. Dopuszczamy wyświetlanie od pierwszej oceny, ale stosujemy stabilizację rankingu: `(suma gwiazdek + 20 * 4.0) / (liczba ocen + 20)`, by jedna pojedyncza ocena nie dominowała. Nie wliczamy wyniku City Route do średniej Google/Tripadvisor.
- **Komentarze**: tekstowe uwagi o trasie są prywatne i dostępne wyłącznie autorowi trasy. Dane osobowe osoby oceniającej nie są zwracane w odczycie autora.

## Przepływ MVP
1. Przy kliknięciu „Jestem tu, dalej” użytkownik może ocenić przystanek 1–5 lub pominąć ocenę. Ocena zapisywana jest na urządzeniu, nawet bez konta.
2. Po zalogowaniu aplikacja próbuje zsynchronizować tę ocenę z własną bazą City Route. Jedno konto może mieć maksymalnie jedną aktualną ocenę danego miejsca, którą można zmienić. Ocena oznaczona `visit_verified=false`: **nie potwierdzamy jeszcze fizycznej obecności**.
3. Zapytanie `city_route_place_scores` zwraca oddzielne zbiorcze średnie, liczbę ocen i indeks do sortowania, bez tekstowych opinii ani danych autora. Publiczny katalog nadal wyświetla średnią z Google/Tripadvisor osobno.
4. Użytkownik ocenia trasę innego autora gwiazdkami 1–5. Następnie może dodać prywatny feedback do 500 znaków; właściciel widzi wiadomości, ale nie dane osobowe oceniających.
5. Po ukończeniu trasy dostępny jest wyraźny przycisk publikowania dokładnie przebytej listy przystanków, bez zastępowania ręcznie ułożonego koszyka.

## Ograniczenia integracji zewnętrznych
- **NIE twierdzimy, że automatyczny import Google i Tripadvisor już działa.** `review-source-model.js` to adapter danych, nie konektor pobierający dane. Potrzebujemy autoryzowanych dostępów, identyfikatorów miejsc dostawców, serwerowej synchronizacji, kontroli kosztów i warunków licencyjnych/dla EOG.
- Nie zapisujemy hurtowo tekstów recenzji z platform zewnętrznych. Własnych ocen użytkowników nie prezentujemy jako ocen Google lub Tripadvisor.
- Nie istnieje jeszcze wiarygodne potwierdzanie obecności. Do tego będzie odrębny system (np. kontrola położenia z uwzględnieniem dokładności, opóźnienia, świadomej zgody i zabezpieczenia przed nadużyciami).

## Migracja i wydanie
1. PR #60 i migracja 014 (wspólna baza miejsc) pozostają do zintegrowania i osobnego zatwierdzenia.
2. PR #66 i migracja 015 (Znajomi + unikatowe nicki) pozostają do zintegrowania i osobnego zatwierdzenia.
3. Ten PR i migracja 016 (oceny City Route + feedback tras) **nie mogą być scalone z produkcyjnym UI przed migracją bazy i testami RLS**.
4. Przed wydaniem: test w izolowanym PostgreSQL, dwa odrębne konta, ocena/czytelność/edytowanie, sortowanie tylko własną oceną, brak wpływu na Google/Tripadvisor, dostęp autora do prywatnego feedbacku i brak dostępu osoby postronnej, powrót PWA po aktualizacji.
