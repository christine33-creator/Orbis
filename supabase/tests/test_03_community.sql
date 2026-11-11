-- Community: communities, memberships, posts, photos, comments, likes, saved posts, profile
-- photos and privacy, follows, reports, moderation and the recommendation → gem workflow.
-- Uses tests.ok / tests.fails from test_01_security.sql. State from earlier files: alice (a),
-- cara (c, has blocked alice), dev (d, private profile), moderator (m).
\set a '11111111-1111-4111-8111-111111111111'
\set c '33333333-3333-4333-8333-333333333333'
\set d '44444444-4444-4444-8444-444444444444'
\set m '55555555-5555-4555-8555-555555555555'
\set o '77777777-7777-4777-8777-777777777777'
\set p '88888888-8888-4888-8888-888888888888'
\set q '99999999-9999-4999-8999-999999999999'
set client_min_messages = notice;
reset role;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email) values (:'o', 'o@x.test'), (:'p', 'p@x.test'), (:'q', 'q@x.test');
update public.profiles set handle = 'olga', name = 'Olga', onboarded = true, preferences = '{"pace":"slow"}', watching = array['kyoto'] where id = :'o';
update public.profiles set handle = 'pablo', name = 'Pablo', onboarded = true where id = :'p';
update public.profiles set handle = 'quinn', name = 'Quinn', onboarded = true where id = :'q';

select tests.ok((select count(*) from public.communities where official and member_count = 0 and post_count = 0) = 9, 'starter communities are seeded empty');

-- Anonymous visitors ------------------------------------------------------------------------
set role anon;
select tests.ok((select count(*) from public.communities) = 9, 'anon can browse communities');
select tests.fails($$insert into public.communities (name) values ('Anon club')$$, 'anon cannot create communities');
select tests.fails($$insert into public.community_members (community_id) select id from public.communities limit 1$$, 'anon cannot join');
select tests.fails($$select * from public.post_likes$$, 'anon cannot read likes');
select tests.fails($$select * from public.post_saves$$, 'anon cannot read saved posts');
reset role;

-- Creating a community -------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', :'o', false);
insert into public.communities (name, description, category, styles) values ('Night Market Crew', 'Street food after dark.', 'interest', array['food']);
select tests.ok((select slug = 'night-market-crew' and status = 'published' and not official and created_by = :'o' and member_count = 1
  from public.communities where name = 'Night Market Crew'), 'creating a community makes a readable slug and publishes it');
select tests.ok((select role from public.community_members m join public.communities c on c.id = m.community_id where c.slug = 'night-market-crew' and m.user_id = :'o') = 'owner',
  'the creator becomes the owner');
select tests.fails($$insert into public.communities (name, official) values ('Fake Official', true)$$, 'cannot mark a community official');
select tests.fails($$insert into public.communities (name, created_by) values ('Someone Else', '88888888-8888-4888-8888-888888888888')$$, 'cannot create a community as someone else');
select tests.fails($$insert into public.communities (name) values ('night market crew')$$, 'community names are unique (case-insensitive)');
insert into public.communities (name, description) values ('Deals Club', 'Visit www.deals.example for cheap flights');
select tests.ok((select status from public.communities where name = 'Deals Club') = 'pending', 'communities with links are held for review');
insert into public.communities (name) values ('Third Club');
select tests.fails($$insert into public.communities (name) values ('Fourth Club')$$, '4th community in a day is refused');
select tests.fails($$update public.communities set member_count = 999 where slug = 'night-market-crew'$$, 'cannot edit counters');
update public.communities set description = 'Street food after dark, everywhere.' where slug = 'night-market-crew';
select tests.ok((select description from public.communities where slug = 'night-market-crew') like '%everywhere%', 'owner can edit the description');
select tests.fails($$delete from public.community_members where user_id = auth.uid() and community_id = (select id from public.communities where slug = 'night-market-crew')$$,
  'owners cannot leave their own community');

-- Joining, roles --------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'p', false);
select tests.ok(not exists (select 1 from public.communities where name = 'Deals Club'), 'pending communities are hidden from others');
insert into public.community_members (community_id) select id from public.communities where slug = 'night-market-crew';
select tests.ok((select role from public.community_members where user_id = :'p') = 'member', 'joining makes you a member');
select tests.ok((select member_count from public.communities where slug = 'night-market-crew') = 2, 'member count goes up');
select tests.ok(exists (select 1 from public.xp_events where user_id = :'p' and reason = 'community_joined'), 'joining earns XP');
select tests.fails($$insert into public.community_members (community_id, user_id) select id, '99999999-9999-4999-8999-999999999999' from public.communities where slug = 'food-trails'$$,
  'cannot add someone else to a community');
select tests.fails($$insert into public.community_members (community_id, role) select id, 'owner' from public.communities where slug = 'food-trails'$$,
  'cannot join as an owner');
select tests.fails($$update public.community_members set role = 'owner' where user_id = auth.uid()$$, 'cannot change your own role');
select tests.fails($$select public.set_member_role((select id from public.communities where slug = 'night-market-crew'), '88888888-8888-4888-8888-888888888888', 'moderator')$$,
  'members cannot promote themselves');
reset role;
select id as deals from public.communities where name = 'Deals Club' \gset
set role authenticated;
select tests.fails(format($f$insert into public.community_members (community_id) values (%L)$f$, :'deals'), 'cannot join a pending community');
select set_config('request.jwt.claim.sub', :'q', false);
insert into public.community_members (community_id) select id from public.communities where slug = 'night-market-crew';
select set_config('request.jwt.claim.sub', :'o', false);
select public.set_member_role((select id from public.communities where slug = 'night-market-crew'), :'p', 'moderator');
select tests.ok((select role from public.community_members where user_id = :'p') = 'moderator', 'owner promotes a moderator');
select tests.fails(format($f$select public.set_member_role((select id from public.communities where slug = 'night-market-crew'), %L, 'owner')$f$, :'p'), 'nobody can be made owner');

-- Posts ------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'q', false);
insert into public.community_posts (community_id, kind, title, body, destination_id, place)
  select id, 'recommendation', 'Best tacos in Oaxaca', 'Go to the smoke hall in Mercado 20 de Noviembre and pick your own meat.', 'oaxaca', 'Mercado 20 de Noviembre'
  from public.communities where slug = 'night-market-crew';
select tests.ok((select status = 'published' and author_id = :'q' and like_count = 0 from public.community_posts where title = 'Best tacos in Oaxaca'), 'members can post');
select tests.ok((select post_count from public.communities where slug = 'night-market-crew') = 1, 'post count goes up');
select tests.ok(exists (select 1 from public.xp_events where user_id = :'q' and reason = 'post_published'), 'posting earns XP');
select tests.fails($$insert into public.community_posts (community_id, title, body) select id, 'Not a member', 'Hello there' from public.communities where slug = 'food-trails'$$,
  'non-members cannot post');
select tests.fails($$insert into public.community_posts (community_id, title, body, author_id) select id, 'Impersonation', 'Hello', '77777777-7777-4777-8777-777777777777' from public.communities where slug = 'night-market-crew'$$,
  'cannot post as someone else');
insert into public.community_posts (community_id, title, body) select id, 'Call me', 'Ring me on +1 555 123 4567 for a tour' from public.communities where slug = 'night-market-crew';
select tests.ok((select status from public.community_posts where title = 'Call me') = 'pending', 'posts with phone numbers are held for review');
select tests.fails($$update public.community_posts set like_count = 50 where title = 'Best tacos in Oaxaca'$$, 'cannot edit counters on posts');
select tests.fails($$update public.community_posts set status = 'published' where title = 'Call me'$$, 'authors cannot publish their own held posts');
update public.community_posts set body = 'Go to the smoke hall (pasillo de humo) in Mercado 20 de Noviembre.' where title = 'Best tacos in Oaxaca';
select tests.ok((select edited_at is not null from public.community_posts where title = 'Best tacos in Oaxaca'), 'edits are marked as edited');

-- Photos
insert into public.post_media (post_id, url, position) select id, 'https://x.supabase.co/storage/v1/object/public/community-media/' || :'q' || '/a.jpg', 0
  from public.community_posts where title = 'Best tacos in Oaxaca';
select tests.fails(format($f$insert into public.post_media (post_id, url) select id, 'https://x.supabase.co/storage/v1/object/public/community-media/%s/b.jpg' from public.community_posts where title = 'Best tacos in Oaxaca'$f$, :'o'),
  'photos must come from your own folder');
select tests.fails($$insert into public.post_media (post_id, url) select id, 'https://evil.example/x.jpg' from public.community_posts where title = 'Best tacos in Oaxaca'$$, 'photos must be in Orbis storage');
select tests.fails($$insert into public.post_media (post_id, url) select id, 'javascript:alert(1)' from public.community_posts where title = 'Best tacos in Oaxaca'$$, 'photo URLs must be https');
select set_config('request.jwt.claim.sub', :'p', false);
select tests.fails(format($f$insert into public.post_media (post_id, url) select id, 'https://x.supabase.co/storage/v1/object/public/community-media/%s/c.jpg' from public.community_posts where title = 'Best tacos in Oaxaca'$f$, :'p'),
  'cannot add photos to someone else''s post');
update public.community_posts set body = 'hijacked' where title = 'Best tacos in Oaxaca';
select tests.ok((select body from public.community_posts where title = 'Best tacos in Oaxaca') not like 'hijacked%', 'and the post is unchanged');
select tests.ok(exists (select 1 from public.community_posts where title = 'Call me'), 'community moderators see held posts');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.ok((select count(*) from public.community_posts) = 1 and (select count(*) from public.post_media) = 1, 'anon sees published posts and their photos only');
reset role;
set role authenticated;

-- Likes, saves, comments --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'q', false);
select tests.fails($$insert into public.post_likes (post_id) select id from public.community_posts where title = 'Best tacos in Oaxaca'$$, 'cannot like your own post');
select set_config('request.jwt.claim.sub', :'o', false);
insert into public.post_likes (post_id) select id from public.community_posts where title = 'Best tacos in Oaxaca';
insert into public.post_saves (post_id) select id from public.community_posts where title = 'Best tacos in Oaxaca';
select tests.fails($$insert into public.post_likes (post_id) select id from public.community_posts where title = 'Best tacos in Oaxaca'$$, 'one like per person');
select tests.ok((select like_count = 1 and save_count = 1 from public.community_posts where title = 'Best tacos in Oaxaca'), 'likes and saves are counted');
reset role;
select tests.ok(exists (select 1 from public.xp_events x where x.user_id = :'q' and reason = 'like_received'), 'like XP is credited to the author');
set role authenticated;
insert into public.post_comments (post_id, body) select id, 'Thank you! Going next week.' from public.community_posts where title = 'Best tacos in Oaxaca';
select tests.ok((select comment_count from public.community_posts where title = 'Best tacos in Oaxaca') = 1, 'comment count goes up');
select set_config('request.jwt.claim.sub', :'p', false);
select tests.ok(not exists (select 1 from public.post_likes) and not exists (select 1 from public.post_saves), 'likes and saves are private to their owner');
update public.post_comments set body = 'edited by someone else' where body like 'Thank you%';
select tests.ok((select body from public.post_comments where body like 'Thank you%') = 'Thank you! Going next week.', 'other people''s comments stay unchanged');
select set_config('request.jwt.claim.sub', :'a', false);
select tests.fails($$insert into public.post_comments (post_id, body) select id, 'Drive-by comment' from public.community_posts where title = 'Best tacos in Oaxaca'$$,
  'non-members cannot comment');

-- Blocks hide posts and comments --------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'c', false);
select tests.ok(exists (select 1 from public.community_posts where title = 'Best tacos in Oaxaca'), 'anyone signed in can read published posts');
insert into public.blocks (blocked_id) values (:'q');
select tests.ok(not exists (select 1 from public.community_posts where title = 'Best tacos in Oaxaca')
  and not exists (select 1 from public.post_comments where author_id = :'q'), 'blocked authors'' posts disappear');
delete from public.blocks where blocked_id = :'q';

-- Community moderation ------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'p', false);
select public.moderate('post', (select id from public.community_posts where title = 'Call me'), 'rejected', 'No phone numbers');
reset role;
select tests.ok((select status from public.community_posts where title = 'Call me') = 'rejected', 'community moderators can reject posts in their community');
set role authenticated;
select set_config('request.jwt.claim.sub', :'q', false);
select tests.fails($$select public.moderate('post', (select id from public.community_posts where title = 'Best tacos in Oaxaca'), 'published', '')$$,
  'members cannot moderate');
select tests.fails($$select public.moderate('gem', (select id from public.gems limit 1), 'hidden', '')$$, 'community moderators cannot moderate gems');
select set_config('request.jwt.claim.sub', :'p', false);
delete from public.community_members where user_id = :'q';
select tests.ok(not exists (select 1 from public.community_members where user_id = :'q'), 'community moderators can remove members');
delete from public.community_members where user_id = :'o';
select tests.ok(exists (select 1 from public.community_members where user_id = :'o'), 'the owner is still a member');
select set_config('request.jwt.claim.sub', :'q', false);
insert into public.community_members (community_id) select id from public.communities where slug = 'night-market-crew';

-- Reports -------------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'o', false);
insert into public.reports (target_type, target_id, reason) select 'post', id::text, 'spam' from public.community_posts where title = 'Best tacos in Oaxaca';
select set_config('request.jwt.claim.sub', :'p', false);
insert into public.reports (target_type, target_id, reason) select 'post', id::text, 'spam' from public.community_posts where title = 'Best tacos in Oaxaca';
select set_config('request.jwt.claim.sub', :'m', false);
insert into public.reports (target_type, target_id, reason) select 'post', id::text, 'inaccurate' from public.community_posts where title = 'Best tacos in Oaxaca';
reset role;
select tests.ok((select status from public.community_posts where title = 'Best tacos in Oaxaca') = 'hidden', 'three reports hide a post');
select tests.ok((select post_count from public.communities where slug = 'night-market-crew') = 0, 'hidden posts leave the post count');
set role authenticated;
select set_config('request.jwt.claim.sub', :'m', false);
select public.moderate('post', (select id from public.community_posts where title = 'Best tacos in Oaxaca'), 'published', 'Fine');
reset role;
select tests.ok((select status = 'published' and report_count = 0 from public.community_posts where title = 'Best tacos in Oaxaca'), 'site moderators restore posts');
select tests.ok(not exists (select 1 from public.reports where target_type = 'post' and status = 'open'), 'and close the reports');
set role authenticated;

-- Recommendation → hidden gem ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'q', false);
insert into public.gems (name, description, lat, lng, country, source_post_id)
  select 'Pasillo de Humo', 'Smoky grill hall inside Mercado 20 de Noviembre.', 17.06, -96.72, 'Mexico', id from public.community_posts where title = 'Best tacos in Oaxaca';
select tests.ok((select status from public.gems where name = 'Pasillo de Humo') = 'pending', 'community recommendations go to review, not straight to Explore');
select tests.fails($$insert into public.gems (name, description, lat, lng, source_post_id) select 'Again', 'Second suggestion of the same post', 1, 1, id from public.community_posts where title = 'Best tacos in Oaxaca'$$,
  'a recommendation can be suggested once');
select set_config('request.jwt.claim.sub', :'o', false);
select tests.fails($$insert into public.gems (name, description, lat, lng, source_post_id) select 'Stolen', 'Someone else''s recommendation', 1, 1, id from public.community_posts where title = 'Best tacos in Oaxaca'$$,
  'cannot suggest someone else''s recommendation');
select tests.ok(not exists (select 1 from public.gems where name = 'Pasillo de Humo'), 'others cannot see it before review');
select set_config('request.jwt.claim.sub', :'m', false);
select public.moderate('gem', (select id from public.gems where name = 'Pasillo de Humo'), 'published', '');
select set_config('request.jwt.claim.sub', :'o', false);
select tests.ok(exists (select 1 from public.gems where name = 'Pasillo de Humo'), 'approved recommendations appear in Explore');

-- Profiles: photo, privacy, stats, follows ---------------------------------------------------------
update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/' || :'o' || '/me.jpg' where id = auth.uid();
select tests.fails(format($f$update public.profiles set avatar_url = 'https://x.supabase.co/storage/v1/object/public/avatars/%s/me.jpg' where id = auth.uid()$f$, :'p'),
  'profile photo must be in your own folder');
select tests.fails($$update public.profiles set avatar_url = 'https://evil.example/me.jpg' where id = auth.uid()$$, 'profile photo must be in Orbis storage');
select tests.fails($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'cannot make yourself an admin');
select tests.fails($$update public.profiles set xp = 99999 where id = auth.uid()$$, 'cannot set your own XP');
update public.profiles set name = 'Hacked' where id = :'p';
select tests.ok((select name from public.profiles where id = :'p') = 'Pablo', 'cannot edit someone else''s profile');
select tests.ok((select preferences ->> 'pace' from public.get_my_profile()) = 'slow', 'get_my_profile returns your private settings');
select tests.ok((select count(*) from public.get_my_profile()) = 1, 'and only your own row');
select tests.fails($$select preferences from public.profiles where id = '88888888-8888-4888-8888-888888888888'$$, 'other people''s private settings are not readable');
select tests.fails($$select watching from public.profiles where id = auth.uid()$$, 'private columns are only available through get_my_profile');
select tests.ok((select handle from public.profiles where id = :'p') = 'pablo', 'public profile columns are readable');
insert into public.follows (followee_id) values (:'p');
select tests.ok((public.profile_stats(:'p') ->> 'followers')::int = 1 and (public.profile_stats(:'o') ->> 'communities')::int = 2, 'profile stats count followers and communities');
select tests.ok(public.profile_stats(:'d') is null, 'no stats for private profiles');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select tests.ok((select count(*) from public.follows where follower_id = :'o') = 1, 'public follow edges are visible');
select tests.fails($$select email from auth.users$$, 'anon cannot read emails');
select tests.fails($$select preferences from public.profiles$$, 'anon cannot read private settings');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'d', false);
insert into public.community_members (community_id) select id from public.communities where slug = 'night-market-crew';
select set_config('request.jwt.claim.sub', :'o', false);
select tests.ok(not exists (select 1 from public.community_members where user_id = :'d'), 'private members are not listed to others');
select set_config('request.jwt.claim.sub', :'d', false);
select tests.ok(exists (select 1 from public.community_members where user_id = :'d'), 'but you can see your own memberships');

-- Owner deletes the community; everything inside goes with it ----------------------------------------
select set_config('request.jwt.claim.sub', :'p', false);
delete from public.communities where slug = 'night-market-crew';
select tests.ok(exists (select 1 from public.communities where slug = 'night-market-crew'), 'community moderators cannot delete the community');
select set_config('request.jwt.claim.sub', :'o', false);
delete from public.communities where slug = 'night-market-crew';
reset role;
select tests.ok(not exists (select 1 from public.communities where slug = 'night-market-crew'), 'owner deletes the community');
select tests.ok(not exists (select 1 from public.community_posts where title = 'Best tacos in Oaxaca') and not exists (select 1 from public.post_comments)
  and not exists (select 1 from public.community_members m left join public.communities c on c.id = m.community_id where c.id is null),
  'its posts, comments and memberships are removed');
select tests.ok((select source_post_id is null from public.gems where name = 'Pasillo de Humo'), 'approved gems stay in Explore');

-- API surface ------------------------------------------------------------------------------------
select tests.ok(not has_function_privilege('anon', 'public.set_member_role(uuid, uuid, text)', 'execute'), 'anon cannot call set_member_role');
select tests.ok(not has_function_privilege('anon', 'public.get_my_profile()', 'execute'), 'anon cannot call get_my_profile');
select tests.ok(not has_function_privilege('authenticated', 'public.community_posts_before_write()', 'execute'), 'trigger functions are not callable');
select tests.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'every public table has row level security');

-- The app joins related rows through these foreign keys by name (src/api/supabase.ts).
select tests.ok((select count(*) from pg_constraint where contype = 'f' and conname in (
  'community_members_user_id_fkey', 'community_posts_author_id_fkey', 'follows_followee_id_fkey', 'follows_follower_id_fkey',
  'gems_author_id_fkey', 'post_comments_author_id_fkey', 'tips_author_id_fkey')) = 7, 'foreign keys used by the app''s joins exist');
select tests.ok((select count(*) from pg_constraint where contype = 'f' and conrelid = 'public.community_posts'::regclass and confrelid = 'public.communities'::regclass) = 1
  and (select count(*) from pg_constraint where contype = 'f' and conrelid = 'public.post_media'::regclass and confrelid = 'public.community_posts'::regclass) = 1,
  'post → community and post → photos joins are unambiguous');
