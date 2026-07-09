# TusCoach — Owner's Guide
*A plain-language walkthrough of everything in the app, written for the person building it, not the person coding it.*

---

## What This App Is, In One Paragraph

TusCoach is a personal study coach for Turkish medical specialty exam (TUS) candidates. The idea is simple: studying for TUS is a multi-month grind with 11 subjects, thousands of questions, and no one telling you what to do each day. TusCoach fills that gap. It watches how you study, figures out where you're weak, builds a daily plan around your schedule, lets you practice actual questions, and sends you messages from an AI coach that reacts to what you did (or didn't) do. Everything is automated — the student just opens the app and it already knows what's needed.

---

## The Two Versions of the App You're Working With

Before anything else: **you have two codebases**, and they did different things.

**Repo 1 — QuintusGenus/TusCoach (the one on your computer, the one we're building)**
This is the serious, production-quality version. It has a real database, real user accounts, background automation, AI coaching, notifications, and a full mobile app. Think of it as the restaurant that's actually open.

**Repo 2 — ozer-burakk/TusCoach (the experiment)**
This was a quick prototype to test one specific idea: what if students could solve actual practice questions, and the app tracked which ones they got wrong and showed them again until they got them right? It didn't have real user accounts or a real database — it was a demo. But the idea inside it was good.

**What we did in this session:** We took the good idea from Repo 2 (the question bank, the smart repetition system, the timed mock exam) and built it properly inside Repo 1's architecture. So now Repo 1 has both.

---

## The Technical Stack, Explained Without Jargon

Think of the app as three rooms:

**Room 1: The Database (PostgreSQL)**
This is a filing cabinet. Every user account, every question they've answered, every study session, every AI message — it all lives here permanently. Nothing in the app works without this. It runs on your server (or your Mac during development) on port 5433.

**Room 2: The Backend (FastAPI, Python)**
This is the brain. It receives requests from the mobile app ("give me today's questions"), thinks about them ("okay, this user got anatomy wrong last time, let me pick harder anatomy questions"), and sends back answers. It also runs background tasks on a timer (Celery + Redis) — things like "every night at 9:30pm, generate tomorrow's study plan for every user."

**Room 3: The Mobile App (React Native / Expo)**
This is what the student sees. It talks to Room 2, shows the results, and lets the student interact. It runs on iOS and Android from a single codebase.

---

## Every Feature, Explained

### 1. User Accounts & Login

**What it is:** Students create an account with email and password. They get a JWT token (think of it as a key card) that the app uses to prove who they are on every request.

**What exists:** Full registration, login, and auto-logout if the session expires.

**What's missing:** Password reset ("forgot my password"), social login (Google/Apple). Students currently can't recover a lost password without a developer manually fixing it in the database.

**Product decision needed:** Add password reset before any real users join. It's a basic expectation.

---

### 2. Student Profile & Preferences

**What it is:** Each student has a profile with settings that affect everything else in the app.

**Settings stored:**
- **Exam date** — the actual TUS exam they're preparing for. This is used to calculate urgency and countdown.
- **Daily target minutes** — how long they plan to study on weekdays vs. weekends (e.g., 90 min weekdays, 120 min weekends).
- **Timezone** — defaults to Istanbul. Used to send notifications at the right time of day.
- **Quiet hours** — a time window (e.g., 23:00–07:00) during which no notifications are sent.
- **Notification toggle** — can turn all notifications off.

**What exists:** All of this is built. The quiet hours system is sophisticated — it doesn't just block notifications, it holds them and delivers them when the quiet window ends.

**Product decision needed:** The onboarding flow (the screens that collect this information when someone first signs up) needs to be built for the mobile app. Right now a new user lands in the app with no exam date set, which breaks the plan generator and countdown features.

---

### 3. The Study Plan (Tur System)

**What it is:** This is the core scheduling engine. TUS has 11 subjects. Students go through them in "turs" (rounds) — typically 3-4 rounds before the exam, with each round getting faster. The app generates a day-by-day study plan based on which round the student is on.

**The 11 subjects in study order:**
1. Fizyoloji-Histoloji
2. Patoloji
3. Dahiliye (internal medicine — gets extra days because it's vast)
4. Biyokimya
5. Pediatri (also gets extra days)
6. Anatomi
7. Genel Cerrahi
8. Kadın Doğum
9. Küçük Stajlar (small rotations)
10. Mikrobiyoloji
11. Farmakoloji

**The 4 tur speeds:**

| Tur | Who it's for | Days per normal subject |
|-----|-------------|------------------------|
| Tur 1 | First-time studiers | 4 reading + 2 question days |
| Tur 2 | Second pass | 3 reading + 2 question days |
| Tur 3 | Third pass | 2 reading + 1 question day |
| Tur 4 | Final sprint | 1 reading + 1 question day |

**Task types within a plan:**
- **Review** — reading/studying content
- **Question** — practicing questions
- **Video** — watching lecture videos
- **Note** — making notes

Each task has a time target (e.g., "60 minutes of review on Anatomi today").

**What exists:** The full plan generator is built. Students can:
- Generate a plan by choosing their tur number
- See their daily tasks
- Mark tasks as done
- Adjust reading/question days per subject
- Reorder subjects
- Add custom tasks
- See an overview of the full plan

**What's missing:** The plan currently generates a *skeleton* (what to study and when) but doesn't generate *what specifically to do* within that skeleton. For example, it says "60 minutes of anatomy" but doesn't say which anatomy topics. Connecting the plan to the question bank (so "question day" actually opens a practice session with the right subject's questions) is not yet done.

**Product decision needed:** This connection between the study plan and the question bank is probably the most important feature gap. It's what transforms the app from a scheduler into a real coach.

---

### 4. Study Session Logging

**What it is:** Students manually log when they study. They record the date, how many minutes they studied, what subject, and optionally which specific topic.

**What exists:** Full CRUD (create, read, delete). Sessions feed into the adherence calculation ("you planned 90 min but only studied 40 min — 44% adherence") which feeds into the AI coaching risk score.

**What's missing:** The study timer. There's a timer component (`StudyTimer.tsx`) built in the mobile app, but it's unclear if it's fully connected to automatically creating sessions when the timer stops. Worth checking.

---

### 5. Mock Exam Tracking (Manual Entry)

**What it is:** After a student takes a printed/external mock exam, they enter their scores into the app. This is *not* the app giving them the exam — it's them reporting what happened on an external exam.

**How it works:** The student enters how many questions they got correct, wrong, and blank for each subject. The app calculates their net score (TUS formula: correct − wrong × 0.25).

**What exists:** Full entry, history, score trends, per-subject breakdown view in the mobile app.

**Important distinction:** This is separate from the new Question Bank feature. Think of it like this:
- **Mock Exam Tracking** = entering scores from a Dogan/TUS-sim exam you took on paper
- **Question Bank** = actually solving questions inside the app

Both exist, and they serve different purposes.

---

### 6. Question Bank (QBank) — *New Feature, just built*

**What it is:** A library of actual TUS-style practice questions inside the app. Students see a question, choose an answer, and immediately find out if they were right — with an explanation. This is interactive, live inside the app.

**The two tracks:**
- **Temel Bilimler** (Basic Sciences): Biyokimya, Mikrobiyoloji, Patoloji, Farmakoloji, Anatomi, Fizyoloji, Histoloji
- **Klinik Bilimler** (Clinical Sciences): Pediatri, Dahiliye, Cerrahi, Kadın Doğum, Küçük Stajlar

**What exists now:**
- 46 seed questions (Turkish language, with explanations and textbook citations) — this is a *starter* library, not a full bank
- Students can answer questions and get immediate right/wrong feedback with explanation
- The app tracks which questions each student got right and wrong

**What's "smart" about it — Spaced Repetition (SM-2):**
This is the most technically interesting part. When a student gets a question wrong, it enters a "review queue." The app brings that question back:
- 1 day later if they just got it wrong
- 6 days later if they got it right once
- Then progressively longer intervals (16 days, 38 days, etc.) based on how consistently they answer correctly

This is the same algorithm used by Anki (the popular flashcard app). It's scientifically validated to be the most efficient way to memorize information long-term.

**What else is "smart" — Adaptive Sampling:**
When picking new questions for a student's daily session, the app doesn't pick randomly. It weights the selection toward subjects and subtopics where the student performs worse. If a student is 40% accurate on Enzim Kinetiği and 90% accurate on Lipid Metabolizması, they'll see more Enzim Kinetiği questions.

**The daily practice session:**
- Up to 4 SRS review questions (ones they got wrong before, now due for review)
- Filled to 10 total with new questions, weighted toward weak areas
- One question at a time, answer → immediate feedback → explanation → next

**Timed Mock Exam mode:**
- Chooses Temel or Klinik track
- Up to 100 questions, 135 minute timer
- Can navigate between questions with a dot-grid (filled = answered, hollow = skipped)
- Auto-submits when time runs out
- Shows percentage score and per-subject breakdown after

**Content pipeline (the future):**
The second repo had a design for how questions get created: AI writes a draft → another AI checks for ambiguity → a tagging AI categorizes it → a human doctor approves it before it enters the live bank. This pipeline is *designed* but not built. Right now questions are added manually via the seed script.

**The critical gap:** 46 questions is nowhere near enough for a useful question bank. TUS has thousands of questions per subject. Building or licensing question content is a major product decision.

---

### 7. Progress & Analytics

**What it is:** The "Analiz" (Analysis) screen shows a student how they're performing over time.

**What exists:**
- Weekly study minutes (bar chart)
- Daily study minutes (trend)
- Total study time and active days
- Error distribution from mock exams (which subjects have the most wrong answers)
- Net score trend across exams (is the student improving?)
- **QBank mastery bars** *(just added)* — per-subject correct rate from question bank attempts, split by Temel/Klinik, color-coded: red < 50%, amber 50–80%, green ≥ 80%

**What feeds into everything:**
There's a "risk score" (0–100) calculated behind the scenes from three signals:
1. **Inactivity** — how many hours since the last study session (up to 40 points of risk)
2. **Adherence** — how far actual minutes are from planned minutes over the last 7 days (up to 40 points)
3. **Weak topics** — if the worst subject is under 30% accuracy, adds 20 points

This risk score drives the AI coach's tone. High risk → more urgent message. Now it uses both mock exam data AND question bank attempt data when calculating weak topics.

---

### 8. AI Coach — Inbox & Messages

**What it is:** Automated messages from an AI coach that arrive based on what the student does (or doesn't do). These appear in the "Inbox" tab.

**Three automated coaching scenarios:**

**Scenario A — Daily Review (every night, 9:30pm)**
The AI reviews how the student is doing (risk score, adherence, weak topics), creates tasks for the next day, and sends a personalized message. Example: "Bugün Anatomi'ye hiç girmedin, yarın 45 dakikayla başlayalım."

**Scenario B — Exam Intervention (right after entering a mock exam score)**
When a student logs a mock exam, the AI spots the weakest subject, creates a 7-day intensive micro-plan (3 days reading, 1 rest, 2 days questions, 1 mock), and sends a message explaining what it's doing and why.

**Scenario C — Inactivity Rescue (checked every 6 hours)**
If a student hasn't done anything for 3+ days, the system finds them and sends a re-engagement message.

**Important nuance — How messages get created:**
This is event-driven. When a student enters an exam score, the app doesn't immediately call the AI. It writes an "event" to a queue. A background process running every 2 minutes picks up unprocessed events and triggers the right workflow. This design means if something crashes, nothing is lost — the event stays in the queue until it's processed.

**What exists:** All three workflows are built and running.

**What's missing:** The content of the AI messages is currently generated by an AI (OpenAI API), but if the API key isn't configured, the messages fall back to template text. You'll need a real OpenAI API key for students to get personalized messages.

---

### 9. AI Chat (Conversational Coach)

**What it is:** A real-time chat interface where the student can talk to an AI coach in Turkish. The AI is not just a chatbot — it has access to the student's real data and can take actions.

**What the AI can see and do:**

| Tool | What it does |
|------|-------------|
| `get_study_stats` | Looks up the student's weekly stats, streak, weak topics |
| `get_todays_plan` | Sees today's scheduled tasks |
| `get_daily_progress` | Sees last 7 days of study vs. plan |
| `log_study_session` | Actually creates a study session record |
| `generate_study_plan` | Creates a new full study plan |

**Example conversation:**
> Student: "Bugün ne çalışmalıyım?"
> AI: *looks up today's plan* "Bugün Patoloji'nin inflamasyon bölümü var — 45 dakika review planlanmış. Dün anatomy'den 60 dakika çalışmışsın, harika!"

**Streaming:** The response appears word-by-word as the AI types it, like ChatGPT. This is technically done via SSE (Server-Sent Events) — a one-way stream from server to phone.

**What exists:** Fully built, with rate limiting (30 messages per 10 minutes per user) to prevent abuse.

**What's missing:** The chat doesn't yet know about question bank activity. The AI can't say "you got 3 anatomy questions wrong yesterday in practice." This is a natural next connection to make.

---

### 10. Notes

**What it is:** A simple note-taking system for students to write study notes, filterable by subject.

**What exists:** Full create, read, update, delete with subject filtering.

**Assessment:** This is a minor feature. It exists but doesn't connect to anything else. Students probably use their own note apps. Low priority for development attention.

---

### 11. Push Notifications

**What it is:** The app sends push notifications to the student's phone for:
- Daily review message (9:30pm)
- Exam intervention (after entering a score)
- Inactivity nudge (3+ days absent)

**How it works:** When the student installs the app, their phone generates a unique "push token" (like a phone number for push notifications). This token is stored in the database. When the backend wants to notify a student, it sends the message to Expo's push service, which forwards it to Apple/Google.

**Quiet hours:** If a notification would arrive during the student's quiet hours, it's held and delivered when the window ends — not dropped.

**What exists:** Fully built, including quiet hours deferral.

**What's missing:** Deep linking — when the student taps a notification, they should land on the specific message inside the app. This was designed but the implementation may need testing.

---

### 12. Calendar View

**What it is:** A monthly calendar showing study activity — which days had sessions, which had tasks.

**What exists:** The API is built. The mobile screen exists. Details need review.

---

## The Data Flow — How Everything Connects

Here's the big picture of how data moves through the app when a student is active:

```
Student studies → logs session → "study_session_created" event →
  → 2 min later: Daily Review workflow runs →
    → Calculates risk score (using mock exam data + QBank attempts)
    → Creates tomorrow's tasks
    → AI generates message
    → Push notification to phone

Student enters mock exam → "exam_created" event →
  → Immediately: Exam Intervention workflow runs →
    → Finds weakest subject
    → Creates 7-day micro-plan
    → AI generates targeted message

Student answers questions in QBank →
  → Correct: SRS interval grows (seen again in 6 days, then 16, then 38...)
  → Wrong: enters SRS review queue (seen again tomorrow)
  → All attempts feed into weak-topic calculation
  → Weak topics affect what new questions are shown (adaptive sampling)
  → Weak topics affect AI coach message tone

No activity for 3+ days →
  → Every 6 hours: Inactivity scanner runs →
    → Finds inactive students
    → Sends motivational message
```

---

## What's Built vs. What's Not Built

### Fully Built ✓
- User accounts (register, login, auth)
- Student preferences (exam date, daily targets, timezone, quiet hours)
- Study plan generator (tur system, all 4 speeds, full customization)
- Study session logging
- Mock exam score entry and tracking
- Question bank with 46 seed questions
- SM-2 spaced repetition
- Adaptive question sampling
- Daily practice session (10 questions)
- Timed mock exam mode (135 min, 100 questions)
- Per-subject mastery tracking
- Risk score engine (blended from mock exams + QBank)
- Daily review AI workflow (9:30pm nightly)
- Exam intervention AI workflow
- Inactivity rescue AI workflow
- AI chat with real data access
- Push notifications with quiet hours
- Per-subject analytics and mastery bars
- Notes system

### Not Yet Built ✗

**Critical (breaks the student experience without these):**
- **Password reset** — locked out users have no recovery path
- **Onboarding screens** — new users land in a half-configured app
- **Plan → QBank connection** — "question day" in the plan should open a QBank session for that subject
- **Enough questions** — 46 questions is a demonstration, not a product

**Important (significantly improves experience):**
- **Chat awareness of QBank** — AI coach should know what questions you solved
- **Onboarding for AI coach** — new users get generic risk score (they haven't done anything yet)
- **Content pipeline** — how questions get created, vetted, and added (currently: manually)
- **Deep link from notifications** — tap notification → land on the right screen

**Nice to have:**
- Admin panel for content (adding/reviewing questions without touching code)
- Social features (leaderboards, study groups)
- Video content integration
- Export/share progress
- Web version (frontend/ directory exists but is not developed)

---

## The Question Bank Content Problem

This is the most important product decision you face. The question bank feature is fully built technically, but 46 questions is not a product — it's a proof of concept. Here are your realistic options:

**Option A: License existing question content**
Companies like Dogan, Tusem, or similar prep providers have thousands of questions. Licensing is expensive and they might not want a competitor, but it's the fastest path to a real question bank. Requires negotiation and a legal agreement.

**Option B: Build questions using AI**
The content pipeline (generate → verify → tag → human approve) is designed in the codebase but not built. You'd use Claude or GPT-4 to draft questions based on textbook content, then have a doctor review before they go live. Cost: ~$0.01-0.05 per question in AI costs, but requires a physician reviewer for quality and legal protection. Realistic pace: 100-200 questions per month with one reviewer.

**Option C: Community / crowdsourcing**
Let experienced students submit questions, which get reviewed. Slow to start but potentially unlimited scale.

**My read:** For a medical app where wrong information could affect someone's career, human physician review of every question before it goes live is non-negotiable. Option B with a physician partner is probably the right first move.

---

## The Economics of Running This App

**Costs you're paying when users are active:**

| Cost | What drives it | Rough scale |
|------|---------------|-------------|
| Server/hosting | Always on | ~$20-50/month for a small server |
| Database (PostgreSQL) | Storage + queries | Included in server or ~$10-20/month |
| Redis (for background tasks) | Always on | Included or ~$5/month |
| OpenAI API | Each AI message generated | ~$0.01-0.05 per message |
| Expo Push | Push notifications | Free up to 1M/month |
| Apple/Google store fees | App distribution | $99/year (Apple), $25 one-time (Google) |

**The variable cost to watch:** OpenAI API. Each daily review message, exam intervention, and chat response costs money. At 1,000 active students, if each gets 1 coaching message per day = ~$15-50/day. At 10,000 students = $150-500/day. This needs to be factored into pricing before scaling.

**Caching opportunity:** The AI coach system prompt (the student's context) could be cached with Anthropic's Claude API (which has a caching feature), potentially cutting costs 60-80% for returning users. Worth considering when switching AI providers.

---

## How to Think About Next Steps

### The One Most Important Thing
Connect the study plan to the question bank. When a student's plan says "45 minutes of anatomy questions today," tapping that task should open a 15-question QBank session filtered to anatomy. This single connection makes the app feel like a complete product rather than two separate tools.

### The Critical Infrastructure Thing
Add password reset and onboarding before any real users. A user who can't log in is a user you've lost forever.

### The Content Thing
Make a decision on question content strategy before building more features. Everything else is complete enough to use — the bottleneck is content.

### The Testing Thing
The test database (port 5433) needs to be running when you run tests. Right now 150 tests fail because the test database isn't reachable in the current environment. This isn't a code problem — it's an environment setup issue. When the test DB is running, those tests should pass (they were passing before today's changes).

---

## A Day in the Life of a Student Using the App

To make this concrete, here's what the ideal complete experience looks like:

**Morning (7:00am):**
Student opens app. Sees today's tasks: "Review Biyokimya — 45 min | Questions Anatomi — 30 min." These were created by last night's 9:30pm workflow.

**During study (10:00am):**
Opens the Pratik (Practice) tab. Gets 10 questions — 3 SRS reviews of anatomy questions they got wrong last week, plus 7 new questions weighted toward their weak enzymology subtopic. Answers each one. Gets immediate feedback. The app records everything.

**After an external mock exam (3:00pm):**
Enters their mock exam scores. The app calculates they scored 48% on Farmakoloji — their worst subject. Within minutes, a push notification arrives: "Farmakoloji'nde zorluk çekiyorsun. Sana 7 günlük yoğun program kurdum." Opens the message, sees a specific 7-day plan waiting in their calendar.

**Evening (9:30pm):**
Phone buzzes: "Bugün harika bir çalışma gününü geçirdin! Risk skoru 28. Yarın Anatomi'nin sinir sistemi bölümü var — 45 dakika planladım."

**This is the fully connected vision.** Most of it exists. The gaps are mainly: (1) enough questions, (2) the plan-to-qbank tap connection, (3) the AI chat knowing about qbank activity.

---

## How to Talk to Your Developer

When you want something built, the most useful thing you can give is:
1. **What the user sees** — describe the screen or interaction
2. **What happens in the background** — what data needs to be saved or retrieved
3. **The edge cases** — what if the student has no questions? what if the timer runs out?

You don't need to say *how* to build it — that's the developer's job. But the clearer you are about the *experience*, the faster and more accurately it gets built.

A good request sounds like: *"When a student taps a 'question' type task in their daily plan, I want it to open a QBank session filtered to that task's subject. When they finish, I want the task to be marked as done and the session to count in their stats."*

A vague request sounds like: *"Make the plan work with questions."*

---

*Last updated: July 2026. Reflects the state of the codebase after the QBank integration session.*
