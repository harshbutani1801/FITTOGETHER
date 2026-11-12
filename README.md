# FITTOGETHER

A private fitness space for two people to manage weekly workout plans and track progress together.

## Local development

1. Install packages with `npm install`.
2. Create `.env.local` from `.env.example` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project settings.
3. Start the app with `npm run dev`.

The public anon key is intended for browser use and is protected by Row Level Security. Never add a Supabase service-role key to a `NEXT_PUBLIC_` variable or browser code. `.env*` files are ignored by Git.

## Supabase setup

1. Create a Supabase project and configure its URL and anon key locally and in Vercel.
2. In Supabase **Authentication > Settings**, turn off public sign-ups. Create the Harsh and Partner accounts through the Supabase dashboard using **Authentication > Users > Add user**. Do not put passwords in this repository.
3. Apply every SQL file under `supabase/migrations` in filename order. This repo includes the Supabase CLI as a dev dependency; run `npx supabase login`, `npx supabase link --project-ref <project-ref>`, then `npx supabase db push`. Alternatively, run the migration file contents in order in the Supabase SQL Editor.
4. The migrations create the profile trigger, private progress-photo bucket, database tables, indexes, RLS policies, sharing checks, and transactional RPCs. Do not disable RLS.
5. To pair the two profiles, get each user UUID from **Authentication ? Users** and run this once in the SQL Editor, replacing the placeholders with the same newly generated UUID and the two account UUIDs:

   ```sql
   update public.profiles
   set pair_id = '00000000-0000-4000-8000-000000000001'
   where id in (
     'HARSH_AUTH_USER_UUID',
     'PARTNER_AUTH_USER_UUID'
   );
   ```

   The application cannot set or change `pair_id`. Each user controls their own sharing switches in Settings; sharing is off by default. Measurements, workouts, performance, and photos are independently gated. Workout and measurement notes remain private.
6. The auth trigger creates a profile, sharing preferences, and unit/timezone preferences when each user is created. Set each display name to `Harsh` or the partner’s preferred name in Settings.

## Security model

- Every private row is scoped to `auth.uid()` by RLS.
- Workout plan replacement uses an authenticated database RPC. It binds the plan to the signed-in user, archives the prior version, writes all seven weekdays and exercises, and activates the new version in one transaction.
- Workout sessions are created for the server-derived local calendar date and selected plan weekday. Set logging and status changes use owner-checked RPCs.
- Progress photos live in a private Storage bucket. Object paths begin with the owner UUID; shared photo access requires both the account-level preference and that photo’s share switch.
- The private profile pair ID can only be assigned by a project administrator in Supabase.

## Current implementation

The app includes Supabase password sign-in and sign-out, protected dashboard routes, plan JSON validation/import/preview/comparison/version history/export, a manual plan editor, weekday scheduling, workouts and set logs, workout history, measurements and charts, private progress photos, sharing controls, and an exercise library. Workout and photo data require the migrations above to be applied to the configured Supabase project.

## Checks

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
