-- Create temp_credentials table to store generated accounts for students
CREATE TABLE IF NOT EXISTS public.temp_credentials (
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  temp_password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.temp_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can view all temp credentials
DROP POLICY IF EXISTS "Admins can view temp credentials" ON public.temp_credentials;
CREATE POLICY "Admins can view temp credentials" 
ON public.temp_credentials 
FOR SELECT 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- RLS Policy: Admins can modify temp credentials (inserts, updates, deletes)
DROP POLICY IF EXISTS "Admins can modify temp credentials" ON public.temp_credentials;
CREATE POLICY "Admins can modify temp credentials" 
ON public.temp_credentials 
FOR ALL 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
