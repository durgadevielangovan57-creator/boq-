-- 0003_messages.sql - create messages table for support system

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  sender_role TEXT,
  message TEXT NOT NULL,
  info TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_role ON messages (sender_role);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
