-- Coach ↔ Client messaging
CREATE TABLE IF NOT EXISTS coach_messages (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz DEFAULT now() NOT NULL,
  read_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_coach_messages_thread  ON coach_messages (coach_id, client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_coach_messages_client  ON coach_messages (client_id);
CREATE INDEX IF NOT EXISTS idx_coach_messages_unread  ON coach_messages (client_id, read_at) WHERE read_at IS NULL;

ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

-- Coaches: read all messages in their threads
CREATE POLICY "coach_read" ON coach_messages
  FOR SELECT USING (coach_id = auth.uid());

-- Coaches: send messages as themselves
CREATE POLICY "coach_insert" ON coach_messages
  FOR INSERT WITH CHECK (coach_id = auth.uid() AND sender_id = auth.uid());

-- Clients: read messages in their thread
CREATE POLICY "client_read" ON coach_messages
  FOR SELECT USING (client_id = auth.uid());

-- Clients: send messages only to coaches they are rostered with
CREATE POLICY "client_insert" ON coach_messages
  FOR INSERT WITH CHECK (
    client_id = auth.uid() AND
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM coach_clients
      WHERE coach_clients.coach_id = coach_messages.coach_id
        AND coach_clients.client_id = auth.uid()
        AND coach_clients.status = 'active'
    )
  );

-- Both parties can mark messages as read
CREATE POLICY "mark_read" ON coach_messages
  FOR UPDATE USING (coach_id = auth.uid() OR client_id = auth.uid())
  WITH CHECK  (coach_id = auth.uid() OR client_id = auth.uid());
