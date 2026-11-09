-- P0 Lisbon editorial seed: add exactly 3 authentic City Route editorial itineraries.
-- Generated from reviewed JSON content, 2026-11-09; **not** a community submission or field-test claim.
-- Deliberately non-destructive: never DELETE existing places, user routes, saves, ratings or stops.
-- The city, 188 OSM-imported places and related source IDs must already exist (migrations 020/021).
-- This is a DATA seed; deployment and hosted smoke are a separate verified release step.
DO $seed$
DECLARE
  v_city uuid;
  v_route uuid;
  v_place uuid;
  v_stop text;
  v_position integer;
  v_place_row jsonb;
  v_route_row jsonb;
  v_actual integer;
BEGIN
  SELECT id INTO v_city FROM public.cities WHERE slug='lisbon';
  IF v_city IS NULL THEN RAISE EXCEPTION 'Lisbon registry missing'; END IF;

  -- Existing 19 source-attributed OSM entries: enrich only blank editorial copy, preserve user edits and provider provenance.
  FOR v_place_row IN SELECT value FROM jsonb_array_elements($curated$[{"id":"osm-node-2537090840","description":"Historyczny lokal na Graça związany z życiem literackim Lizbony. Przystanek na napój lub niewielką przekąskę przed kolejnym widokiem.","area":"Graça","minutes":40},{"id":"osm-node-4405500089","description":"Tradycyjny bar blisko nabrzeża w Cais do Sodré. Krótki przystanek w drodze przez nocne centrum.","area":"Cais do Sodré","minutes":35},{"id":"osm-node-2501836314","description":"Kameralny koktajlbar ze stylowym wnętrzem. Dobry początek wieczoru przed przejściem przez nocne dzielnice miasta.","area":"Príncipe Real","minutes":60},{"id":"osm-node-3094976712","description":"Popularny bar w sercu Bairro Alto, odpowiedni na dalszą część wieczoru po muzyce i pierwszym koktajlu.","area":"Bairro Alto","minutes":50},{"id":"osm-node-4433136691","description":"Historyczna cukiernia przy Praça da Figueira. Zacznij dzień od portugalskiego wypieku i kawy przed spacerem przez centrum.","area":"Baixa / Praça da Figueira","minutes":40},{"id":"osm-node-2501836316","description":"Klub znany z nocnych występów drag i tanecznej atmosfery. Warto dotrzeć późno, kiedy zaczyna się część klubowa.","area":"Príncipe Real","minutes":90},{"id":"osm-way-1382432568","description":"Zamek na wzgórzu oferuje rozległe widoki na dachy historycznej Lizbony. Zaplanuj czas na dziedzińce i wejście przed zamknięciem.","area":"Alfama / Castelo","minutes":70},{"id":"osm-way-152327819","description":"Monument nad Tagiem poświęcony epoce odkryć. Zobacz sylwetki postaci historycznych i panoramę szerokiego nabrzeża.","area":"Belém","minutes":25},{"id":"osm-way-24341353","description":"Fortyfikacja nad Tagiem, jeden z symboli portugalskich odkryć geograficznych. Nawet bez wejścia do środka warto obejrzeć ją od nabrzeża.","area":"Belém","minutes":30},{"id":"osm-relation-11381632","description":"Muzeum sztuki, architektury i technologii w efektownym budynku nad rzeką. Możesz wybrać wystawę lub spacerować wzdłuż nabrzeża.","area":"Belém","minutes":60},{"id":"osm-node-1802158801","description":"Niewielki lokal związany z fado w Bairro Alto. Zajrzyj na wieczorne występy, ale wcześniej potwierdź program i możliwość wejścia.","area":"Bairro Alto","minutes":65},{"id":"osm-node-4848686224","description":"Pub w okolicy Cais do Sodré, łączący klimat irlandzkiego baru z koncertami i wydarzeniami muzycznymi zależnymi od programu.","area":"Cais do Sodré","minutes":55},{"id":"osm-node-4813682932","description":"Kameralna tawerna w Alfamie, w której tradycja fado łączy się z kolacją. Niewielka przestrzeń sprawia, że warto wcześniej sprawdzić dostępność.","area":"Alfama","minutes":90},{"id":"osm-node-4808145123","description":"Niewielka tradycyjna restauracja znana z prostego portugalskiego jedzenia. Dobre miejsce na niespieszny lunch; godziny bywają ograniczone.","area":"Mouraria","minutes":65},{"id":"osm-node-5446794770","description":"Taras widokowy ponad Alfamą z dachami dzielnicy i Tagiem w tle. Dobry finał spaceru po wąskich uliczkach.","area":"Alfama","minutes":20},{"id":"osm-node-419313189","description":"Rozległa panorama centrum i zamku z tarasu widokowego. Dobry pierwszy punkt widokowy podczas kulinarnego spaceru.","area":"Bairro Alto","minutes":25},{"id":"osm-node-5446794764","description":"Spokojny punkt widokowy ukryty między Graça a Anjos. Pozwala zobaczyć mniej pocztówkową, północną część miasta.","area":"Penha de França / Anjos","minutes":25},{"id":"osm-node-4771391278","description":"Mniej zatłoczony taras na zboczu ponad Avenida da Liberdade. Warto odpocząć tu po schodach i obejrzeć miasto z innej perspektywy.","area":"Torel","minutes":25},{"id":"osm-relation-19112367","description":"Popularny taras widokowy przy kościele na Graça, z panoramą centrum miasta. Szczególnie przyjemny w miękkim popołudniowym świetle.","area":"Graça","minutes":25}]$curated$::jsonb)
  LOOP
    UPDATE public.places p SET
      description = CASE WHEN p.description='' THEN v_place_row->>'description' ELSE p.description END,
      area = CASE WHEN p.area='' THEN v_place_row->>'area' ELSE p.area END,
      minutes = CASE WHEN p.description='' THEN (v_place_row->>'minutes')::integer ELSE p.minutes END,
      metadata = jsonb_set(p.metadata,'{editorial}', '{"status":"desk-researched","reviewedAt":"2026-11-09","fieldTested":false}'::jsonb,true)
    WHERE p.city_id=v_city AND p.slug=v_place_row->>'id'
      AND p.metadata->'source'->>'provider'='openstreetmap';
    IF NOT FOUND THEN RAISE EXCEPTION 'Expected OSM place missing or wrong provenance: %',v_place_row->>'id'; END IF;
  END LOOP;

  -- Four missing classic Lisbon landmarks, with independent editorial provenance.
  FOR v_place_row IN SELECT value FROM jsonb_array_elements($extra$[{"id":"editorial-lisbon-jeronimos","name":"Mosteiro dos Jerónimos","lat":38.697775,"lng":-9.20658,"categoryId":"religious_site","area":"Belém","description":"Monumentalny klasztor manueliński i obiekt światowego dziedzictwa UNESCO. Wizyta wewnątrz pozwala poznać portugalską epokę odkryć.","minutes":85,"cost":0,"tourist":"must","foodStyle":"none","partner":false,"top":true,"tags":["culture","sightseeing"],"ratings":[],"metadata":{"source":{"provider":"editorial","url":"https://mosteirojeronimos.torrebelem.gov.pt/en/mosteiro-dos-jeronimos"},"costUnknown":true,"editorial":{"status":"desk-researched","reviewedAt":"2026-11-09","fieldTested":false,"entryPaid":true}},"website":"https://mosteirojeronimos.torrebelem.gov.pt/"},{"id":"editorial-lisbon-praca-comercio","name":"Praça do Comércio","lat":38.707616,"lng":-9.13649,"categoryId":"landmark","area":"Baixa","description":"Reprezentacyjny plac otwierający historyczne centrum na Tag. Jeden z najbardziej rozpoznawalnych punktów miejskiego spaceru.","minutes":20,"cost":0,"tourist":"must","foodStyle":"none","partner":false,"top":true,"tags":["culture","sightseeing"],"ratings":[],"metadata":{"source":{"provider":"editorial","url":"https://imovel.patrimoniocultural.gov.pt/detalhes.php?code=70275"},"costUnknown":true,"editorial":{"status":"desk-researched","reviewedAt":"2026-11-09","fieldTested":false}}},{"id":"editorial-lisbon-arco-rua-augusta","name":"Arco da Rua Augusta","lat":38.70844,"lng":-9.13682,"categoryId":"landmark","area":"Baixa","description":"Łuk triumfalny łączący Praça do Comércio z pieszą Rua Augusta. Można obejrzeć go z poziomu placu lub osobno odwiedzić płatny punkt widokowy.","minutes":15,"cost":0,"tourist":"must","foodStyle":"none","partner":false,"top":true,"tags":["culture","sightseeing"],"ratings":[],"metadata":{"source":{"provider":"editorial","url":"https://www.visitlisboa.com/en/places/arco-da-rua-augusta"},"costUnknown":true,"editorial":{"status":"desk-researched","reviewedAt":"2026-11-09","fieldTested":false}}},{"id":"editorial-lisbon-se","name":"Sé de Lisboa","lat":38.709825,"lng":-9.132641,"categoryId":"religious_site","area":"Alfama / Sé","description":"Historyczna katedra w sercu starej Lizbony, z romańską fasadą i wielowiekową historią. Naturalny przystanek na podejściu do zamku.","minutes":25,"cost":0,"tourist":"must","foodStyle":"none","partner":false,"top":true,"tags":["culture","sightseeing"],"ratings":[],"metadata":{"source":{"provider":"editorial","url":"https://imovel.patrimoniocultural.gov.pt/detalhes.php?code=70502"},"costUnknown":true,"editorial":{"status":"desk-researched","reviewedAt":"2026-11-09","fieldTested":false}}}]$extra$::jsonb)
  LOOP
    INSERT INTO public.places(
      city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,
      tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata
    ) VALUES (
      v_city,v_place_row->>'id',v_place_row->>'id',v_place_row->>'name',v_place_row->>'categoryId',
      extensions.st_point((v_place_row->>'lng')::float8,(v_place_row->>'lat')::float8)::extensions.geography,
      v_place_row->>'area',v_place_row->>'description',(v_place_row->>'minutes')::integer,0,'EUR',
      v_place_row->>'tourist',v_place_row->>'foodStyle',false,coalesce((v_place_row->>'top')::boolean,false),
      'public','published',null,'{}'::jsonb,v_place_row->'metadata'
    ) ON CONFLICT(city_id,slug) DO NOTHING;
    SELECT p.id INTO v_place FROM public.places p
      WHERE p.city_id=v_city AND p.slug=v_place_row->>'id'
      AND p.metadata->'source'->>'provider'='editorial';
    IF v_place IS NULL THEN RAISE EXCEPTION 'Editorial slug conflict %',v_place_row->>'id'; END IF;
    INSERT INTO public.place_tags(place_id,tag)
      SELECT v_place,t.value FROM jsonb_array_elements_text(v_place_row->'tags') AS t(value)
      ON CONFLICT DO NOTHING;
  END LOOP;

  -- Upsert only our three editorial slugs; preserve route UUIDs and user saves.
  FOR v_route_row IN SELECT value FROM jsonb_array_elements($routes$[{"id":"lisbon-after-dark-bars-clubs","name":"Lizbona po zmroku: bary, fado i klub","description":"Zacznij od kameralnego koktajlu w Príncipe Real, poczuj życie Bairro Alto i Cais do Sodré, a noc zakończ na parkiecie. Najlepiej w piątek lub sobotę.","transport":"mix","cats":["lokalnie","nightlife"],"stops":["osm-node-2501836314","osm-node-1802158801","osm-node-3094976712","osm-node-4405500089","osm-node-4848686224","osm-node-2501836316"],"durationMinutes":480,"timeWindow":{"start":"19:00","end":"03:00","spansMidnight":true},"recommendedDays":["fri","sat"],"routeType":"editorial","editorialStatus":"desk-researched","authorLabel":"City Route","warnings":["Wieczorne występy fado i koncerty zależą od programu; potwierdź wydarzenie.","Ostatni przejazd z Cais do Sodré do Príncipe Real najlepiej zaplanować osobno.","Ostatnia część trasy jest dla pełnoletnich i może wymagać biletu do klubu."],"stopNotes":{"osm-node-2501836314":"Pierwszy koktajl w barze z klasycznym wnętrzem — dobry start przed spacerem.","osm-node-1802158801":"Sprawdź, czy tego wieczoru odbywa się sesja fado; lokal bywa pełny.","osm-node-3094976712":"Przenieś się w gwarną atmosferę barowego Bairro Alto.","osm-node-4405500089":"Zejdź w kierunku Cais do Sodré i zatrzymaj się w tradycyjnym barze.","osm-node-4848686224":"Pubowy etap z muzyką — program wydarzeń sprawdź przed wejściem.","osm-node-2501836316":"Finał na parkiecie: klub znany z widowiskowych nocnych występów."},"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/6/63/Lisboa_Bairro_Alto_%2853893930842%29.jpg/960px-Lisboa_Bairro_Alto_%2853893930842%29.jpg","imageCaption":"Bairro Alto nocą, Lizbona (zdjęcie dzielnicy, nie konkretnego lokalu)","imageCredit":{"author":"Jorge Franganillo","license":"CC BY 2.0","licenseUrl":"https://creativecommons.org/licenses/by/2.0/","source":"https://commons.wikimedia.org/wiki/File:Lisboa_Bairro_Alto_(53893930842).jpg","via":"Wikimedia Commons","quality":"Photo verified"}},{"id":"lisbon-essentials-full-day","name":"Lizbona pierwszy raz: klasyki w jeden dzień","description":"Belém, wielkie zabytki portugalskich odkryć, nabrzeże Tagu, Baixa i Alfama. Całodniowe zwiedzanie z przejazdem między zachodnią częścią miasta i centrum.","transport":"mix","cats":["klasyka","first-time"],"stops":["editorial-lisbon-jeronimos","osm-way-24341353","osm-way-152327819","osm-relation-11381632","editorial-lisbon-praca-comercio","editorial-lisbon-arco-rua-augusta","editorial-lisbon-se","osm-way-1382432568","osm-node-5446794770"],"durationMinutes":540,"timeWindow":{"start":"09:30","end":"18:30","spansMidnight":false},"recommendedDays":["wed","thu","fri","sat","sun"],"routeType":"editorial","editorialStatus":"desk-researched","authorLabel":"City Route","warnings":["Mosteiro dos Jerónimos i Torre de Belém są zamknięte w poniedziałki.","MAAT jest zamknięte we wtorki; rekomendowany pełny wariant od środy do niedzieli.","Zimą Castelo de São Jorge zamyka się o 18:00 (ostatnie wejście 17:30); trzeba dotrzeć odpowiednio wcześniej.","Między Belém a Praça do Comércio wymagany jest przejazd; posiłek i bilety mogą wydłużyć plan."],"stopNotes":{"editorial-lisbon-jeronimos":"Rozpocznij od manuelińskiego klasztoru UNESCO. Na zwiedzanie wnętrza zarezerwuj czas.","osm-way-24341353":"Zobacz fortecę nad Tagiem i jej historyczne znaczenie w epoce żeglugi.","osm-way-152327819":"Podejdź do monumentu odkrywców; to krótki, ale charakterystyczny punkt Belém.","osm-relation-11381632":"Muzeum nad rzeką z architekturą wartą zobaczenia nawet z zewnątrz.","editorial-lisbon-praca-comercio":"Po przejeździe do centrum wejdź na wielki plac nad Tagiem.","editorial-lisbon-arco-rua-augusta":"Przejdź spod łuku na miejską Rua Augusta.","editorial-lisbon-se":"Zobacz lizbońską katedrę w drodze na wzgórze.","osm-way-1382432568":"Wejdź na dziedziniec zamku i obejrzyj panoramę miasta przed zamknięciem.","osm-node-5446794770":"Zakończ na tarasie z pięknym widokiem na Alfamę."},"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Bel%C3%A9m_Tower_in_Lisbon.jpg/960px-Bel%C3%A9m_Tower_in_Lisbon.jpg","imageCaption":"Torre de Belém nad Tagiem","imageCredit":{"author":"Lisbon Photoshoots","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/","source":"https://commons.wikimedia.org/wiki/File:Bel%C3%A9m_Tower_in_Lisbon.jpg","via":"Wikimedia Commons","quality":"Photo verified"}},{"id":"lisbon-food-and-views","name":"Lizbona smakuje najlepiej z góry","description":"Kawa i portugalskie wypieki, nieoczywiste tarasy, lunch w tascce oraz kolacja przy fado w Alfamie. Powolny dzień z widokami zamiast odhaczania zabytków.","transport":"walking","cats":["jedzenie","lokalnie","widoki"],"stops":["osm-node-4433136691","osm-node-419313189","osm-node-4771391278","osm-node-4808145123","osm-node-5446794764","osm-node-2537090840","osm-relation-19112367","osm-node-4813682932"],"durationMinutes":540,"timeWindow":{"start":"12:00","end":"21:00","spansMidnight":false},"recommendedDays":["mon","tue","wed","thu","fri","sat"],"routeType":"editorial","editorialStatus":"desk-researched","authorLabel":"City Route","warnings":["Zé Dos Cornos ma ograniczone godziny lunchu i bywa zamknięte w niedzielę; kolejność posiłków należy dostosować.","Lizbona jest pagórkowata — ta trasa obejmuje podejścia pod kilka punktów widokowych.","A Baiuca to niewielki lokal; potwierdź miejsce na kolację i program fado.","Godzina zachodu słońca zmienia się sezonowo; widoki po drodze nie gwarantują zachodu."],"stopNotes":{"osm-node-4433136691":"Zacznij od kawy i klasycznych wypieków w historycznej cukierni.","osm-node-419313189":"Pierwsza panorama miasta, z zamkiem po drugiej stronie doliny.","osm-node-4771391278":"Krótkie wyciszenie na mniej zatłoczonym punkcie widokowym.","osm-node-4808145123":"Prosty portugalski lunch w niewielkiej, lokalnej restauracji.","osm-node-5446794764":"Odkryj spokojny taras ponad Anjos i fragment Lizbony poza pocztówkami.","osm-node-2537090840":"Zatrzymaj się na napój w historycznym lokalu na Graça.","osm-relation-19112367":"Ostatnia szeroka panorama przed zejściem do Alfamy.","osm-node-4813682932":"Kolacja i kameralne fado jako kulinarno-muzyczne zakończenie dnia."},"image":"https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9a/Lissabon_-_Sao_Pedro_de_Alcantara.jpg/960px-Lissabon_-_Sao_Pedro_de_Alcantara.jpg","imageCaption":"Panorama Lizbony z Miradouro de São Pedro de Alcântara","imageCredit":{"author":"Ingo Mehling","license":"CC BY-SA 4.0","licenseUrl":"https://creativecommons.org/licenses/by-sa/4.0/","source":"https://commons.wikimedia.org/wiki/File:Lissabon_-_Sao_Pedro_de_Alcantara.jpg","via":"Wikimedia Commons","quality":"Quality image"}}]$routes$::jsonb)
  LOOP
    INSERT INTO public.routes(
      city_id,slug,name,description,route_type,owner_user_id,visibility,status,transport,metadata,published_at,legacy_id
    ) VALUES (
      v_city,v_route_row->>'id',v_route_row->>'name',v_route_row->>'description',
      'editorial',null,'public','published',v_route_row->>'transport',
      jsonb_build_object('legacy',v_route_row,'editorial',jsonb_build_object('status','desk-researched','fieldTested',false)),
      now(),v_route_row->>'id'
    ) ON CONFLICT(city_id,slug) DO UPDATE SET
      name=excluded.name, description=excluded.description, transport=excluded.transport,
      metadata=excluded.metadata, visibility='public',status='published'
    WHERE public.routes.route_type='editorial' AND public.routes.owner_user_id IS NULL;

    SELECT r.id INTO v_route FROM public.routes r
      WHERE r.city_id=v_city AND r.slug=v_route_row->>'id'
        AND r.route_type='editorial' AND r.owner_user_id IS NULL;
    IF v_route IS NULL THEN RAISE EXCEPTION 'Editorial route slug conflict %',v_route_row->>'id'; END IF;

    v_position:=0;
    FOR v_stop IN SELECT jsonb_array_elements_text(v_route_row->'stops') LOOP
      SELECT p.id INTO v_place FROM public.places p
        WHERE p.city_id=v_city AND p.slug=v_stop AND p.status='published';
      IF v_place IS NULL THEN RAISE EXCEPTION 'Missing Lisbon stop % in route %',v_stop,v_route_row->>'id'; END IF;
      INSERT INTO public.route_stops(route_id,place_id,"position",note)
      VALUES (v_route,v_place,v_position,coalesce(v_route_row->'stopNotes'->>v_stop,''))
      ON CONFLICT(route_id,"position") DO UPDATE SET
        place_id=excluded.place_id,note=excluded.note;
      v_position:=v_position+1;
    END LOOP;
    SELECT count(*) INTO v_actual FROM public.route_stops WHERE route_id=v_route;
    IF v_actual<>v_position THEN RAISE EXCEPTION 'Route % stop-count mismatch % vs %',v_route_row->>'id',v_actual,v_position; END IF;
    INSERT INTO public.route_tags(route_id,tag)
      SELECT v_route,t.value FROM jsonb_array_elements_text(v_route_row->'cats') AS t(value)
      ON CONFLICT DO NOTHING;
  END LOOP;

  IF (SELECT count(*) FROM public.routes WHERE city_id=v_city AND slug IN
        ('lisbon-after-dark-bars-clubs','lisbon-essentials-full-day','lisbon-food-and-views')
        AND route_type='editorial' AND status='published')<>3
  THEN RAISE EXCEPTION '3 editorial Lisbon routes missing'; END IF;
END $seed$;
