-- Al completar (o reabrir) una tarea de un hito de Meta Timing en el Panel, se actualiza Notion al instante
-- vía la función notion-hito (usa NOTION_TOKEN de los secretos de Edge Functions).
create or replace function public.tasks_avisar_notion() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if new.origen_ref like 'meta-timing:%' and old.status is distinct from new.status
     and (new.status = 'completed' or old.status = 'completed') then
    perform net.http_post(
      url := 'https://zyldzmaeykxwildnpetx.supabase.co/functions/v1/notion-hito',
      headers := jsonb_build_object('Content-Type', 'application/json',
                   'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'celulas_cron_secret')),
      body := jsonb_build_object('task_id', new.id),
      timeout_milliseconds := 20000);
  end if;
  return null;
end $$;
drop trigger if exists tasks_avisar_notion on public.tasks;
create trigger tasks_avisar_notion after update of status on public.tasks
  for each row execute function public.tasks_avisar_notion();
revoke all on function public.tasks_avisar_notion() from public, anon, authenticated;
