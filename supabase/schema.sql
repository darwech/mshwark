-- HATLY PRODUCTION DATABASE
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 phone text,
 role text not null check (role in ('customer','driver','admin')) default 'customer',
 vehicle_type text,
 national_id text,
 driver_status text check (driver_status in ('pending','approved','rejected')) default 'pending',
 is_available boolean default false,
 rating numeric(2,1) default 5.0,
 created_at timestamptz default now()
);

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id),
 driver_id uuid references public.profiles(id),
 items_description text not null,
 store_name text not null,
 delivery_address text not null,
 customer_phone text,
 notes text,
 delivery_fee numeric(10,2),
 items_price numeric(10,2),
 receipt_url text,
 status text not null default 'requested' check (status in ('requested','offer_sent','offer_accepted','offer_rejected','shopping','purchased','delivering','delivered','cancelled')),
 created_at timestamptz default now(),
 updated_at timestamptz default now()
);

create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 body text,
 is_read boolean default false,
 created_at timestamptz default now()
);

create table if not exists public.ratings (
 id uuid primary key default gen_random_uuid(),
 order_id uuid unique not null references public.orders(id) on delete cascade,
 customer_id uuid not null references public.profiles(id),
 driver_id uuid not null references public.profiles(id),
 stars int not null check(stars between 1 and 5),
 comment text,
 created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table orders enable row level security;
alter table notifications enable row level security;
alter table ratings enable row level security;

create policy "profiles readable by authenticated" on profiles for select to authenticated using (true);
create policy "users update own profile" on profiles for update to authenticated using (auth.uid()=id);
create policy "customers create orders" on orders for insert to authenticated with check(auth.uid()=customer_id);
create policy "participants read orders" on orders for select to authenticated using(auth.uid()=customer_id or auth.uid()=driver_id or exists(select 1 from profiles p where p.id=auth.uid() and p.role='admin'));
create policy "participants update orders" on orders for update to authenticated using(auth.uid()=customer_id or auth.uid()=driver_id or exists(select 1 from profiles p where p.id=auth.uid() and p.role='admin'));
create policy "own notifications" on notifications for select to authenticated using(auth.uid()=user_id);
create policy "ratings readable" on ratings for select to authenticated using(true);
create policy "customer rates own order" on ratings for insert to authenticated with check(auth.uid()=customer_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,phone,role,vehicle_type,national_id,driver_status,is_available)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name','مستخدم'),new.raw_user_meta_data->>'phone',coalesce(new.raw_user_meta_data->>'role','customer'),new.raw_user_meta_data->>'vehicle_type',new.raw_user_meta_data->>'national_id',case when coalesce(new.raw_user_meta_data->>'role','customer')='driver' then 'pending' else null end,false);
 return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.driver_send_offer(p_order_id uuid,p_fee numeric) returns void language plpgsql security definer as $$
declare c uuid;
begin
 update orders set delivery_fee=p_fee,status='offer_sent',updated_at=now() where id=p_order_id and driver_id=auth.uid() returning customer_id into c;
 if c is null then raise exception 'غير مسموح'; end if;
 insert into notifications(user_id,title,body) values(c,'عرض سعر جديد','المندوب أرسل سعر المشوار. افتح الطلب للقبول أو الرفض.');
end; $$;

create or replace function public.customer_decide_offer(p_order_id uuid,p_accept boolean) returns void language plpgsql security definer as $$
declare d uuid;
begin
 update orders set status=case when p_accept then 'offer_accepted' else 'offer_rejected' end,updated_at=now() where id=p_order_id and customer_id=auth.uid() returning driver_id into d;
 if d is null then raise exception 'غير مسموح'; end if;
 insert into notifications(user_id,title,body) values(d,case when p_accept then 'تم قبول عرضك' else 'تم رفض عرضك' end,case when p_accept then 'العميل وافق على سعر المشوار ويمكنك بدء التنفيذ.' else 'العميل رفض سعر المشوار.' end);
end; $$;

alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table notifications;
