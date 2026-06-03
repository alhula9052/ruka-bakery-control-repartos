-- Agregar RUT a clientes para Ruka Bakery
alter table public.clients
add column if not exists rut text;

create unique index if not exists clients_rut_unique_not_null
on public.clients (rut)
where rut is not null and rut <> '';

comment on column public.clients.rut is 'RUT chileno del cliente en formato 12.345.678-9';
