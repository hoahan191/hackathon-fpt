# FPT × GitHub Copilot Hackathon

**Monday 7 September 2026 · Hoa Lac · Da Nang · Ho Chi Minh City**
**2 hours · ~300 builders · one winner**

---

## Pick one of these and start

You have 90 minutes, and a judge interrupts you three times. Do not spend any
of that deciding what to build.

| Pick one | The part that is easy to get wrong |
| --- | --- |
| **Split the bill** | Five people, one lunch receipt, nobody ordered the same thing. Who owes whom — and settle it in the fewest transfers. |
| **Where are we eating?** | Everyone ranks the options. The app picks a winner and can explain why that one won. |
| **Secret Santa** | Assign givers to receivers so nobody draws themselves, and teammates who sit together don't draw each other. |

Already have an idea you are itching to build? Build that instead. Just decide
in the first five minutes.

**Nobody is scoring your idea.** Each of these was picked because it hides a
small piece of logic that is genuinely easy to get wrong: 100,000 VND split
three ways, a tied vote, a Secret Santa draw that paints itself into a corner
with one person left. That is what makes a test worth writing — and the tests
are what we score.

**What we score is how you work with AI.** Six techniques, listed below. Use
them visibly, and you will walk out with a way of working that makes you faster
on Monday morning — not just today.

Two rules on top of your idea:

1. Your app must include the **activity log** in [`spec/activity-log.md`](spec/activity-log.md).
   Every team builds it. It is how judges in three cities compare fairly.
2. Your tests must **pass** by the end.

---

## Your team of five

One repo. One person typing at a time. **The other four are responsible for what
gets typed.** The Driver executes the team's instruction — they are not the only
one thinking. If the prompt was vague, that is the team's fault, not theirs.

| Role | Owns |
| --- | --- |
| **Driver** | The keyboard. Types what the team has agreed, and says so out loud. |
| **Spec Owner** | Plan Mode. Resolves the four ambiguities in the spec. |
| **Test Lead** | Writes tests first. Blocks anyone coding too early. |
| **Validator** | Runs the second model over the code. Argues with it. |
| **Scribe** | The app's README. Talks to the judge at each gate. |

The Test Lead role is the one that feels annoying and matters most. Give it to
someone who will actually say no.

---

## Setup

1. Unzip this folder
2. Open it in **VS Code**
3. Open Copilot Chat, switch to **Agent mode**

That's it. The agents and the architecture skill in `.github/` load
automatically when you open the folder. Nothing to install.

---

## The six techniques

### 1 · Plan Mode — think before you build

Do not start by asking for code. Start in **Plan Mode** and have Copilot
interrogate the problem with you.

**Use the strongest reasoning model available to you here.** Planning is a tiny
slice of your total tokens but it decides everything downstream — this is the
one place premium reasoning genuinely pays for itself.

**Then switch to a faster, cheaper model to implement.** Once the plan is good,
implementation is transcription.

> Open the model picker and look at what your account actually has enabled. It
> varies. Pick the strongest one you can see for planning, and something quicker
> for the build.

Your first job in Plan Mode: find the four `[NEEDS CLARIFICATION]` markers in
the activity log spec and decide what they should be.

### 2 · Test-Driven Development — write the test first

Red, then green. Test fails, *then* you make it pass.

This feels backwards under time pressure. It is the fastest thing you will do
today, for two reasons:

- **It gives the AI a target it can check itself against.** Without a test, the
  agent writes something plausible and you review it by eye. With a test, it
  runs, sees red, and fixes it — without you.
- **It stops the expensive loop.** "No, not like that" — repeated six times — is
  where tokens actually burn. A failing test says precisely what "like that"
  means.

This is the pit of success: make the correct path the easy path, so a
half-attentive agent at 3pm still lands somewhere good.

### 3 · Caveman Mode — make it stop waffling

`@caveman` — Copilot answers in blunt, minimal language.

It is funny. It is also **directly cheaper**: you are billed on tokens, and
output tokens are the expensive ones. An agent that explains its reasoning in
four paragraphs before every edit is charging you for prose you skim.

Try it for one task. Decide for yourself whether you want it on.

### 4 · Validate with a second model

**A model reviewing its own output shares its own blind spots.** It will
confidently miss the same thing twice, because the thing that made it wrong the
first time has not changed.

Build with one model. Review with a different one. **Switch the model in the
picker first**, then run `@review` — it will ask you to confirm you have,
because a review by the same model is close to worthless.

Watch for what the second model catches. That gap is the whole point.

### 5 · Tests that pass

Your tests must be green at the end. Red counts as unfinished.

### 6 · Documentation

A README for **your** app: what it does, how to run it, how to run the tests.
Written for the next person, not for us. `@documenter` will start you off.

---

## What's in this folder

```
spec/activity-log.md          The one component every team builds
.github/agents/               @tdd-red @tdd-green @caveman @review @documenter
.github/skills/               architecture-slide — only if you make the final
SPEC-DRIVEN-DEVELOPMENT.md    The full method — take this home
```

---

## Spec-Driven Development

The method behind today. The idea is simple: **the specification is the source
of truth, and the code is downstream of it.**

Four steps:

| Step | Question |
| --- | --- |
| **Specify** | What are we building, and why? |
| **Clarify** | Where is this ambiguous? *(← we've pre-loaded four of these for you)* |
| **Plan** | How will we build it? |
| **Tasks** | What's the order? |

The step people skip is **Clarify**, and it is the one that pays. An ambiguity
you resolve in 30 seconds of conversation costs 30 minutes once it is in code
and in tests.

**"Doesn't SDD mean the AI runs for hours?"** No — that's backwards. A good spec
is what *makes* long autonomous runs possible; it is not what makes them
necessary. Your whole spec phase today is about 20 minutes.

`SPEC-DRIVEN-DEVELOPMENT.md` has the full method — far more process than you
need today, which is the point: it is written for real projects. Take it home.
Look up **GitHub Spec Kit** afterwards for the tooling version.

---

## The two hours

| Time | | |
| --- | --- | --- |
| `0:00` | Brief | Ideas, teams, setup |
| `0:20` | **🚦 Gate 1 — Plan** | Judge reviews your plan and your four decisions |
| `0:45` | **🚦 Gate 2 — Red** | Judge sees your tests **failing** |
| `1:05` | **🚦 Gate 3 — Green** | Judge sees tests passing, plus Caveman, second model, docs |
| `1:30` | Build ends | Judges confer, nominations announced |
| `1:35` | **Finals** | Three teams present to all three cities |
| `2:00` | Winner | 🏆 |

**The gates are the scoring.** Two judges per location, ten teams each. Your
judge will give you a **team number** — they visit in that order every time, so
you know roughly when they're coming. No queueing, no flagging them down.

You cannot pass Gate 2 with passing tests. That is deliberate: it is how we
know the tests came first.

Nothing is written down for judges after the fact. When a judge asks *"show me
your Caveman output"*, you scroll your chat history. Build for 90 minutes, not
for paperwork.

---

## Making the final

Each location nominates **one team**. Three finalists present to all 300 people
across the three cities.

You get **one slide**. Run this in Copilot Chat:

```
Use the architecture-slide skill
```

It reads your repo and writes `ARCHITECTURE.md` — one diagram, what you built,
how you used AI, what you'd do next. Renders on GitHub and in Copilot Chat.

> ⚠️ VS Code's built-in Markdown preview does **not** render Mermaid without an
> extension. Check your render early and keep a screenshot as backup.

---

## Judges are looking for

| | |
| --- | --- |
| **Plan Mode** | Did thinking happen before code? Are the four decisions reasoned? |
| **TDD** | Did the test genuinely come first? |
| **Caveman** | Did you try it, and can you say whether it helped? |
| **Second model** | What did it catch that the first model missed? |
| **Tests** | Green, and tied back to `REQ-###`. |
| **Documentation** | Could a stranger run this? |

Judges reward **honest** over **polished**. "We got this wrong and here's what
we changed" scores higher than a demo that avoids the question.

---

## Take home

Everything in `.github/` is yours. Copy it into a real project on Monday.

The techniques matter more than the files. If you take one thing: **plan with
your strongest model, build with a faster one, and let a test tell you when
you're done.**

Have fun. Build something you want to show people. 🚀
