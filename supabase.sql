-- Supabase SQL Editor에서 전체 실행합니다. 비밀번호나 secret key는 넣지 않습니다.
create table if not exists public.game_admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.game_admins enable row level security;
create or replace function public.is_game_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.game_admins where user_id=auth.uid()); $$;
create table if not exists public.game_private (id integer primary key check(id=1),version bigint not null default 0,state jsonb,history jsonb not null default '[]',owner uuid,lease_until timestamptz);
create table if not exists public.game_state (id integer primary key check(id=1),version bigint not null default 0,state jsonb,updated_at timestamptz not null default now());
alter table public.game_private enable row level security;
alter table public.game_state enable row level security;
revoke all on public.game_admins,public.game_private,public.game_state from anon,authenticated;
grant select on public.game_state to anon,authenticated;
grant select on public.game_private to authenticated;
drop policy if exists audience_read on public.game_state;
create policy audience_read on public.game_state for select to anon,authenticated using(true);
drop policy if exists admin_read on public.game_private;
create policy admin_read on public.game_private for select to authenticated using(public.is_game_admin());
insert into public.game_private(id) values(1) on conflict do nothing;
insert into public.game_state(id) values(1) on conflict do nothing;
create or replace function public.server_time() returns timestamptz language sql as $$select clock_timestamp();$$;
create or replace function public.claim_game(client_id uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
declare expires timestamptz:=clock_timestamp()+interval '15 seconds';
begin
 if not public.is_game_admin() then raise exception '관리자 권한이 필요합니다'; end if;
 update public.game_private set owner=client_id,lease_until=expires where id=1;
 return expires;
end;$$;
create or replace function public.renew_game(client_id uuid) returns timestamptz language plpgsql security definer set search_path='' as $$
declare expires timestamptz;
begin
 if not public.is_game_admin() then raise exception '관리자 권한이 필요합니다'; end if;
 update public.game_private set lease_until=clock_timestamp()+interval '15 seconds' where id=1 and owner=client_id and lease_until>clock_timestamp() returning lease_until into expires;
 return expires;
end;$$;
create or replace function public.save_game(expected_version bigint,client_id uuid,next_state jsonb,next_history jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare current_row public.game_private; visible jsonb; safe_bank jsonb; next_version bigint;
begin
 if not public.is_game_admin() then raise exception '관리자 권한이 필요합니다'; end if;
 select * into current_row from public.game_private where id=1 for update;
 if current_row.owner is distinct from client_id or current_row.lease_until<clock_timestamp() then raise exception '조작권을 다시 이어받으세요'; end if;
 if current_row.version<>expected_version then raise exception '다른 변경이 먼저 저장되었습니다. 다시 불러오세요'; end if;
 if jsonb_array_length(next_state->'players')<>3 or jsonb_array_length(next_state->'scores')<>3 or (next_state->>'selected')::integer not between 0 and 2 then raise exception '잘못된 게임 상태'; end if;
 -- 관람자는 칸 유형만 받고, 문제은행과 공개 전 정답은 읽지 못합니다.
 select jsonb_agg(jsonb_build_object('id',c->'id','type',c->'type','enabled',c->'enabled')) into safe_bank from jsonb_array_elements(next_state->'bank') c;
 visible=jsonb_set(next_state,'{bank}',safe_bank);
 if next_state->'card' is not null and next_state->'card'<>'null'::jsonb then visible=jsonb_set(visible,'{card,isQuiz}',to_jsonb(coalesce(jsonb_array_length(next_state#>'{card,choices}'),0)>0)); end if;
 if next_state->>'screen'<>'answer' then visible=visible #- '{card,answer}'; end if;
 if next_state->>'screen'='intro' then visible=visible #- '{card,question}' #- '{card,choices}' #- '{card,prompt}'; end if;
 next_version=current_row.version+1;
 update public.game_private set version=next_version,state=next_state,history=next_history where id=1;
 update public.game_state set version=next_version,state=visible,updated_at=clock_timestamp() where id=1;
 return next_version;
end;$$;
revoke execute on function public.claim_game(uuid),public.renew_game(uuid),public.save_game(bigint,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.claim_game(uuid),public.renew_game(uuid),public.save_game(bigint,uuid,jsonb,jsonb) to authenticated;
do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_state') then alter publication supabase_realtime add table public.game_state; end if;
end$$;
-- Authentication > Users에서 만든 관리자 User UID로 바꾸어 별도로 실행:
-- insert into public.game_admins(user_id) values ('관리자-User-UID');

-- 최초 1회만 기본 29칸 문제은행을 넣습니다. 재실행해도 진행 중 게임은 유지합니다.
update public.game_private set state='{"version":3,"revision":0,"players":[{"path":["S"]},{"path":["S"]},{"path":["S"]}],"scores":[0,0,0],"selected":0,"screen":"board","at":0,"phase":"ready","route":"shortcut","busy":false,"passed":[],"notice":"","card":null,"timer":null,"scored":false,"outcome":null,"extra":false,"sound":true,"cheerTarget":0,"cheerWinner":null,"cheerAwarded":false,"returnScreen":"board","chance":null,"chanceApplied":false,"turnAt":0,"flash":"","flashUntil":0,"bank":[{"id":1,"type":"chuseok","title":"풍성한 한가위","choices":["떡국","팥빙수","붕어빵","송편"],"answer":"송편","duration":20,"enabled":true,"question":"추석에 먹는 대표적인 음식은?"},{"id":2,"type":"town","title":"정겨운 우리동네","choices":["목욕탕","정류장","도서관","우체국"],"answer":"도서관","duration":20,"enabled":true,"question":"우리 동네에서 책을 빌려 읽는 곳은?"},{"id":3,"type":"memory","title":"그때 그 시절","choices":["체","다듬이방망이","주걱","국자"],"answer":"다듬이방망이","duration":20,"enabled":true,"question":"옛날에 옷감을 두드려 펴던 도구는?"},{"id":4,"type":"song","title":"노래 한 소절","prompt":"♪ 「고향의 봄」 첫 소절을\n다 함께 불러주세요!","duration":20,"enabled":true,"question":""},{"id":5,"type":"mission","title":"사랑을 모아 하트!","prompt":"우리 팀 모두 머리 위로\n커다란 하트를 만들어주세요!","duration":20,"enabled":true,"question":""},{"id":6,"type":"chance","title":"복주머니가 열렸어요!","prompt":"옆 사람에게 따뜻한 덕담 한마디!\n“올 추석도 행복하세요!”","duration":20,"enabled":true,"question":""},{"id":7,"type":"special","title":"관장님이 쏜다!","prompt":"[점수:2] 관장님이 쏜다!","duration":20,"enabled":true,"question":""},{"id":8,"type":"town","title":"정겨운 우리동네","choices":["우체국","미용실","빵집","도서관"],"answer":"우체국","duration":20,"enabled":true,"question":"편지나 소포를 보내는 곳은?"},{"id":9,"type":"song","title":"흥겨운 노래 한 소절","prompt":"♪ 「아리랑」 한 소절을\n박수에 맞춰 함께 불러주세요!","duration":20,"enabled":true,"question":""},{"id":10,"type":"memory","title":"그때 그 시절","choices":["제기","공기돌","연","팽이"],"answer":"연","duration":20,"enabled":true,"question":"종이와 대나무 살로 만들어 하늘에 날리는 것은?"},{"id":11,"type":"chuseok","title":"풍성한 한가위","choices":["설날","한가위","단오","동지"],"answer":"한가위","duration":20,"enabled":true,"question":"추석의 다른 이름은 무엇일까요?"},{"id":12,"type":"cheer","title":"다 함께 응원타임!","prompt":"우리 팀도, 옆 팀도 힘내세요!\n다 함께 박수 치며 응원해요!","duration":20,"enabled":true,"question":""},{"id":13,"type":"memory","title":"그때 그 시절","choices":["커피","탄산수","레몬차","식혜"],"answer":"식혜","duration":20,"enabled":true,"question":"밥알이 동동 떠 있는 달콤한 전통 음료는?"},{"id":14,"type":"chance","title":"웃음꽃이 피었습니다!","prompt":"옆 사람과 눈을 맞추고\n활짝 웃으며 인사해주세요!","duration":20,"enabled":true,"question":""},{"id":15,"type":"mission","title":"우리 팀의 멋진 구호!","prompt":"우리 팀 이름을 함께 외치고\n“파이팅!”으로 마무리해주세요!","duration":20,"enabled":true,"question":""},{"id":16,"type":"chuseok","title":"풍성한 한가위","choices":["보름달","초승달","반달","그믐달"],"answer":"보름달","duration":20,"enabled":true,"question":"추석 밤하늘에 뜨는 둥근 달은?"},{"id":17,"type":"town","title":"정겨운 우리동네","choices":["횡단보도","주방","운동장","버스 정류장"],"answer":"버스 정류장","duration":20,"enabled":true,"question":"우리 동네에서 버스를 기다리는 곳은?"},{"id":18,"type":"memory","title":"그때 그 시절","choices":["공기놀이","씨름","제기차기","윷놀이"],"answer":"제기차기","duration":20,"enabled":true,"question":"발로 톡톡 차며 즐기던 전통놀이는?"},{"id":19,"type":"special","title":"구청장님이 쏜다!","prompt":"[한번더] 구청장님이 쏜다!","duration":20,"enabled":true,"question":""},{"id":20,"type":"mission","title":"추석맞이 단체 노래!","prompt":"진행자가 준비한 추석맞이 노래를\n모두 함께 신나게 불러주세요!","duration":20,"enabled":true,"question":""},{"id":21,"type":"chuseok","title":"풍성한 한가위","choices":["상추","김","배추","솔잎"],"answer":"솔잎","duration":20,"enabled":true,"question":"송편을 찔 때 밑에 깔아 향을 내는 것은?"},{"id":22,"type":"town","title":"정겨운 우리동네","choices":["우체국","소방서","시장","수영장"],"answer":"시장","duration":20,"enabled":true,"question":"우리 동네에서 여러 가게가 모여 물건을 파는 곳은?"},{"id":23,"type":"memory","title":"그때 그 시절","choices":["투호","강강술래","줄다리기","널뛰기"],"answer":"강강술래","duration":20,"enabled":true,"question":"손을 잡고 둥글게 돌며 즐기는 전통놀이는?"},{"id":24,"type":"song","title":"고향을 떠올리는 시간","prompt":"좋아하는 고향 노래 한 소절을\n우리 팀 대표가 들려주세요!","duration":20,"enabled":true,"question":""},{"id":25,"type":"chance","title":"칭찬 복주머니!","prompt":"우리 팀의 좋은 점을\n다 함께 한 가지씩 말해주세요!","duration":20,"enabled":true,"question":""},{"id":26,"type":"special","title":"지회장님이 쏜다!","prompt":"[선물] 지회장님이 쏜다!","duration":20,"enabled":true,"question":""},{"id":27,"type":"golden","title":"50개 경로당, 하나의 마음!","prompt":"모두 머리 위로 큰 하트를 만들고\n“풍성한 한가위 되세요!”를 외쳐주세요!","duration":20,"enabled":true,"question":""},{"id":28,"type":"mission","title":"박수로 마음을 모아요!","prompt":"진행자의 박수 리듬을 듣고\n우리 팀 모두 똑같이 따라 해주세요!","duration":20,"enabled":true,"question":""},{"id":29,"type":"chance","title":"행운의 추석 인사!","prompt":"다른 팀을 향해 손을 흔들며\n“건강하고 행복하세요!”라고 인사해주세요!","duration":20,"enabled":true,"question":""}],"bankAt":null}'::jsonb where id=1 and state is null;
update public.game_state set state='{"version":3,"revision":0,"players":[{"path":["S"]},{"path":["S"]},{"path":["S"]}],"scores":[0,0,0],"selected":0,"screen":"board","at":0,"phase":"ready","route":"shortcut","busy":false,"passed":[],"notice":"","card":null,"timer":null,"scored":false,"outcome":null,"extra":false,"sound":true,"cheerTarget":0,"cheerWinner":null,"cheerAwarded":false,"returnScreen":"board","chance":null,"chanceApplied":false,"turnAt":0,"flash":"","flashUntil":0,"bank":[{"id":1,"type":"chuseok","enabled":true},{"id":2,"type":"town","enabled":true},{"id":3,"type":"memory","enabled":true},{"id":4,"type":"song","enabled":true},{"id":5,"type":"mission","enabled":true},{"id":6,"type":"chance","enabled":true},{"id":7,"type":"special","enabled":true},{"id":8,"type":"town","enabled":true},{"id":9,"type":"song","enabled":true},{"id":10,"type":"memory","enabled":true},{"id":11,"type":"chuseok","enabled":true},{"id":12,"type":"cheer","enabled":true},{"id":13,"type":"memory","enabled":true},{"id":14,"type":"chance","enabled":true},{"id":15,"type":"mission","enabled":true},{"id":16,"type":"chuseok","enabled":true},{"id":17,"type":"town","enabled":true},{"id":18,"type":"memory","enabled":true},{"id":19,"type":"special","enabled":true},{"id":20,"type":"mission","enabled":true},{"id":21,"type":"chuseok","enabled":true},{"id":22,"type":"town","enabled":true},{"id":23,"type":"memory","enabled":true},{"id":24,"type":"song","enabled":true},{"id":25,"type":"chance","enabled":true},{"id":26,"type":"special","enabled":true},{"id":27,"type":"golden","enabled":true},{"id":28,"type":"mission","enabled":true},{"id":29,"type":"chance","enabled":true}],"bankAt":null}'::jsonb where id=1 and state is null;
