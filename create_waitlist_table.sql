-- Run this in the Supabase SQL Editor before enabling waitlist mode.

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid                     DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Optional: disable RLS (table is only written to via service role key)
ALTER TABLE public.waitlist DISABLE ROW LEVEL SECURITY;
