# Gym Tracker

A personal gym planner and journal: plan each session, record what you actually did, compare planned with actual, keep a library of your machines, and follow your progress.

## Sections
- **Home**: today's workout, completed count (for example 3/4), planned vs. actual per exercise, this week.
- **My Plan**: a weekly schedule (a template for each weekday) and a calendar where any date can have its own plan.
- **Workout**: record results while you train. Treadmill (time, distance, speed, incline, calories), stair climber (time, floors, steps, calories), bike (time, distance, speed, resistance, calories), strength (sets with reps, weight and a done tick). Photos of the machine screen, notes, timer.
- **Equipment**: your machines with photos, muscles, how to use them, your settings, a usual target, favourites and history.
- **Progress**: workouts and completed targets, a consistency map, workouts and cardio per week, exercise progression (heaviest set, volume, cardio numbers), body measurements, achievements, history, before/after photos.
- **Profile**: goals, units (kg/km or lb/mi), light/dark, measurements, sync account, backup and restore.

## Run
```
npm start          # http://localhost:5190
```
Static site in `www/` (no build step). Data is saved in the browser (IndexedDB), photos are shrunk to 1600 px JPEGs.

## Sync
`www/js/config.js` holds the Supabase URL and publishable key. Empty = everything stays on the device.
Expected backend: table `public.gym_state (user_id uuid primary key references auth.users, state jsonb, device text, updated_at timestamptz)` with owner-only RLS, and a private storage bucket `gym-photos` with files at `<user id>/<photo id>.jpg`.

## Phone apps
- Android: `npx cap sync android`, then in `android/`: `./gradlew assembleDebug` (needs JAVA_HOME = openjdk 21 and ANDROID_HOME). APK copied to `GymTracker.apk`.
- iPhone: needs Xcode and CocoaPods (not installed on this Mac). Until then, open the hosted site in Safari and use Share → Add to Home Screen.
