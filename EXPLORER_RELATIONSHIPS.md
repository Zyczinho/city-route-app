# Relacje odkrywców — kontrakt produktu

**Znajomi** i **Obserwowani** to dwie niezależne relacje.

## Znajomi (istniejący backend)
- Dodaj do znajomych → zaproszenie oczekujące → akceptacja albo odrzucenie.
- Dostępne bezpośrednio z publicznego profilu autora i jego publicznej trasy.
- Stan: Dodaj do znajomych, Zaproszenie wysłane, Akceptuj zaproszenie, Znajomi.
- Nie wolno przedstawiać obserwowania jako przyjętej znajomości.

## Obserwowani (osobna funkcja do wdrożenia)
- Jeden użytkownik obserwuje drugiego bez akceptacji i bez wzajemności.
- Obserwowana osoba pojawia się w feedzie odkryć/tras obserwowanych; wzajemna relacja nie powstaje.
- Przy profilu autora i jego trasie znajdzie się Obserwuj/Obserwujesz; usuń obserwację jednym kliknięciem.
- Oddzielne liczniki Obserwujący, Obserwowani i Znajomi; liczba znajomych nigdy nie jest automatycznie zawyżana przez follow.
- Niezbędna jest nowa tabela follow (follower_id, followed_id, created_at, UNIQUE para, zakaz self-follow) z RLS zabezpieczającym INSERT/DELETE właściciela oraz jasnymi zasadami widoczności profili.
- Zmiana bazy **wymaga osobnego zatwierdzenia przez właściciela** i dwóch realnych kont do testu; nie zapisywać follow w tablicy friend_connections i nie udawać działania w lokalnym storage.

## Acceptance case: trasa Kuby w Krakowie
1. Otwórz społeczną trasę stworzoną przez Kubę w Krakowie.
2. Kliknij Dodaj do znajomych (konto zalogowane). Kuba widzi zaproszenie i może je zaakceptować. Dopiero wtedy oba konta są Znajomymi.
3. Kliknij profil autora. Stan zaproszenia pozostaje spójny z kartą trasy.
4. Docelowo naciśnij Obserwuj: zapis trwa po odświeżeniu i na drugim urządzeniu; Kuba nie staje się znajomym automatycznie.
