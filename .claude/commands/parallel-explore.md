You are about to run a parallel exploration. The user has given you a problem to solve:

**Problem:** $ARGUMENTS

Your job: generate N genuinely different approaches to this problem, build each one in an isolated git worktree + branch, and spawn N agents in parallel to implement them.

## What "genuinely different" means

Don't vary surface details (colors, layouts). Vary the **underlying assumption** about how the problem gets solved. Ask: what if we approached this from a completely different angle?

Examples of dimensions to vary:
- **Mental model**: feed vs. workspace vs. pipeline vs. map vs. conversation
- **Core mechanism**: manual curation vs. AI automation vs. social proof vs. algorithmic ranking
- **User's job-to-be-done**: discovery vs. evaluation vs. execution vs. reflection
- **Data model assumption**: flat list vs. hierarchy vs. graph vs. timeline
- **Interaction paradigm**: browse vs. search vs. chat vs. schedule vs. alert
- **Trust model**: user decides everything vs. AI recommends vs. system auto-acts
- **Perspective**: individual productivity vs. market intelligence vs. competitive analysis

## Process

1. **Identify N** — default 5 unless the user specified otherwise in the problem statement.

2. **Brainstorm approaches** — List N approaches, each with a one-sentence philosophy that captures its core assumption. Make sure they're genuinely orthogonal — a user who tried approach A would have a completely different experience than someone who tried approach B.

3. **Name each approach** — short evocative names (The Feed, The Compass, etc.) that communicate the philosophy.

4. **Commit current WIP** to the current branch before creating worktrees.

5. **Create branches + worktrees** — one per approach:
   ```bash
   git branch explore/[name-1]
   git worktree add .worktrees/[name-1] explore/[name-1]
   # repeat for each
   ```

6. **Write agent prompts** — each prompt must be fully self-contained (the agent has zero context from this session). Include:
   - What the product does (2-3 sentences)
   - The approach's specific philosophy and what makes it unique
   - Tech stack and working directory
   - Any shared infrastructure code the agent needs (schema, lib files, API contracts)
   - Exactly what to build — screens, features, interactions
   - How to commit when done

7. **Launch all agents in parallel** — single message, all Agent tool calls at once with `run_in_background: true`.

8. **Report** what was launched: table of approach name / branch / philosophy / port.

## Quality bar

Each implementation should be:
- A complete, runnable app (not a prototype or skeleton)
- Committed to its branch
- TypeScript clean (`npx tsc --noEmit` passes)
- Genuinely different from the others in a way that matters to the user

Do not ask for approval before launching. Generate the approaches, set up the infrastructure, and go.
