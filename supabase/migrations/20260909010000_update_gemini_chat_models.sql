alter table public.chatbot_settings
  alter column ai_model set default 'google/gemini-3.8-flash';

update public.chatbot_settings
set ai_model = case
  when ai_model in ('google/gemini-2.5-pro', 'google/gemini-3-pro-preview')
    then 'google/gemini-3.1-pro-preview'
  else 'google/gemini-3.8-flash'
end
where ai_model in (
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-pro',
  'google/gemini-3-flash',
  'google/gemini-3-flash-preview',
  'google/gemini-3-pro-preview'
);
