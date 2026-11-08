-- Waitlist: validation, de-duplication, bot and rate-limit protection, privacy, app linking.
-- Uses the tests.ok / tests.fails helpers created in test_01_security.sql.
set client_min_messages = notice;
reset role;
select set_config('request.jwt.claim.sub', '', false);
create function tests.as_visitor(ip text) returns void language sql as $$
  select set_config('request.headers', json_build_object('x-forwarded-for', ip || ', 10.0.0.1')::text, false);
$$;

set role anon;
select tests.as_visitor('203.0.113.10');
select tests.ok(public.join_waitlist('Ada@Example.com', 'Ada', array['events', 'food', 'not-a-real-interest'], 'Night markets!', 'website',
  '{"utm_source":"instagram","evil":"x"}', 'https://instagram.com/', 'en') ->> 'status' = 'joined', 'visitor joins the waitlist');
select tests.ok(public.join_waitlist('  ada@example.COM ') ->> 'status' = 'already_joined', 'same email in a different case is a duplicate');
select tests.ok(public.join_waitlist('not-an-email') ->> 'status' = 'invalid_email', 'invalid email is rejected');
select tests.ok(public.join_waitlist('x@y') ->> 'status' = 'invalid_email', 'email without a domain is rejected');
select tests.ok(public.join_waitlist('bob@example.com', repeat('b', 61)) ->> 'status' = 'invalid', 'over-long first name is rejected');
select tests.ok(public.join_waitlist('spam@example.com', 'Visit https://spam.example') ->> 'status' = 'invalid', 'link in the name field is rejected');
select tests.ok(public.join_waitlist('bot@example.com', p_website => 'http://bot.example') ->> 'status' = 'joined', 'honeypot gets a normal-looking answer');
select tests.fails($$select * from public.waitlist_signups$$, 'anon cannot read the waitlist');
select tests.fails($$insert into public.waitlist_signups (email) values ('direct@example.com')$$, 'anon cannot insert directly');
select tests.fails($$delete from public.waitlist_signups$$, 'anon cannot delete');
select tests.fails($$select * from private.waitlist_attempts$$, 'anon cannot read the attempt log');
reset role;

select tests.ok((select count(*) from public.waitlist_signups) = 1, 'only one real signup stored (duplicate, invalid and bot were not)');
select tests.ok((select interests = array['events', 'food'] and utm = '{"utm_source":"instagram"}' and source = 'website' and locale = 'en' and first_name = 'Ada' and email = 'ada@example.com'
  from public.waitlist_signups), 'unknown interests and UTM keys are dropped; email normalised');
select tests.ok(not exists (select 1 from private.waitlist_attempts where ip_hash like '%203.0.113%'), 'IP addresses are stored only as hashes');

-- Rate limit: 8 attempts per visitor per hour.
set role anon;
select tests.as_visitor('198.51.100.7');
select public.join_waitlist('rate' || g || '@example.com') from generate_series(1, 8) g;
select tests.ok(public.join_waitlist('rate9@example.com') ->> 'status' = 'rate_limited', '9th attempt in an hour is rate limited');
select tests.as_visitor('198.51.100.8');
select tests.ok(public.join_waitlist('other-visitor@example.com') ->> 'status' = 'joined', 'other visitors are unaffected');
reset role;

-- Signed-in users can't read it either.
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);
select tests.fails($$select * from public.waitlist_signups$$, 'signed-in users cannot read the waitlist');
select set_config('request.jwt.claim.sub', '', false);
reset role;

-- Creating an app account links an existing waitlist signup.
insert into auth.users (id, email) values ('66666666-6666-4666-8666-666666666666', 'Ada@example.com');
select tests.ok((select user_id from public.waitlist_signups where email = 'ada@example.com') = '66666666-6666-4666-8666-666666666666',
  'signing up for the app links the waitlist entry');
delete from auth.users where id = '66666666-6666-4666-8666-666666666666';
select tests.ok((select user_id is null from public.waitlist_signups where email = 'ada@example.com'), 'deleting the account keeps the signup but unlinks it');
