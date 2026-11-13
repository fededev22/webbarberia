-- Solera guarda cada colección en filas jsonb.
-- La service role las lee todas. RLS sin políticas cierra la anon key.

create table if not exists solera_records (
  collection text not null,
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists solera_records_collection_idx on solera_records (collection);

alter table solera_records enable row level security;

-- Ejemplo para mirar turnos desde el SQL editor:
-- select payload->>'customerName', payload->>'start', payload->>'status'
-- from solera_records where collection = 'appointments';
