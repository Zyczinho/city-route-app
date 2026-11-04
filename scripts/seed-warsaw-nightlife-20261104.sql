-- Verified Warsaw nightlife seed, 2026-11-04. Idempotent inserts only.
-- No invented ratings or social-platform images, no modifications/deletes.
-- Smolna photo: verified venue signage, CC BY-SA 4.0 by Followthestep, 2730x1820 master; 1280px thumbnail + full attribution.
-- Sources (address/venue): https://ra.co/clubs/pl/warsaw ,
-- https://mapcarta.com/N4227971279 , https://sketchnite.com/wp-content/uploads/2016/06/sketch-nite4-1.pdf
-- https://smolna38.org/ , https://commons.wikimedia.org/wiki/File:Smolna_38.JPG
-- https://jasna1.com/ , https://pl.aroundus.com/p/9221540-dom-pod-orlami-w-warszawie
-- https://www.kulturalna.warszawa.pl/pi/46018_1.pdf , Warsaw Bar Plan B.
-- Source website references are informational, NOT grants to copy their photos.

INSERT INTO public.places
(city_id,slug,legacy_id,name,category_id,location,area,description,minutes,cost_minor,currency,tourist_level,food_style,partner,is_top,visibility,status,image_url,image_meta,metadata)
SELECT c.id,v.slug,v.slug,v.name,v.category_id,
       extensions.st_point(v.lng,v.lat)::extensions.geography,
       v.area,v.description,v.minutes,0,'PLN','local','none',false,false,'public','published',
       CASE WHEN v.slug='smolna-38' THEN 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/MG_6605-2.jpg/1280px-MG_6605-2.jpg' ELSE NULL END,
       CASE WHEN v.slug='smolna-38' THEN jsonb_build_object(
         'caption','Szyld klubu Smolna (2016)',
         'credit',jsonb_build_object('author','Followthestep','license','CC BY-SA 4.0',
           'licenseUrl','https://creativecommons.org/licenses/by-sa/4.0/',
           'via','Wikimedia Commons','source','https://commons.wikimedia.org/wiki/File:MG_6605-2.jpg'))
       ELSE '{}'::jsonb END,
       jsonb_build_object('kind','place','website',v.website,'address',v.address,
        'photoStatus','awaiting-authorized-photo',
        'source',jsonb_build_object('provider','verified-public-listing','url',v.source_url,'checked','2026-11-04'))
FROM public.cities c
CROSS JOIN (
 VALUES
  ('sketch-nite','Sketch NITE','club',52.23776,21.01275,'Śródmieście','Klub nocny z muzyką i parkietami przy Mazowieckiej.',120,'https://sketchnite.com/','Mazowiecka 11A, 00-052 Warszawa','https://mapcarta.com/N4227971279'),
  ('smolna-38','Smolna','club',52.232754,21.022875,'Śródmieście','Klub muzyki elektronicznej przy ulicy Smolnej 38.',120,'https://smolna38.org/','Smolna 38, 00-375 Warszawa','https://smolna38.org/'),
  ('jasna-1','Jasna 1','club',52.23375,21.01175,'Śródmieście','Klub i przestrzeń muzyki elektronicznej w centrum Warszawy.',120,'https://jasna1.com/','Jasna 1, 00-013 Warszawa','https://jasna1.com/'),
  ('plan-b-warsaw','Plan B','bar',52.21964,21.01904,'Śródmieście','Bar spotkań i muzyki przy Placu Zbawiciela.',60,'https://planbe.pl/','Aleja Wyzwolenia 18, Warszawa','https://www.kulturalna.warszawa.pl/pi/46018_1.pdf')
) AS v(slug,name,category_id,lat,lng,area,description,minutes,website,address,source_url)
WHERE c.slug='warsaw'
ON CONFLICT (city_id,slug) DO NOTHING;

-- Verify separately: public.catalogue_places('warsaw') grows from 50 to 54,
-- with four new nightlife entries. Do not rewrite migrations 001-016 or their ledger.
