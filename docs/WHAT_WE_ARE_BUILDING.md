# What We're Building: SIGHTLINE

*Our entry for NASA Space Apps Challenge 2026, Bangladesh*

### *Know when the Sun shines and Earth listens — anywhere on the Moon's south pole.*

**A plain-language guide for the team.** No technical background needed.

---

## The one-sentence version

We're building a website that shows, for any spot near the Moon's south pole, **when that spot gets sunlight** and **when it can talk to Earth**, so people can choose the best place and the best day to land a spacecraft.

---

## Why this matters

NASA and private companies are sending landers to the **Moon's south pole**, and NASA plans to send astronauts there in the coming years through the **Artemis** program. Smaller robotic landers go first under a NASA program called **CLPS** (Commercial Lunar Payload Services: NASA pays companies to deliver equipment to the Moon).

The south pole is special because it may hold **frozen water**, which future explorers could use for drinking water, oxygen and rocket fuel. It's also one of the hardest places on the Moon to land and survive.

### Problem 1: The Sun barely rises

At the Moon's south pole, the Sun never climbs high in the sky. It stays **just above the horizon**, about the width of your finger held at arm's length, and slowly circles around you over a month.

That means a small hill or crater wall miles away can **block the sunlight completely**. Most landers run on **solar panels**, so:

> No sunlight → no power → batteries drain → the lander freezes and dies.

### Problem 2: Earth bobs up and down

From the south pole, Earth also sits near the horizon. Because of a slow wobble in the Moon's motion, Earth **rises a little, then dips below the horizon**, again and again. When Earth is hidden, the lander **can't send messages home**.

### Problem 3: The tools are too hard to use

Today, working this out takes expert software and specialist training. Our challenge says it directly: the existing tools exist, but they are too complicated for quick decisions.

---

## What Sightline does

Imagine Google Earth for the Moon's south pole, with a time slider and a crystal ball for sunlight and signal.

### 1. A stunning 3D Moon you can fly around

You open the site and see the Moon's south pole in 3D, built from **real NASA measurements** of the Moon's surface. Time speeds up: long shadows sweep across the craters like the hand of a clock, and Earth bobs on the horizon. That's the first impression for judges.

### 2. Click anywhere, get answers in about a second

Click any spot and Sightline works out the **exact skyline** you'd see standing there: every hill and crater wall around you. Then it tells you:

- ☀️ **How often** that spot gets sunlight

- 🌑 **The longest stretch of darkness** (the number that decides whether a lander survives)

- 🌍 **When Earth is visible**, and whether a NASA ground antenna on Earth can actually pick up the signal

### 3. The "Lander's Eye" view

A round, fish-eye view of the sky from the chosen spot shows the skyline as a jagged silhouette. The Sun's path is in **gold** and Earth's looping path is in **blue**. You can see at a glance when a mountain blocks the Sun.

### 4. The "mission barcode"

For each landing site, one colorful strip shows the coming years:

| Color | Meaning |
|---|---|
| 🟨 Gold | Sunlight (power) |
| 🟦 Blue | Earth visible (can talk home) |
| 🟩 Mint | **Both**: the best times |
| 🟪 Purple | Neither: dark and silent |

You can compare up to 4 sites side by side and instantly see which is better.

### 5. "Raise the mast" (the wow moment)

Slide a control to raise the solar panels from 2 meters to 10 meters high, and watch the longest night **shrink dramatically** as the panels peek over nearby hills. Those numbers are calculated live, not scripted, and this is the moment we want judges to remember.

### 6. Find the best landing day

Tell Sightline what your lander needs (for example, *"batteries last 50 hours, and we need at least 2 weeks of sunlight"*) and it lists the best landing dates, ranked.

### 7. Proof that the numbers are right

A dedicated "Evidence" page shows that our results match **NASA/JPL's own official calculations** and published scientific research. Every number links back to the real NASA data it came from. Most hackathon projects skip this step, so it's a big part of how we expect to win.

### 8. A guided tour (90 seconds)

A **"Take the Tour"** button walks anyone (a judge, a teacher, a student) through the story step by step, with no clicking needed.

### 9. Extras

- **An AI assistant** you can ask questions in plain English, like *"What's the best week to land at Nobile Rim in 2028?"* It can't make up numbers: it has to get every number from our calculator, and the app checks it.

- **Sound mode:** you can "hear" the data. A tone rises with the Sun, a soft signal plays when Earth is in view, and there's silence in the dark.

- **Downloads:** a one-page site report (PDF) and a calendar file of "Earth is visible" times.

---

## Who it's for

| Who | What they get |
|---|---|
| **Mission planners** | A fast way to compare landing sites and dates |
| **Teachers & students** | A beautiful, accurate way to understand why the Moon's poles are special |
| **The public** | A window into where and when humanity is about to land next |

---

## Where the data comes from (all free, public NASA data)

- **The Moon's shape:** NASA's *Lunar Reconnaissance Orbiter*, a spacecraft orbiting the Moon since 2009, used a laser to measure the height of the ground billions of times. That gives us a precise 3D map.

- **Where the Sun and Earth are at any moment:** NASA's Jet Propulsion Laboratory (JPL) publishes the exact positions of the planets. Spacecraft teams use the same data.

- **Where NASA's big antennas are:** the Deep Space Network has three giant dish sites, in California, Spain and Australia.

- **Landing sites:** NASA's officially announced candidate regions for Artemis astronaut landings, plus robotic CLPS mission sites.

---

## Why we think this can win

The judges score five things. Here's how we hit each one:

| What judges score | Our answer |
|---|---|
| **Impact** | Helps real Moon missions that are happening now |
| **Science** | Real NASA data and physics, checked against NASA/JPL's own results |
| **Creativity** | Lander's Eye view, mission barcode, sound mode, the mast-raising moment |
| **Technical skill** | Fast, accurate 3D calculations running right in the web browser |
| **Storytelling & design** | Cinematic opening, 90-second guided tour, clean museum-quality design |

We're aiming for the **"Best Use of Science"** award, with **"Best Use of Technology"** as a second target.

---

## Important: the timeline

We are part of **NASA Space Apps Bangladesh** ([nasaspaceappsbd.com](https://www.nasaspaceappsbd.com)). There are two rounds: a **local round in Bangladesh first**, then **global judging** for the roughly 27 Bangladeshi teams that advance. The key dates are in Bangladesh time:

| Date | What happens |
|---|---|
| **By Oct 7** | 🚨 **Register our team on the Bangladesh site.** It asks for the team name, leader, region, members and a team photo |
| **Now → Nov 5** | We build the website |
| **Oct 28** | NASA releases the full challenge details. We double-check that our plan fits |
| **Nov 5** | **Feature freeze:** no new features after this day, only fixes and polish |
| **Nov 11** | A finished version of the website is online |
| **Fri Nov 13** | The Bangladesh program starts at 07:00. We upload our **240-second video** to the organizers' Google Drive between 18:30 and 19:00 |
| **Sat Nov 14, 09:00–10:00** | **Final upload of our 30-second video and our NASA project page** |
| **Sat Nov 14, 11:00** | Local judging: "240 Seconds of Glory" |
| **Dec 2026 – Jan 2027** | Global judging and winners announced |

> ⚠️ **One thing to confirm:** the official NASA rules say teams must not start before the hackathon, and the Bangladesh website does not say we can. We were told our local event allows it, but we still need that **in writing** from the organizers. Until we have it, treat it as "probably fine, not yet proven".

---

## The team

We have **3 developers**, and the other teammates cover the non-coding work. You don't need to be a programmer for every role.

| Role | Who | In plain words |
|---|---|---|
| **Developer 1: the core** | Team lead | The calculator that works out sunlight and signal, the NASA data, the proof that the numbers are right, the AI assistant's safety checks, and putting everything together |
| **Developer 2: the 3D Moon** | _TBD_ | Makes the Moon look stunning: terrain, shadows, the sky, and the round "lander's eye" view |
| **Developer 3: screens and tour** | _TBD_ | Builds the buttons, sliders, timeline, charts and the guided tour |
| **Everyone else** | _TBD_ | Writes the tour story, checks every fact against NASA sources, makes the 30-second video and the slides, tries the site as a first-time user |

---

## What we'll hand in

1. **A live website** anyone can open.

2. **A 30-second video** showing it in action.

3. **A 7-slide presentation,** and a **240-second video** for local judging.

4. **A short statement** on how we used AI and which NASA data we used. NASA requires both.

---

## What I need from you right now

1. **Register the team on the Bangladesh site** (nasaspaceappsbd.com/registration) **by Oct 7**. Send me your name, email, mobile number and region, plus a team photo, if you are on the team.

2. **Register** on the NASA Space Apps website (spaceappschallenge.org). We must all join the **same local event** (Bangladesh).

3. **Developers:** send me your GitHub username so I can invite you to the project.

4. **Everyone:** tell me which role you'd like, or what you're good at.

5. **Save the dates:** feature freeze on Nov 5, program start on Nov 13, and the final upload on Nov 14 by 10:00.

Questions? Ask anytime. If something in here doesn't make sense, that's a sign we should explain it better to the judges too.
