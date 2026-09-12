-- Gemini cutover for chatbot settings model defaults and stored values

alter table public.chatbot_settings
  alter column ai_model set default 'google/gemini-2.5-flash';

update public.chatbot_settings
set ai_model = case
  when ai_model in ('google/gemini-2.5-flash', 'google/gemini-2.5-pro') then ai_model
  when ai_model in ('openai/gpt-4o', 'openai-gpt-4o', 'gpt-4o') then 'google/gemini-2.5-pro'
  when ai_model in ('openai/gpt-4o-mini', 'openai-gpt-4o-mini', 'gpt-4o-mini') then 'google/gemini-2.5-flash'
  else 'google/gemini-2.5-flash'
end
where ai_model is distinct from case
  when ai_model in ('google/gemini-2.5-flash', 'google/gemini-2.5-pro') then ai_model
  when ai_model in ('openai/gpt-4o', 'openai-gpt-4o', 'gpt-4o') then 'google/gemini-2.5-pro'
  when ai_model in ('openai/gpt-4o-mini', 'openai-gpt-4o-mini', 'gpt-4o-mini') then 'google/gemini-2.5-flash'
  else 'google/gemini-2.5-flash'
end;
