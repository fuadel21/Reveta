-- Add verified field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications" 
ON public.notifications 
FOR DELETE 
USING (auth.uid() = user_id);

-- System can insert notifications (using service role)
CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  conv RECORD;
  recipient_id UUID;
  product_title TEXT;
BEGIN
  -- Get conversation details
  SELECT c.*, p.title INTO conv
  FROM conversations c
  JOIN products p ON p.id = c.product_id
  WHERE c.id = NEW.conversation_id;
  
  -- Determine recipient (the one who didn't send the message)
  IF NEW.sender_id = conv.buyer_id THEN
    recipient_id := conv.seller_id;
  ELSE
    recipient_id := conv.buyer_id;
  END IF;
  
  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    recipient_id,
    'new_message',
    'Nuevo mensaje',
    'Tienes un nuevo mensaje sobre ' || conv.title,
    jsonb_build_object('conversation_id', NEW.conversation_id, 'product_id', conv.product_id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new messages
CREATE TRIGGER on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_message();

-- Function to create notification on new offer
CREATE OR REPLACE FUNCTION public.notify_new_offer()
RETURNS TRIGGER AS $$
DECLARE
  conv RECORD;
  seller_id UUID;
  product_title TEXT;
BEGIN
  -- Get conversation and product details
  SELECT c.*, p.title, c.seller_id INTO conv
  FROM conversations c
  JOIN products p ON p.id = c.product_id
  WHERE c.id = NEW.conversation_id;
  
  -- Create notification for seller
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    conv.seller_id,
    'new_offer',
    'Nueva oferta recibida',
    'Has recibido una oferta de ' || NEW.amount || '€ por ' || conv.title,
    jsonb_build_object('offer_id', NEW.id, 'conversation_id', NEW.conversation_id, 'amount', NEW.amount)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for new offers
CREATE TRIGGER on_new_offer
AFTER INSERT ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_offer();

-- Function to create notification on offer status change
CREATE OR REPLACE FUNCTION public.notify_offer_status()
RETURNS TRIGGER AS $$
DECLARE
  conv RECORD;
  product_title TEXT;
  status_text TEXT;
BEGIN
  -- Only trigger on status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get conversation and product details
  SELECT c.*, p.title INTO conv
  FROM conversations c
  JOIN products p ON p.id = c.product_id
  WHERE c.id = NEW.conversation_id;
  
  -- Set status text
  IF NEW.status = 'accepted' THEN
    status_text := 'aceptada';
  ELSIF NEW.status = 'rejected' THEN
    status_text := 'rechazada';
  ELSE
    RETURN NEW;
  END IF;
  
  -- Notify buyer about offer status
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.buyer_id,
    'offer_' || NEW.status,
    'Oferta ' || status_text,
    'Tu oferta de ' || NEW.amount || '€ por ' || conv.title || ' ha sido ' || status_text,
    jsonb_build_object('offer_id', NEW.id, 'conversation_id', NEW.conversation_id, 'status', NEW.status)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for offer status changes
CREATE TRIGGER on_offer_status_change
AFTER UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.notify_offer_status();