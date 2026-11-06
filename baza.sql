create table store (id int primary key, data jsonb);
alter table store enable row level security;
