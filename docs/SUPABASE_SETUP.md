# Supabase Setup Guide

## ✅ Completed Steps

1. ✅ Installed `@supabase/supabase-js`
2. ✅ Created `.env.local` with your Supabase credentials
3. ✅ Created Supabase client (`lib/supabase.ts`)
4. ✅ Created database helper functions (`lib/database.ts`)
5. ✅ Dev server restarted with environment variables loaded

## 🔧 Next Steps: Set Up Database

### 1. Go to Supabase SQL Editor

1. Open your Supabase project: https://supabase.com/dashboard/project/iptpdgitwwwfeqlvourf
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

### 2. Run the Schema SQL

1. Open the file `supabase/schema.sql` in your code editor
2. Copy ALL the contents
3. Paste into the Supabase SQL Editor
4. Click "Run" (or press Cmd/Ctrl + Enter)

This will create:
- ✅ All database tables (profiles, rushees, events, attendance, applications, evaluations, etc.)
- ✅ Row Level Security (RLS) policies
- ✅ Storage bucket for attendance photos
- ✅ Triggers for auto-updating timestamps

### 3. Enable Email Auth (if not already enabled)

1. Go to "Authentication" → "Providers" in Supabase dashboard
2. Make sure "Email" is enabled
3. Configure email templates if desired

### 4. Set Up Storage

The schema creates a storage bucket called `attendance-photos` for rushee check-in photos. This should be automatically created when you run the schema.

## 📊 Database Schema Overview

### Tables Created

- **profiles**: User accounts (extends Supabase auth)
- **rushee_profiles**: Additional rushee information
- **events**: Rush events
- **event_attendance**: Photo check-ins
- **applications**: Rushee applications
- **interactions**: Brother-rushee interactions at events
- **evaluations**: Brother evaluations of rushees
- **brother_notes**: Personal notes and starred rushees

### User Types

- `rushee`: Rush participants
- `brother`: Active chapter members
- `admin`: Brothers with admin privileges (VP of Recruitment)

## 🔐 Row Level Security

All tables have RLS enabled with policies that:
- Rushees can only see/edit their own data
- Brothers can view all rushee data
- Brothers can only edit their own evaluations/notes
- Admins have full access to manage everything

## 🎯 Using the Database

The helper functions in `lib/database.ts` provide easy-to-use functions for all database operations:

### Auth
```typescript
import { signUp, signIn, signOut, getCurrentUser } from '@/lib/database'

// Sign up a new rushee
await signUp('email@example.com', 'password', {
  full_name: 'John Doe',
  user_type: 'rushee'
})

// Sign in
await signIn('email@example.com', 'password')

// Get current user
const user = await getCurrentUser()
```

### Events
```typescript
import { getEvents, updateEventStatus } from '@/lib/database'

// Get all events
const { data: events } = await getEvents()

// Update event status (admin only)
await updateEventStatus(eventId, 'attendance')
```

### Attendance
```typescript
import { submitAttendance, getRusheeAttendance } from '@/lib/database'

// Submit attendance with photo
await submitAttendance(eventId, rusheeId, photoUrl)

// Get rushee's attendance record
const { data } = await getRusheeAttendance(rusheeId)
```

### Evaluations
```typescript
import { submitEvaluation } from '@/lib/database'

// Submit evaluation
await submitEvaluation(brotherId, rusheeId, eventId, {
  professional_score: 8,
  personal_score: 9,
  comments: 'Great candidate!'
})
```

## 🧪 Testing the Connection

You can test the Supabase connection by adding this to any page:

```typescript
import { supabase } from '@/lib/supabase'

// Test connection
const { data, error } = await supabase.from('profiles').select('count')
console.log('Supabase connected:', !error)
```

## 📝 Next Implementation Steps

1. Replace `TODO: Get from Supabase` comments with actual database calls
2. Implement authentication pages with real sign up/sign in
3. Connect forms to database (applications, evaluations, etc.)
4. Implement file upload for attendance photos
5. Add real-time subscriptions if needed

## 🔗 Useful Resources

- [Supabase JavaScript Client Docs](https://supabase.com/docs/reference/javascript)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Guide](https://supabase.com/docs/guides/storage)

## 🚨 Important Notes

- Never commit `.env.local` to git (it's already in .gitignore)
- The anon key is safe to use in client-side code
- RLS policies enforce security even if someone has the anon key
- For sensitive admin operations, consider using a service role key (server-side only)
