# City Route — Proposal C: pięć zakładek + kontekstowa Moja trasa (2026-11-09)

**Status:** prototyp do decyzji Product Ownera. Nie jest częścią działającej produkcji. Rozszerza izolowany eksperyment UX #167 i odpowiada na feedback Jakuba oraz Przemka.

## Główna zasada

**Oddzielamy zamiary użytkownika, nie każdą funkcję osobną zakładką.**

| Tab | Core user intent | Included | Deliberately excluded |
| --- | --- | --- | --- |
| **Start** | Stworzyć i kontynuować własną trasę | Wyraźne „Ułóż nową trasę”; krótki kontekst; kontynuacja aktywnego planu | Lista wszystkich tras miasta i dziesiątki filtrów |
| **Odkrywaj** | Znaleźć istniejącą trasę lub inspirację | Gotowe trasy redakcyjne, odkrycia społeczności, inspiracje; karta autora prowadząca do profilu | Generowanie jako drugie, konkurencyjne główne CTA; zarządzanie „Moją trasą” |
| **Miejsca** | Znaleźć, ocenić, porównać lub dodać miejsce | Wyszukiwarka, filtry, porównanie, karta, Dodaj miejsce, zapis, dodanie do trasy | Chat i aktualności społecznościowe |
| **Społeczność** | Skontaktować się z ludźmi i brać udział w ich aktywności | Znajomi i follow (oddzielnie), DM, czaty grupowe, wydarzenia i spacery społecznościowe, profile twórców oraz trasy publikowane przez nich | Ogólne, niepersonalne listy miejskich POI |
| **Profil** | Zarządzać sobą i swoimi zasobami | Ustawienia, prywatność, własne kolekcje, zapisane miejsca/trasy, historia | Duplikat hubu społecznościowego i głównego kreatora |

### Aktywna „Moja trasa”

Nie jest osobną szóstą zakładką. Po zebraniu przystanków pojawia się **pasek kontekstowy nad dolnym menu**, prowadzący do widoku planu. Przed utworzeniem planu pasek nie zajmuje miejsca. W Profilu pozostaje dostęp do **Moich tras i szkiców**, nawet jeżeli użytkownik nie ma aktywnego planu.

### Przyciskologia i hierarchia dla planu

1. **Start / kreator:** „Ułóż nową trasę”; do planu preferencje + czas; budżet/tempo/transport jako disclosure.
2. **Moja trasa** — dominujące „Rozpocznij trasę” (w realnej aplikacji dopiero po poprawnej walidacji odcinków/przystanków). Pod nim Zapisz i fioletowe Udostępnij.
3. **Więcej opcji:** otwarcie Map Google, eksport GPX, edycja, usunięcie, funkcje pomocnicze. Nie wystawiamy obok siebie sześciu wariantów tej samej operacji.
4. **Udostępnij** otwiera jeden arkusz kanałów, zamiast osobnych top-level przycisków WhatsApp/Messenger/Google; zachowuje rozróżnienie udostępniania City Route od zewnętrznego uruchomienia Google Maps.
5. Bell w nagłówku: bezpośrednie wejście do **Powiadomień** bez duplikowania sekcji Społeczność (zob. #168).

## Co jest faktem, a co pokazem

- Hosted Lisbon ma 188 publicznych POI, ale **0 opublikowanych tras**. Prototyp Odkrywaj jawnie pokazuje pusty stan, bez fikcyjnych autorów i rankingów.
- Wszelkie przykładowe POI w mocku są nazwami obecnymi w katalogu (Castelo de São Jorge, A Brasileira, Confeitaria Nacional, Torre de Belém, Museu Nacional do Azulejo). Karta miejsca nie wymyśla ocen.
- Demonstracyjne planowanie układa trzy punkty bez rzeczywistych czasów tras i bez sprawdzenia godzin otwarcia; nie wywołuje backendu, nie zapisuje danych użytkownika, nie generuje publicznych linków.
- Wersja C jest samodzielnym `assets/prototypes/city-route-navigation-5tabs.html`, obok wersji A/B z poprzedniego eksperymentu. Produkcyjne pliki aplikacji pozostają nietknięte.

## Kryteria wyboru

Do sprawdzenia w rzeczywistej wersji produktu lub przez użytkowników prototypu:
- Użytkownik znajduje „stwórz nową trasę” bez pomocy w pierwszych 10–15 s.
- Po utworzeniu planu bez pomocy odnajduje „Moja trasa”, Zapisz i Udostępnij.
- Wskazuje, gdzie znaleźć: czyjeś opublikowane trasy (Odkrywaj), wydarzenie znajomych (Społeczność), nową kawiarnię (Miejsca) i ustawienia (Profil).
- Rozumie różnicę między udostępnieniem planu a nawigacją zewnętrzną.
- 320/375/390 i iPhone 13 Pro bez najechania przycisków, z czytelnymi etykietami i działającym powrotem.

Test Chromium: w prototypie C przetestowano szerokości 320, 375, 390, 430, 1000; przejścia start→generator→moja trasa→zapis→udostępnianie, społeczność, karta miejsca i pasek kontekstowy, bez JS errors i poziomego overflow. **To nie jest dowód produkcyjnego działania na iOS Safari ani uzyskanych wyników A/B.**

## Następny etap

Po decyzji Jakuba przygotować osobny PR modyfikujący prawdziwy runtime: router/nav, aktywna trasa, dostępność, zachowanie Back, PWA cache, testy i review. Dostosować do już istniejących, otwartych PR #151/#154/#163; nie edytować tamtejszych plików w prototypie. Przekonwertować atrybuty A/B w realną obserwację (zadania, czas, pomyłki) u Przemka i 2–4 innych osób.

**Nie scalać prototypu jako ostatecznej implementacji UI bez decyzji produktowej.**
