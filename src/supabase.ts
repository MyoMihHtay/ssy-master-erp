import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gihhtkelvwjpflvszspe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaGh0a2VsdndqcGZsdnN6c3BlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODcxMDAsImV4cCI6MjA5NTU2MzEwMH0.Y5Fnh91oJeEU8Kf9j9MJ1ot8RW9pjNuEE5MKpexY4zQ';

export const supabase = createClient(supabaseUrl, supabaseKey);
