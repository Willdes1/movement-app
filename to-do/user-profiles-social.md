# User Profile Bio + Follower & Athlete Network System

---

## 5. User Profile Bio Section

### Goal
Give every user a public-facing profile with a photo, title, and bio — similar to Instagram. Makes the app feel like a community, not just a solo training tool.

### Profile Fields (additions to existing profile)
| Field | Description |
|---|---|
| **Profile photo** | Already exists (avatar_url). Improve the upload/crop UX. |
| **Display name** | Public name (may differ from account name) |
| **Title / Role** | Free text — "Pro Skateboarder", "Physical Therapist", "CEO & Athlete", "Golf Coach" |
| **Bio** | Short text, ~150 chars max. What they're about. |
| **Sport(s)** | Already collected in activities — surface prominently on profile |
| **Location** | City / region (optional, privacy-controlled) |
| **PRs / Stats** | User-controlled visibility: can show or hide lifting PRs, mileage, etc. |

### Where It Lives
- `/profile/[username]` — public profile page
- `/account` — edit your own profile (existing page, extended)

### Privacy Controls
- Bio and title: always public
- Stats / PRs: toggle on/off per stat
- Location: optional, city-level only

### Schema Additions
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text CHECK (char_length(bio) <= 150);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_stats boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;
```

---

## 6. Follower & Athlete Network System

### Goal
A lightweight social layer — follow athletes in your niche, see their public stats if visible, get suggestions based on shared sports, create friendly competition between friends.

### Core Features

**Follow system:**
- Follow / unfollow any public user
- Follower count + following count visible on profile
- Feed of followed users' public activity (workout completions, PRs, milestones)

**Suggested connections:**
- "People who also do skateboarding near you"
- "Athletes with a similar training level"
- "Suggested: 3 people in your network also do pickleball"
- Based on: shared sports (activities column), training level, location (if shared)

**Discovery:**
- Browse athletes by sport/niche
- Search by display name or username
- Filter by: sport, location, training level

**Friendly competition:**
- See friends' visible PRs side by side
- Weekly activity leaderboard (opt-in)
- Milestone celebrations: "Alex just hit a new squat PR!"

**Privacy model:**
- All social features are opt-in
- Default: profile visible, stats hidden, activity hidden
- User controls: who can follow me (anyone / mutuals only / nobody)

### Schema

```sql
CREATE TABLE user_follows (
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE user_activity_feed (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,  -- 'workout_complete', 'pr_set', 'milestone', 'plan_started'
  payload     jsonb NOT NULL DEFAULT '{}',
  is_public   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### Beta Testing Note
Include follower system in F&F beta — this is where friendly competition between testers happens and will generate organic engagement data before public launch.

### Build Phases
1. Profile bio fields (schema + account page UI)
2. Public `/profile/[username]` page
3. Follow/unfollow system + follower counts
4. Suggested connections algorithm (sport-match based)
5. Public activity feed (opt-in)
6. Discovery / browse athletes page
7. Leaderboard + PR visibility
