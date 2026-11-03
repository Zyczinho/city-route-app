-- CATALOG-WAW-001: Warsaw museums and restaurants pilot (2026-11-03)
-- Forward-only, additive migration. Does not edit 004 or any previously applied migration.
-- 9 museums + 6 restaurants. Identity: operator/site and place/address sources in metadata.
-- Coordinates have documented provenance; for restaurants, some are address-centroids, not entrances.
-- Ratings/photos intentionally missing rather than invented. Cost is an *editorial route-budget estimate*, NOT an admission or menu price.
-- Do not apply to hosted Supabase before PR review and founder approval.

do $$
declare
  v_city uuid;
  v_place uuid;
  v_count integer;
begin
  select id into v_city from public.cities where slug='warsaw';
  if v_city is null then raise exception 'Missing Warsaw city: run earlier migrations first'; end if;

  -- place: warsaw-uprising-museum
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'warsaw-uprising-museum','warsaw-uprising-museum','Muzeum Powstania Warszawskiego','museum',extensions.st_point(20.9810185,52.2323936)::extensions.geography,'Wola','Historia Powstania Warszawskiego i losów mieszkańców miasta podczas 1944 roku.',100,3500,'PLN','must','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Grzybowska 79","website":"https://www.1944.pl/","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://www.1944.pl/","coordinateSource":"https://muzea.org/muzeum/muzeum-powstania-warszawskiego/","coordinatePrecision":"building"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='warsaw-uprising-museum';
  if v_place is null then raise exception 'Failed to import warsaw-uprising-museum'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: polin-museum
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'polin-museum','polin-museum','Muzeum Historii Żydów Polskich POLIN','museum',extensions.st_point(20.99313,52.24936)::extensions.geography,'Muranów','Interaktywna opowieść o tysiącletniej historii Żydów polskich.',120,3500,'PLN','must','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Mordechaja Anielewicza 6","website":"https://polin.pl/pl/o-muzeum","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://polin.pl/pl/o-muzeum","coordinateSource":"https://mapcarta.com/pt/W186141946","coordinatePrecision":"building"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='polin-museum';
  if v_place is null then raise exception 'Failed to import polin-museum'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: warsaw-city-museum
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'warsaw-city-museum','warsaw-city-museum','Muzeum Warszawy','museum',extensions.st_point(21.01139,52.24997)::extensions.geography,'Stare Miasto','Historia i przedmioty codziennego życia Warszawy w staromiejskich kamienicach.',80,3000,'PLN','must','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Rynek Starego Miasta 28–42","website":"https://muzeumwarszawy.pl/","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://muzeumwarszawy.pl/","coordinateSource":"https://mapcarta.com/36022060","coordinatePrecision":"building"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='warsaw-city-museum';
  if v_place is null then raise exception 'Failed to import warsaw-city-museum'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: modern-art-museum-warsaw
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'modern-art-museum-warsaw','modern-art-museum-warsaw','Muzeum Sztuki Nowoczesnej','museum',extensions.st_point(21.009,52.2331)::extensions.geography,'Śródmieście','Wystawy współczesnej sztuki polskiej i międzynarodowej przy placu Defilad.',75,3000,'PLN','balanced','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Marszałkowska 103","website":"https://artmuseum.pl/","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://artmuseum.pl/","coordinateSource":"https://mapcarta.com/pt/W944207076","coordinatePrecision":"building"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='modern-art-museum-warsaw';
  if v_place is null then raise exception 'Failed to import modern-art-museum-warsaw'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: polish-history-museum
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'polish-history-museum','polish-history-museum','Muzeum Historii Polski','museum',extensions.st_point(21.001,52.26497)::extensions.geography,'Cytadela','Muzeum historii Polski w Cytadeli Warszawskiej; program wystaw zmienia się w czasie.',90,3000,'PLN','must','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Gwardii 1","website":"https://muzhp.pl/zaplanuj-wizyte","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://muzhp.pl/zaplanuj-wizyte","coordinateSource":"https://mapcarta.com/W31102954","coordinatePrecision":"building"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='polish-history-museum';
  if v_place is null then raise exception 'Failed to import polish-history-museum'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: polish-army-museum
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'polish-army-museum','polish-army-museum','Muzeum Wojska Polskiego','museum',extensions.st_point(20.99962,52.26392)::extensions.geography,'Cytadela','Zbiory wojskowe, uzbrojenie i historia armii polskiej w Cytadeli.',80,3000,'PLN','balanced','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Gwardii 4","website":"https://muzeumwp.pl/","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://muzeumwp.pl/","coordinateSource":"https://mapcarta.com/W31102940","coordinatePrecision":"building"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='polish-army-museum';
  if v_place is null then raise exception 'Failed to import polish-army-museum'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: asia-pacific-museum
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'asia-pacific-museum','asia-pacific-museum','Muzeum Azji i Pacyfiku','museum',extensions.st_point(21.03684,52.2334)::extensions.geography,'Powiśle','Sztuka i kultury Azji i Oceanii: wystawy stałe i czasowe.',70,2000,'PLN','balanced','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Solec 24","website":"https://www.muzeumazji.pl/wizyta/","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://www.muzeumazji.pl/wizyta/","coordinateSource":"https://mapcarta.com/N11196230956","coordinatePrecision":"point"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='asia-pacific-museum';
  if v_place is null then raise exception 'Failed to import asia-pacific-museum'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: polish-vodka-museum
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'polish-vodka-museum','polish-vodka-museum','Muzeum Polskiej Wódki','museum',extensions.st_point(21.04599,52.25539)::extensions.geography,'Praga-Północ','Wystawa o polskich tradycjach gorzelniczych w dawnej fabryce na Pradze.',65,5000,'PLN','local','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Plac Konesera 1","website":"https://muzeumpolskiejwodki.pl/","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://muzeumpolskiejwodki.pl/","coordinateSource":"https://mapcarta.com/N6566541885","coordinatePrecision":"point"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='polish-vodka-museum';
  if v_place is null then raise exception 'Failed to import polish-vodka-museum'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: printing-museum-warsaw
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'printing-museum-warsaw','printing-museum-warsaw','Muzeum Drukarstwa Warszawskiego','museum',extensions.st_point(21.04257,52.25413)::extensions.geography,'Praga-Północ','Prasy, techniki drukarskie i historia książki, z pokazami tradycyjnego druku.',55,2000,'PLN','local','none',false,false,'public','published',null,'{}'::jsonb,'{"kind":"place","address":"Ząbkowska 23/25","website":"https://muzeumdrukarstwa.muzeumwarszawy.pl/o-muzeum/","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://muzeumdrukarstwa.muzeumwarszawy.pl/o-muzeum/","coordinateSource":"https://mapcarta.com/N9937530280","coordinatePrecision":"point"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='printing-museum-warsaw';
  if v_place is null then raise exception 'Failed to import printing-museum-warsaw'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'culture') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'sightseeing') on conflict do nothing;

  -- place: bibenda-nowogrodzka
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'bibenda-nowogrodzka','bibenda-nowogrodzka','Bibenda','restaurant',extensions.st_point(21.0164,52.2297)::extensions.geography,'Śródmieście','Sezonowe talerzyki do dzielenia i kuchnia autorska.',60,6000,'PLN','local','sit',false,false,'public','published',null,'{}'::jsonb,'{"kind":"restaurant","address":"Nowogrodzka 10","cuisine":"międzynarodowa","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":null,"coordinateSource":"https://sprawdzadres.pl/mazowieckie/warszawa/nowogrodzka/10","coordinatePrecision":"address"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='bibenda-nowogrodzka';
  if v_place is null then raise exception 'Failed to import bibenda-nowogrodzka'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'food') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'small-plates') on conflict do nothing;

  -- place: maka-i-woda-chmielna
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'maka-i-woda-chmielna','maka-i-woda-chmielna','Mąka i Woda','restaurant',extensions.st_point(21.0165,52.2324)::extensions.geography,'Śródmieście','Włoska pizza neapolitańska i ręcznie robione makarony.',60,6000,'PLN','local','sit',false,false,'public','published',null,'{}'::jsonb,'{"kind":"restaurant","address":"Chmielna 13A","website":"https://makaiwoda.pl/","cuisine":"włoska","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://makaiwoda.pl/","coordinateSource":"https://sprawdzadres.pl/mazowieckie/warszawa/chmielna/13A","coordinatePrecision":"address"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='maka-i-woda-chmielna';
  if v_place is null then raise exception 'Failed to import maka-i-woda-chmielna'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'food') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'pizza') on conflict do nothing;

  -- place: uki-uki-krucza
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'uki-uki-krucza','uki-uki-krucza','UKI UKI (Krucza)','restaurant',extensions.st_point(21.0176,52.2275)::extensions.geography,'Śródmieście','Japoński bar z udonem i innymi daniami z makaronem.',60,6000,'PLN','local','sit',false,false,'public','published',null,'{}'::jsonb,'{"kind":"restaurant","address":"Krucza 23","cuisine":"japońska","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":null,"coordinateSource":"https://sprawdzadres.pl/mazowieckie/warszawa/krucza/23_31","coordinatePrecision":"address"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='uki-uki-krucza';
  if v_place is null then raise exception 'Failed to import uki-uki-krucza'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'food') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'noodles') on conflict do nothing;

  -- place: pyzy-flaki-brzeska
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'pyzy-flaki-brzeska','pyzy-flaki-brzeska','Pyzy, Flaki Gorące! (Brzeska)','restaurant',extensions.st_point(21.041,52.2531)::extensions.geography,'Praga-Północ','Tradycyjne warszawskie pyzy i flaki w swobodnym, praskim lokalu.',60,6000,'PLN','local','sit',false,false,'public','published',null,'{}'::jsonb,'{"kind":"restaurant","address":"Brzeska 29/31","website":"https://www.pyzyflakigorace.pl/","cuisine":"polska","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://www.pyzyflakigorace.pl/","coordinateSource":"https://sprawdzadres.pl/mazowieckie/warszawa/brzeska/29_31","coordinatePrecision":"address"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='pyzy-flaki-brzeska';
  if v_place is null then raise exception 'Failed to import pyzy-flaki-brzeska'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'food') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'traditional') on conflict do nothing;

  -- place: vegan-ramen-finlandzka
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'vegan-ramen-finlandzka','vegan-ramen-finlandzka','Vegan Ramen Shop (Finlandzka)','restaurant',extensions.st_point(21.05031,52.2372)::extensions.geography,'Saska Kępa','Roślinny ramen i japońskie dania bez produktów zwierzęcych.',60,6000,'PLN','local','sit',false,false,'public','published',null,'{}'::jsonb,'{"kind":"restaurant","address":"Finlandzka 12A","website":"https://veganramenshop.pl/contact/","cuisine":"japońska","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":"https://veganramenshop.pl/contact/","coordinateSource":"https://pl.aroundus.com/p/171939459-vegan-ramen-shop-finlandzka","coordinatePrecision":"point"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='vegan-ramen-finlandzka';
  if v_place is null then raise exception 'Failed to import vegan-ramen-finlandzka'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'food') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'vegan') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'ramen') on conflict do nothing;

  -- place: soul-kitchen-nowogrodzka
  insert into public.places(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
  values(v_city,'soul-kitchen-nowogrodzka','soul-kitchen-nowogrodzka','Soul Kitchen','restaurant',extensions.st_point(21.0149,52.2294)::extensions.geography,'Śródmieście','Sezonowa kuchnia polska i europejska w restauracji przy Nowogrodzkiej.',60,6000,'PLN','local','sit',false,false,'public','published',null,'{}'::jsonb,'{"kind":"restaurant","address":"Nowogrodzka 18A","cuisine":"polska","source":{"provider":"editorial","verifiedAt":"2026-11-03","officialWebsite":null,"coordinateSource":"https://sprawdzadres.pl/mazowieckie/warszawa/nowogrodzka/18A","coordinatePrecision":"address"},"priceSource":"editorial-budget-estimate","photoStatus":"not-sourced","ratingsStatus":"not-sourced"}'::jsonb)
  on conflict (city_id,slug) do nothing;
  select id into v_place from public.places where city_id=v_city and slug='soul-kitchen-nowogrodzka';
  if v_place is null then raise exception 'Failed to import soul-kitchen-nowogrodzka'; end if;
  insert into public.place_tags(place_id,tag) values(v_place,'food') on conflict do nothing;
  insert into public.place_tags(place_id,tag) values(v_place,'european') on conflict do nothing;

  select count(*) into v_count from public.places where city_id=v_city and status='published' and visibility='public' and slug in ('warsaw-uprising-museum','polin-museum','warsaw-city-museum','modern-art-museum-warsaw','polish-history-museum','polish-army-museum','asia-pacific-museum','polish-vodka-museum','printing-museum-warsaw','bibenda-nowogrodzka','maka-i-woda-chmielna','uki-uki-krucza','pyzy-flaki-brzeska','vegan-ramen-finlandzka','soul-kitchen-nowogrodzka');
  if v_count <> 15 then raise exception 'Warsaw pilot parity failure: expected 15 public places, found %',v_count; end if;
  raise notice 'CATALOG-WAW-001: % additional Warsaw places available',v_count;
end $$;
