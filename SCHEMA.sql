-- Create Surveys Table
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  theme_color TEXT DEFAULT '#0ea5e9',
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Add logo_url column if it doesn't exist (migration for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'surveys' AND column_name = 'logo_url') THEN
        ALTER TABLE surveys ADD COLUMN logo_url TEXT;
    END IF;
END $$;

-- Create Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  hint TEXT,
  type TEXT NOT NULL, -- 'text', 'choice', 'rating'
  options JSONB, -- For choice type: ["Option 1", "Option 2"]
  required BOOLEAN DEFAULT FALSE,
  allow_other BOOLEAN DEFAULT FALSE,
  "order" INTEGER NOT NULL,
  logic JSONB -- Store skip logic rules e.g. { "action": "show", "condition": { "questionId": "...", "operator": "equals", "value": "..." } }
);

-- Add logic column if it doesn't exist (migration for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'logic') THEN
        ALTER TABLE questions ADD COLUMN logic JSONB;
    END IF;
END $$;

-- Create Responses Table
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Answers Table
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES responses(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  answer_value TEXT NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts when re-running
DROP POLICY IF EXISTS "Public read surveys" ON surveys;
DROP POLICY IF EXISTS "Public read questions" ON questions;
DROP POLICY IF EXISTS "Public insert responses" ON responses;
DROP POLICY IF EXISTS "Public insert answers" ON answers;
DROP POLICY IF EXISTS "Enable all for everyone" ON surveys;
DROP POLICY IF EXISTS "Enable all for everyone" ON questions;
DROP POLICY IF EXISTS "Enable all for everyone" ON responses;
DROP POLICY IF EXISTS "Enable all for everyone" ON answers;

-- Policies
CREATE POLICY "Public read surveys" ON surveys FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public insert responses" ON responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert answers" ON answers FOR INSERT WITH CHECK (true);

-- Admin policies (Simple: anyone can manage for now)
CREATE POLICY "Enable all for everyone" ON surveys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for everyone" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for everyone" ON responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for everyone" ON answers FOR ALL USING (true) WITH CHECK (true);
