-- 016: Independent City Route place reviews and private feedback to route creators.
-- DO NOT mix these reviews with the existing Google/Tripadvisor combined score.
-- Run only after 015 has been reviewed, then use the staged production release gate.

create table if not exists public.place_reviews(
 place_id uuid not null references public.places(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 rating smallint not null check (rating between 1 and 5),
 feedback text not null default '' check (char_length(feedback)<=500),
 visit_verified boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(place_id,user_id)
);
create index if not exists place_reviews_user_idx on public.place_reviews(user_id);
drop trigger if exists place_reviews_set_updated_at on public.place_reviews;
create trigger place_reviews_set_updated_at before update on public.place_reviews
for each row execute function public.set_updated_at();
alter table public.place_reviews enable row level security;
revoke all on public.place_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.place_reviews to authenticated;
drop policy if exists place_reviews_owner_select on public.place_reviews;
create policy place_reviews_owner_select on public.place_reviews
for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists place_reviews_owner_insert on public.place_reviews;
create policy place_reviews_owner_insert on public.place_reviews
for insert to authenticated with check (user_id=(select auth.uid()) and visit_verified=false);
drop policy if exists place_reviews_owner_update on public.place_reviews;
create policy place_reviews_owner_update on public.place_reviews
for update to authenticated using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and visit_verified=false);
drop policy if exists place_reviews_owner_delete on public.place_reviews;
create policy place_reviews_owner_delete on public.place_reviews
for delete to authenticated using (user_id=(select auth.uid()));

-- Self-service rating is intentionally UNVERIFIED until a trusted visit-verification system exists.
create or replace function public.rate_visited_place(p_city_slug text,p_ref text,p_rating integer,p_feedback text default '')
returns uuid language plpgsql volatile set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_place uuid; v_owner uuid;
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid-rating' using errcode='22023'; end if;
 if char_length(coalesce(p_feedback,''))>500 then raise exception 'invalid-feedback' using errcode='22023'; end if;
 select p.id,p.created_by into v_place,v_owner
 from public.places p join public.cities c on c.id=p.city_id
 where c.slug=p_city_slug and (coalesce(p.legacy_id,p.slug)=p_ref or p.id::text=p_ref)
   and p.visibility='public' and p.status='published';
 if v_place is null then raise exception 'place-not-found' using errcode='P0002'; end if;
 if v_owner=v_user then raise exception 'self-rating' using errcode='42501'; end if;
 insert into public.place_reviews(place_id,user_id,rating,feedback,visit_verified)
 values(v_place,v_user,p_rating,coalesce(p_feedback,''),false)
 on conflict(place_id,user_id) do update set rating=excluded.rating,feedback=excluded.feedback,visit_verified=false;
 return v_place;
end $$;

-- Public aggregates only: counts and 1–5 mean, no identities or submitted text.
-- Bayesian sort score prevents a single five-star review from outranking a highly rated
-- established place while still allowing City Route-only ranking at low volumes.
create or replace function public.city_route_place_scores(p_city_slug text)
returns table(place_ref text,review_count bigint,average_rating numeric,sort_score numeric)
language sql stable security definer set search_path='' as $$
 select coalesce(p.legacy_id,p.slug)::text,count(*)::bigint,round(avg(pr.rating)::numeric,2),
        round((sum(pr.rating)::numeric+20*4.0)/(count(*)+20),4)
 from public.place_reviews pr
 join public.places p on p.id=pr.place_id
 join public.cities c on c.id=p.city_id
 where c.slug=p_city_slug and p.visibility='public' and p.status='published'
 group by p.id,p.legacy_id,p.slug;
$$;

-- Existing route_ratings is owner-only. Text feedback is never placed in public route cards.
alter table public.route_ratings add column if not exists feedback text not null default ''
check(char_length(feedback)<=500);

create or replace function public.set_route_feedback(p_city_slug text,p_ref text,p_feedback text)
returns uuid language plpgsql volatile set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_route uuid:=public.route_ref(p_city_slug,p_ref);
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if v_route is null then raise exception 'route-not-found' using errcode='P0002'; end if;
 if p_feedback is null or char_length(p_feedback)>500 then raise exception 'invalid-feedback' using errcode='22023'; end if;
 update public.route_ratings set feedback=p_feedback where route_id=v_route and user_id=v_user;
 if not found then raise exception 'rate-first' using errcode='P0002'; end if;
 return v_route;
end $$;

-- Route creator can read anonymous feedback on own published route; not public.
create or replace function public.my_route_feedback(p_route_id uuid)
returns table(rating smallint,feedback text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid());
begin
 if v_user is null then raise exception 'auth-required' using errcode='42501'; end if;
 if not exists(select 1 from public.routes where id=p_route_id and owner_user_id=v_user) then
   raise exception 'not-owner' using errcode='42501'; end if;
 return query
 select x.rating,x.feedback,x.created_at from public.route_ratings x
 where x.route_id=p_route_id and x.feedback<>'' order by x.created_at desc limit 100;
end $$;

revoke execute on function
 public.rate_visited_place(text,text,integer,text),
 public.city_route_place_scores(text),
 public.set_route_feedback(text,text,text),
 public.my_route_feedback(uuid)
from public,anon,authenticated;
grant execute on function public.city_route_place_scores(text) to anon,authenticated;
grant execute on function
 public.rate_visited_place(text,text,integer,text),
 public.set_route_feedback(text,text,text),
 public.my_route_feedback(uuid)
to authenticated;
