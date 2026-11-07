-- Behavioural tests for policies, triggers, XP and moderation.
-- Each block impersonates a user with `set role` + the JWT subject claim, like PostgREST does.
\set a '11111111-1111-4111-8111-111111111111'
\set b '22222222-2222-4222-8222-222222222222'
\set c '33333333-3333-4333-8333-333333333333'
\set d '44444444-4444-4444-8444-444444444444'
\set m '55555555-5555-4555-8555-555555555555'

create schema tests;
create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
-- Runs a statement and passes only if it raises an error.
create function tests.fails(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok - % (%)', msg, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % (statement succeeded)', msg;
end $$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;
set client_min_messages = notice;

-- Sign-ups create profiles ------------------------------------------------------------
insert into auth.users (id, email) values (:'a', 'a@x.test'), (:'b', 'b@x.test'), (:'c', 'c@x.test'), (:'d', 'd@x.test'), (:'m', 'm@x.test');
select tests.ok((select count(*) from public.profiles where id in (:'a', :'b', :'c', :'d', :'m')) = 5, 'sign-up creates a profile');
update public.profiles set role = 'moderator' where id = :'m';
select tests.ok((select count(*) from public.destinations) = 22, 'seeded destinations');
select tests.ok((select count(*) from public.gems where status = 'published') = 21, 'seeded gems are published');

-- Anonymous visitors --------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.ok((select count(*) from public.gems) = 21, 'anon can browse published gems');
select tests.ok((select count(*) from public.events) = 10, 'anon can browse events');
select tests.fails($$insert into public.gems (name, description, lat, lng) values ('Spot', 'A lovely quiet place', 1, 1)$$, 'anon cannot share a gem');
select tests.fails($$select * from public.saves$$, 'anon cannot read saves');
reset role;

-- Profiles ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'a', false);
update public.profiles set handle = 'alice', name = 'Alice', onboarded = true, visited = array['Japan', 'Italy'] where id = auth.uid();
select tests.ok((select xp from public.profiles where id = auth.uid()) = 130, 'onboarding + 2 countries = 130 XP');
update public.profiles set visited = array['Japan'] where id = auth.uid();
update public.profiles set visited = array['Japan', 'Italy'] where id = auth.uid();
select tests.ok((select xp from public.profiles where id = auth.uid()) = 130, 're-adding a country does not farm XP');
select tests.fails($$update public.profiles set xp = 99999 where id = auth.uid()$$, 'cannot set own XP');
select tests.fails($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'cannot promote self');
update public.profiles set name = 'Hacked' where id = :'b';
reset role;
select tests.ok((select name from public.profiles where id = :'b') = '', 'cannot edit someone else''s profile');
set role authenticated;
select tests.ok(public.handle_available('alice') = true, 'own handle counts as available to self');
select set_config('request.jwt.claim.sub', :'b', false);
select tests.ok(public.handle_available('alice') = false, 'taken handle is unavailable');
select tests.ok(public.handle_available('Bad Handle!') = false, 'invalid handle rejected');
update public.profiles set handle = 'bob', name = 'Bob', onboarded = true where id = auth.uid();
select set_config('request.jwt.claim.sub', :'c', false);
update public.profiles set handle = 'cara', name = 'Cara', onboarded = true where id = auth.uid();
select set_config('request.jwt.claim.sub', :'d', false);
update public.profiles set handle = 'dev', name = 'Dev', onboarded = true where id = auth.uid();

-- Gems -----------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'a', false);
insert into public.gems (name, description, tip, category, lat, lng, country, destination_id, status, upvote_count, author_id)
  values ('Quiet Cove', 'A sheltered swimming cove past the lighthouse.', 'Bring water shoes.', 'beach', 38.7, -9.4, 'Portugal', 'lisbon', 'published', 999, :'b');
select tests.ok((select author_id = auth.uid() and upvote_count = 0 and status = 'published' from public.gems where name = 'Quiet Cove'),
  'new gem: author forced to caller, counters reset, published');
select tests.ok((select xp from public.profiles where id = auth.uid()) = 180, 'sharing a gem awards 50 XP');
insert into public.gems (name, description, lat, lng) values ('Promo Spot', 'Book now at https://spam.example for discounts', 1, 1);
select tests.ok((select status from public.gems where name = 'Promo Spot') = 'pending', 'gem with a link is held for review');
select tests.ok((select xp from public.profiles where id = auth.uid()) = 180, 'pending gem awards no XP yet');
update public.gems set description = 'Now with a link: www.example.com spam' where name = 'Quiet Cove';
select tests.ok((select status from public.gems where name = 'Quiet Cove') = 'pending', 'editing in a link sends a gem back to review');
update public.gems set description = 'A sheltered swimming cove past the lighthouse.' where name = 'Quiet Cove';
reset role;
update public.gems set status = 'published' where name = 'Quiet Cove';
set role authenticated;
select tests.fails($$update public.gems set status = 'published' where name = 'Promo Spot'$$, 'author cannot publish their own pending gem');
select tests.fails($$update public.gems set upvote_count = 500 where name = 'Quiet Cove'$$, 'author cannot set counters');
select tests.fails($$insert into public.gem_upvotes (gem_id) select id from public.gems where name = 'Quiet Cove'$$, 'cannot upvote own gem');

select set_config('request.jwt.claim.sub', :'b', false);
select tests.ok(not exists (select 1 from public.gems where name = 'Promo Spot'), 'others cannot see a pending gem');
update public.gems set name = 'Mine now' where name = 'Quiet Cove';
select tests.ok(exists (select 1 from public.gems where name = 'Quiet Cove'), 'cannot edit someone else''s gem');
insert into public.gem_upvotes (gem_id) select id from public.gems where name = 'Quiet Cove';
select tests.ok((select upvote_count from public.gems where name = 'Quiet Cove') = 1, 'upvote increments the count');
delete from public.gem_upvotes where gem_id = (select id from public.gems where name = 'Quiet Cove');
insert into public.gem_upvotes (gem_id) select id from public.gems where name = 'Quiet Cove';
reset role;
select tests.ok((select xp from public.profiles where id = :'a') = 182, 'author earns 2 XP per upvote, once per voter');
set role authenticated;

-- Saves & trips -----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'b', false);
insert into public.saves (item_type, item_id) select 'gem', id::text from public.gems where name = 'Quiet Cove';
delete from public.saves where item_type = 'gem';
insert into public.saves (item_type, item_id) select 'gem', id::text from public.gems where name = 'Quiet Cove';
insert into public.saves (item_type, item_id) values ('destination', 'lisbon');
select tests.ok((select count(*) from public.saves) = 2, 'saves are stored');
select tests.ok((select save_count from public.gems where name = 'Quiet Cove') = 1, 'gem save count tracks saves');
select tests.ok((select xp from public.profiles where id = auth.uid()) = 110, 'save XP awarded once per item (100 + 2x5)');
insert into public.trips (title, destination_id, days, style) values ('Lisbon long weekend', 'lisbon', 3, 'culture');
insert into public.trip_items (trip_id, day, title, item_type, item_id)
  select t.id, 0, 'Quiet Cove', 'gem', g.id::text from public.trips t, public.gems g where g.name = 'Quiet Cove';
update public.trip_items set done = true;
update public.trip_items set done = false;
update public.trip_items set done = true;
select tests.ok((select xp from public.profiles where id = auth.uid()) = 185, 'trip +60 and check-in +15 once');

select set_config('request.jwt.claim.sub', :'a', false);
select tests.ok((select count(*) from public.saves) = 0, 'cannot see other people''s saves');
select tests.ok((select count(*) from public.trips) = 0, 'cannot see other people''s trips');
select tests.fails(format($f$insert into public.trip_items (trip_id, title) values (%L, 'sneaky')$f$,
  (select id from public.trips limit 1)), 'cannot add items to someone else''s trip');
reset role;
select tests.ok((select count(*) from public.trip_items) = 1, 'no items were added to another person''s trip');
set role authenticated;

-- Reports & moderation ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'b', false);
insert into public.reports (target_type, target_id, reason) select 'gem', id::text, 'spam' from public.gems where name = 'Quiet Cove';
select tests.fails($$insert into public.reports (target_type, target_id, reason) select 'gem', id::text, 'spam' from public.gems where name = 'Quiet Cove'$$, 'one report per person per item');
select set_config('request.jwt.claim.sub', :'c', false);
insert into public.reports (target_type, target_id, reason) select 'gem', id::text, 'unsafe' from public.gems where name = 'Quiet Cove';
select tests.ok(exists (select 1 from public.gems where name = 'Quiet Cove'), 'still visible after 2 reports');
select set_config('request.jwt.claim.sub', :'d', false);
insert into public.reports (target_type, target_id, reason) select 'gem', id::text, 'inaccurate' from public.gems where name = 'Quiet Cove';
select tests.ok(not exists (select 1 from public.gems where name = 'Quiet Cove'), 'hidden from others after 3 reports');
select tests.ok((select count(*) from public.reports) = 1, 'people only see their own reports');
select tests.fails(format($f$select public.moderate('gem', %L, 'published')$f$, (select id from public.gems limit 1)), 'non-moderators cannot moderate');
select set_config('request.jwt.claim.sub', :'a', false);
select tests.ok((select status from public.gems where name = 'Quiet Cove') = 'hidden', 'author still sees their hidden gem');

select set_config('request.jwt.claim.sub', :'m', false);
select tests.ok((select count(*) from public.reports where status = 'open') = 3, 'moderator sees open reports');
select tests.ok(exists (select 1 from public.gems where name = 'Promo Spot'), 'moderator sees pending gems');
select public.moderate('gem', (select id from public.gems where name = 'Quiet Cove'), 'published', 'Checked, fine');
select public.moderate('gem', (select id from public.gems where name = 'Promo Spot'), 'rejected', 'Advertising');
select tests.ok((select count(*) from public.reports where status = 'open') = 0, 'moderation closes the reports');
select tests.ok((select count(*) from public.moderation_actions) = 2, 'moderation is logged');
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.ok(exists (select 1 from public.gems where name = 'Quiet Cove'), 'restored gem is public again');
select tests.ok(not exists (select 1 from public.gems where name = 'Promo Spot'), 'rejected gem stays hidden');
reset role;

-- Blocks, follows, privacy ---------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'c', false);
insert into public.follows (followee_id) values (:'a');
select tests.fails(format($f$insert into public.follows (followee_id) values (%L)$f$, :'c'), 'cannot follow yourself');
insert into public.blocks (blocked_id) values (:'a');
select tests.ok(not exists (select 1 from public.gems where name = 'Quiet Cove'), 'blocked author''s gems disappear');
select set_config('request.jwt.claim.sub', :'a', false);
select tests.fails(format($f$insert into public.follows (followee_id) values (%L)$f$, :'c'), 'cannot follow someone who blocked you');
select set_config('request.jwt.claim.sub', :'d', false);
update public.profiles set visibility = 'private' where id = auth.uid();
select set_config('request.jwt.claim.sub', :'b', false);
select tests.ok(not exists (select 1 from public.profiles where handle = 'dev'), 'private profiles are hidden');
select tests.fails(format($f$insert into public.follows (followee_id) values (%L)$f$, :'d'), 'cannot follow a private profile');

-- Rate limits ---------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'b', false);
insert into public.gems (name, description, lat, lng) select 'Spot ' || g, 'A nice quiet place number ' || g, 1, 1 from generate_series(1, 10) g;
select tests.fails($$insert into public.gems (name, description, lat, lng) values ('Spot 11', 'One too many places today', 1, 1)$$, '11th gem in a day is refused');

-- Field notes ---------------------------------------------------------------------------------
insert into public.tips (destination_id, category, body) values ('kyoto', 'Transit', 'Buy an ICOCA card at the station on arrival.');
select set_config('request.jwt.claim.sub', :'c', false);
insert into public.tip_votes (tip_id) select id from public.tips limit 1;
select tests.ok((select vote_count from public.tips limit 1) = 1, 'tip votes are counted');

-- Storage --------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'b', false);
insert into storage.objects (bucket_id, name) values ('gem-photos', :'b' || '/photo.jpg');
select tests.fails(format($f$insert into storage.objects (bucket_id, name) values ('gem-photos', %L)$f$, :'a' || '/photo.jpg'),
  'cannot upload into someone else''s folder');
reset role;
select tests.ok((select public from storage.buckets where id = 'gem-photos'), 'photo bucket exists and is public');

-- XP history & account deletion ----------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'b', false);
select tests.ok((select count(*) from public.xp_events) > 0 and (select bool_and(user_id = auth.uid()) from public.xp_events), 'XP history only shows your own');
select tests.fails($$insert into public.xp_events (user_id, amount, reason) values (auth.uid(), 1000, 'cheat')$$, 'cannot write XP directly');
select public.delete_my_account();
reset role;
select tests.ok(not exists (select 1 from public.profiles where id = :'b'), 'deleting the account removes the profile');
select tests.ok(not exists (select 1 from public.trips), 'and their trips');
select tests.ok(not exists (select 1 from public.gems where author_id = :'b'), 'and their gems');
