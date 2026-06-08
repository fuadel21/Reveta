-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a more restrictive INSERT policy using the trigger's SECURITY DEFINER context
-- The triggers run with SECURITY DEFINER so they can insert
-- For direct inserts, users can only insert notifications for themselves
CREATE POLICY "Triggers can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);