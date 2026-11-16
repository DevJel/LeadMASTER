# Daily Reporter and strict Auto-Heal

**Status:** Daily Reporter and guarded incident-processing logic exist in Worker source. Auto-Heal is deliberately restricted and is not an autonomous production deployment system.

## Daily Reporter

~~~mermaid
flowchart TD
  Cron[Scheduled trigger] --> Run[Run daily report]
  Run --> App[Probe application/auth/dashboard routes]
  Run --> DB[Check required database schema]
  Run --> Bind[Check required bindings and storage]
  Run --> Mail[Check coordinator and mail workflow metadata]
  Run --> Git[Inspect repository/workflow/issues metadata]
  App --> Summ[Aggregate severity and safe summary]
  DB --> Summ
  Bind --> Summ
  Mail --> Summ
  Git --> Summ
  Summ --> Ledger[Persist run ledger]
  Summ --> Report[Build report]
  Report --> Admin[Send to configured admin]
~~~

The reporter intentionally avoids mailbox bodies, recipient lists, attachments, passwords, OTPs, API keys and SMTP credential values. It does not send a test email. A missing optional control-plane token reduces inventory visibility; the report must not call a partial audit fully healthy.

## Strict Auto-Heal

~~~mermaid
flowchart TD
  Trigger[Authorized incident event] --> Verify[Verify workflow identity and event]
  Verify --> Stack[Parse scoped stack frames]
  Stack --> Path[Allowlist exact source path]
  Path --> Window[Read bounded source window]
  Window --> Proposal[Generate narrowly scoped patch proposal]
  Proposal --> Validate[Validate changed path, line and diff limits]
  Validate --> Pass{Strict checks pass?}
  Pass -->|No| Manual[Create manual-review issue]
  Pass -->|Yes| Review[Open reviewed code change]
  Review --> Human[Human reviews/tests/merges]
  Human --> Release[Separate approved deployment process]
~~~

The strict guard rejects unrelated files, broad diffs, protected paths, secrets and patches outside the extracted stack window. If no exact source location can be established, it creates a manual-review issue and does not change source. The Daily Reporter is read-only; the strict worker does not merge PRs, deploy Workers, change DNS, mutate mailbox records or send user email as a repair action.

## Source and evidence

- `src/daily-reporter.mjs`
- `src/auto-heal.mjs`
- Worker scheduled/fetch integration: `worker.js`
- Guides: `docs/DAILY_REPORTER.md`, `docs/REPORTER_AUTO_HEAL.md`
- Tests: reporter and auto-heal validation tests under `test/`

## Operational requirement

Every report must distinguish a code-level check from a live provider event. Every auto-heal proposal requires normal review and release evidence. An issue created by the strict guard means “manual review required”, not that a source defect was automatically fixed.
