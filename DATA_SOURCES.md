# Źródła danych — stan na 2 listopada 2026

Ten plik mówi wprost, skąd pochodzi każda liczba i każde zdjęcie w City Route, czego brakuje i jaka jest realna droga do danych na żywo.

## Skąd pochodzą miejsca

50 miejsc i 30 side questów wybrała redakcja (poprzednie sesje budowy prototypu). To lista startowa, nie ranking „najlepszych”. Miejsc ani ocen nie wymyślaliśmy: każde miejsce zostało odnalezione w Google Maps, a 47 z 50 także na Tripadvisor. Side questy (np. „Zauważ detale”) to pomysły redakcji City Route i aplikacja tak je oznacza.

## Oceny

| Źródło | Jak zebrane | Pokrycie |
| --- | --- | --- |
| Google Maps | Ocena i liczba opinii odczytane ręcznie z panelu miejsca w Google Maps (przeglądarka), 2.11.2026. Przy okazji poprawiliśmy współrzędne. | 45 z 50 miejsc |
| Tripadvisor | Ocena i liczba opinii strony obiektu pokazane w wynikach wyszukiwarki dla adresu tej strony (bez scrapowania samego Tripadvisor). | 47 z 50 miejsc |
| GetYourGuide | Nie podłączone. | 0 |
| Atlas Obscura | Nie podłączone. | 0 |
| Społeczność City Route | Nie wliczana. Twoja prywatna ocena zostaje na urządzeniu. | 0 |

Braki, które pokazujemy jako „brak” i nie wliczamy:

- Google nie ma ocen dla adresów: Rynek Starego Miasta, Rynek Nowego Miasta, Nowy Świat, Ząbkowska, Francuska. Tripadvisor ma oceny dla czterech z nich, więc te miejsca dostają wynik z Tripadvisor (to dokładnie ten przypadek „słabe w jednym serwisie, mocne w drugim”).
- Tripadvisor: ul. Francuska (brak strony), Elektrownia Powiśle (strona bez widocznej oceny), Freya Cafe Koneser (strona bez opinii).
- Ulica Francuska nie ma oceny na żadnej platformie — aplikacja pisze „Brak ocen”.

Uwagi o dokładności:

- To migawka. Liczby opinii rosną codziennie, więc w aplikacji stoi data sprawdzenia.
- Liczby z Tripadvisor pochodzą z indeksu wyszukiwarki i mogą być o kilka dni lub tygodni starsze niż na stronie.
- Kilka miejsc ma na Tripadvisor mało opinii (np. Concept 3, Spółdzielnia 6, Azia Koneser 13). Przy wyniku ważonym liczbą opinii prawie nie zmieniają wyniku z Google, ale są widoczne osobno.
- Azia ma na Tripadvisor dwie strony. Użyliśmy strony filii przy Placu Konesera 4 (13 opinii), nie strony z 2150 opiniami, której adres to Al. Jana Pawła II.
- Sapko ma kilka lokali. Użyliśmy lokalu przy Al. Jana Pawła II 46 (Google) i strony Sapko Kebab Muranów (Tripadvisor).

### Jak liczymy wynik łączny

Średnia ważona liczbą opinii: suma (ocena × liczba opinii) / suma opinii. Każda opinia waży tyle samo, niezależnie od platformy. Przykład: Restauracja Stary Dom — Google 4,7 (11 781) i Tripadvisor 4,6 (2 270) → 4,68 z 14 051 opinii. Karta zawsze pokazuje też obie liczby osobno.

Konsekwencja: Google zwykle ma kilka razy więcej opinii, więc dominuje. Jeśli wolisz dać obu platformom równy głos, wystarczy zmienić jedną funkcję (`combinedRating` w `core.js`) — to decyzja produktowa do podjęcia.

## Zdjęcia

- 41 zdjęć z Wikimedia Commons (CC0 / CC BY / CC BY-SA / domena publiczna), autor i licencja przy każdym zdjęciu.
- 4 zdjęcia z Pexels (licencja Pexels).
- 5 lokali (Stary Dom, Der Elefant, Sapko, Concept, Koneser Grill) — zdjęcie ładowane z oficjalnej strony lokalu. **Przed publicznym startem trzeba mieć zgodę lokalu** albo podmienić zdjęcie.
- Azia, Freya, Spółdzielnia pokazują budynek Konesera, EFES — ulicę Francuską. Podpis to mówi.
- Nie kopiujemy zdjęć z Google ani Tripadvisor: należą do autorów i licencja platform nie pozwala ich przenosić.

## Co blokuje dane na żywo i realna droga

Nie ma tu żadnych kluczy API ani płatnych planów. Nic nie zostało podłączone na żywo.

1. **Google Places API (New)** — daje ocenę, liczbę opinii i zdjęcia miejsca. Wymaga projektu Google Cloud z włączonym rozliczeniem (karta), płatne za zapytanie z miesięcznym darmowym limitem. Regulamin: trzeba pokazać atrybucję Google; poza identyfikatorem miejsca (place ID) treści nie wolno trwale przechowywać, więc ocenę pobiera się na bieżąco, a nie kopiuje do bazy. Klucz musi być ukryty po stronie serwera (np. Cloudflare Worker), nie w repo.
2. **Tripadvisor Content API** — ocena, liczba opinii, link, kilka opinii. Wymaga rejestracji i klucza, ma darmowy miesięczny limit wywołań i wymagania wyświetlania (logo, link do Tripadvisor). Do sprawdzenia w ich regulaminie przed startem: czy wolno łączyć ich ocenę z inną w jeden wynik. To ryzyko dla „wyniku łącznego”.
3. **GetYourGuide** — program partnerski (afiliacja): linki i widżety z biletami; API partnerskie po akceptacji.
4. **Atlas Obscura** — brak publicznego API; teksty są chronione. Realnie: link do ich strony albo umowa.
5. **Scrapowanie** Google i Tripadvisor łamie ich regulaminy i brief tego zabrania. Obecna migawka to ręczny odczyt na potrzeby prywatnego prototypu. Do publicznej wersji: API powyżej albo ręczne odświeżanie z datą i linkiem do źródła, po sprawdzeniu regulaminów.

Proponowana kolejność: (1) Google Places przez Cloudflare Worker z kluczem w zmiennych środowiska, (2) Tripadvisor Content API po potwierdzeniu zasad łączenia ocen, (3) GetYourGuide jako „Kup bilet” (monetyzacja z briefu), (4) społeczność, gdy będą prawdziwi użytkownicy.

## Tabela miejsc

| Miejsce | Google (ocena, opinie) | Tripadvisor (ocena, opinie) | Zdjęcie |
| --- | --- | --- | --- |
| Rynek Starego Miasta | brak | 4.5 (4874) | Wikimedia Commons: Matis23 (CC BY 3.0) |
| Zamek Królewski i Plac Zamkowy | 4.7 (60179) | 4.3 (2744) | Pexels: Pexels (Pexels License) |
| Barbakan Warszawski | 4.7 (11216) | 4.2 (1135) | Pexels: Pexels (Pexels License) |
| Rynek Nowego Miasta | brak | 3.8 (120) | Wikimedia Commons: Kapitel (CC BY-SA 4.0) |
| Multimedialny Park Fontann | 4.7 (46476) | 4.2 (603) | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Ogród Biblioteki Uniwersyteckiej | 4.8 (7139) | 4.5 (794) | Pexels: Pexels (Pexels License) |
| Centrum Nauki Kopernik | 4.6 (58854) | 4.4 (3152) | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Bulwary Wiślane | 4.7 (14483) | 4.2 (65) | Wikimedia Commons: Qkiel (CC BY-SA 4.0) |
| Syrenka na Powiślu | 4.8 (12365) | 3.4 (5) | Wikimedia Commons: M.Komorniczak (CC BY-SA 3.0) |
| Łazienki Królewskie | 4.8 (98364) | 4.7 (8774) | Wikimedia Commons: Krzysztof Popławski (CC BY 4.0) |
| Pałac na Wyspie | 4.8 (22341) | 4.5 (950) | Wikimedia Commons: Aw58 (CC BY 4.0) |
| Pomnik Chopina | 4.8 (14459) | 4.4 (1278) | Wikimedia Commons: A.Osytek (CC BY-SA 3.0 pl) |
| Zamek Ujazdowski | 4.6 (4379) | 3.9 (32) | Wikimedia Commons: Chris Olszewski (CC BY-SA 4.0) |
| Park Ujazdowski | 4.7 (8589) | 4.4 (98) | Wikimedia Commons: Emptywords (CC BY-SA 4.0) |
| Ogród Saski | 4.7 (29079) | 4.4 (580) | Wikimedia Commons: Marcin Białek (CC BY-SA 3.0) |
| Grób Nieznanego Żołnierza | 4.8 (8752) | 4.4 (1237) | Wikimedia Commons: Patryk Duszkiewicz (CC BY-SA 4.0) |
| Pałac Kultury i Nauki | 4.6 (87429) | 4.1 (5375) | Pexels: Pexels (Pexels License) |
| Nowy Świat | brak | 4.4 (2151) | Wikimedia Commons: Maksym Kozlenko (CC BY-SA 4.0) |
| Muzeum Fryderyka Chopina | 4.5 (6994) | 3.9 (1184) | Wikimedia Commons: Scotch Mist (CC BY-SA 4.0) |
| Muzeum Narodowe | 4.6 (23084) | 4.2 (673) | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Katedra św. Floriana | 4.7 (3241) | 4.4 (52) | Wikimedia Commons: Simon Burchell (CC BY-SA 4.0) |
| Ulica Ząbkowska | brak | 3.1 (14) | Wikimedia Commons: geo573 (CC BY 3.0) |
| Centrum Praskie Koneser | 4.7 (9896) | 4.5 (46) | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Park Skaryszewski | 4.7 (16141) | 4.5 (81) | Wikimedia Commons: Andrzej Błaszczak (CC BY-SA 4.0) |
| Ulica Francuska | brak | brak | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Most Świętokrzyski | 4.7 (2665) | 4.0 (38) | Wikimedia Commons: Qkiel (CC BY-SA 4.0) |
| Hala Koszyki | 4.6 (25153) | 4.4 (770) | Wikimedia Commons: Jakub Dziubak jackuback (CC0) |
| Hala Mirowska | 4.4 (9924) | 4.1 (167) | Wikimedia Commons: tawa (CC BY-SA 3.0) |
| Elektrownia Powiśle | 4.7 (19970) | brak | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Pałac w Wilanowie | 4.7 (31434) | 4.5 (1868) | Wikimedia Commons: Kulawik.pl (CC BY-SA 4.0) |
| Restauracja Stary Dom | 4.7 (11781) | 4.6 (2270) | oficjalna strona: restauracjastarydom.pl (zdjęcie ze strony lokalu) |
| Der Elefant | 4.6 (15007) | 4.3 (1724) | oficjalna strona: derelefant.com (zdjęcie ze strony lokalu) |
| Hotel Polonia Palace | 4.7 (3667) | 4.6 (3574) | Wikimedia Commons: WeronikaPawlak (CC BY-SA 4.0) |
| Hotel Bristol | 4.7 (3716) | 4.6 (2827) | Wikimedia Commons: Diego Delso (CC BY-SA 3.0) |
| Sapko Kebab | 4.3 (17899) | 3.9 (57) | oficjalna strona: sapkokebab.com (zdjęcie ze strony lokalu) |
| EFES — Francuska | 4.3 (9861) | 4.3 (195) | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| U Fukiera | 4.0 (4784) | 3.9 (1648) | Wikimedia Commons: Аимаина хикари (CC0) |
| Koneser Grill | 4.7 (1027) | 4.5 (75) | oficjalna strona: koneser.eu (zdjęcie ze strony lokalu) |
| Azia Koneser | 4.7 (2323) | 5.0 (13) | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Concept Food & Wine | 4.6 (550) | 5.0 (3) | oficjalna strona: conceptfoodandwine.pl (zdjęcie ze strony lokalu) |
| Freya Cafe & Deli | 4.5 (348) | brak | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Spółdzielnia.Koneser | 4.6 (1365) | 4.0 (6) | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Raffles Europejski Warsaw | 4.8 (2045) | 4.8 (448) | Wikimedia Commons: Patryk Duszkiewicz (CC BY-SA 4.0) |
| Nobu Hotel Warsaw | 4.4 (1561) | 4.4 (309) | Wikimedia Commons: Wistula (CC BY-SA 4.0) |
| InterContinental Warszawa | 4.7 (9016) | 4.6 (4104) | Wikimedia Commons: Fred Romero from Paris, France (CC BY 2.0) |
| PURO Warszawa Centrum | 4.7 (2157) | 4.8 (977) | Wikimedia Commons: Wistula (CC BY-SA 4.0) |
| Sofitel Warsaw Victoria | 4.7 (8113) | 4.6 (5356) | Wikimedia Commons: Adrian Grycuk (CC BY-SA 3.0 pl) |
| Novotel Warszawa Centrum | 4.5 (18771) | 4.1 (6803) | Wikimedia Commons: Petroniusz (CC BY-SA 3.0) |
| The Westin Warsaw | 4.6 (5123) | 4.4 (2894) | Wikimedia Commons: Masti (CC BY-SA 4.0) |
| Hilton Warsaw City | 4.5 (7494) | 4.4 (2884) | Wikimedia Commons: Panek (CC BY-SA 4.0) |

## Jak zebrać dużo więcej miejsc (stan na 2 listopada 2026)

**Google Maps.** Masowe pobieranie miejsc z Google jest możliwe tylko przez Google Places API (wyszukiwanie tekstowe i „w pobliżu”). Warunki: klucz i rozliczenie w Google Cloud; regulamin pozwala trwale zapisać u nas tylko identyfikator miejsca (place ID), a ocenę, liczbę opinii i zdjęcia trzeba pobierać na bieżąco i podpisać jako Google. Realny model: nasz katalog trzyma place ID + naszą kategorię, a Cloudflare Worker z kluczem w zmiennych środowiska dociąga resztę na żywo. Scrapowanie Google jest zabronione.

**OpenStreetMap.** Darmowa i legalna droga do setek miejsc od razu (licencja ODbL: wolno zapisać, trzeba podpisać „© OpenStreetMap”). Daje nazwę, współrzędne, typ, często godziny otwarcia i stronę www, ale bez ocen i zdjęć. Typ z OSM pozwala trzymać ścisły podział: muzeum → Muzea, zabytek → Zabytki, park/ogród → Parki i ogrody, restauracja/kawiarnia → Jedzenie, hotel → Noclegi.

**Rekomendacja:** OpenStreetMap jako szeroka baza miejsc (z jedną kategorią wynikającą z typu), Google Places API dla ocen na żywo, Tripadvisor Content API jako druga ocena, a nasza redakcja jako wybór „Must-see” i side questy.

## Miejsca dodane przez użytkowników

Od tej wersji użytkownik może dodać własne miejsce (nazwa, jedna kategoria, opis, lokalizacja z GPS albo z linku Google Maps, opcjonalne zdjęcie). Zapisuje się tylko w jego przeglądarce, bez ocen. Żeby inni je zobaczyli, potrzebny jest serwer z bazą (np. Cloudflare D1) i moderacja; tego jeszcze nie ma.

## Wydarzenia

- **Globalne:** Ticketmaster Discovery API przez Cloudflare Worker (`worker.js` → `/api/events`, odpowiedź zapamiętywana na godzinę). Klucz wpisuje właściciel w Cloudflare jako sekret `TICKETMASTER_API_KEY`; bez klucza lista jest pusta i aplikacja mówi to wprost. Opcjonalny `TICKETMASTER_AFFILIATE` (szablon linku z Impact zawierający `{url}`) zamienia „Kup bilet” na link partnerski.
- **Następne źródła:** Going. (program partnerski w sieci Tradedoubler — do potwierdzenia przy zgłoszeniu, czy daje listę wydarzeń), AleBilet (4% prowizji według ich strony), KupBilecik. Bez zgody źródła nie pobieramy danych z ich stron.
- **Społecznościowe:** tylko od zweryfikowanych użytkowników (konto + telefon, nowi organizatorzy po kilku ukończonych trasach, zgłaszanie i blokowanie, 18+ przy alkoholu). Wymaga kont i serwera; do tego czasu nie pokazujemy przykładowych spotkań.
