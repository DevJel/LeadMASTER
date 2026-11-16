# LeadMASTER Reporter and Strict Auto-Heal Worker

## Mandatory daily report

- Schedule: 17:00 Philippine Standard Time (Asia/Manila), cron `0 9 * * *` UTC.
- Recipient: only the configured `ADMIN_EMAIL` secret-store identity.
- Sender and transport: existing LeadMASTER SES SMTP settings and shared `EMAIL_COORDINATOR`; no new SMTP credentials or fallback sender.
- Daily run ledger: D1 `leadmaster_reporter_runs`; incident and sample reports use separate unique report keys so they do not suppress the mandatory daily report.
- Status colors: Healthy / Fixed green; Moderate yellow; Needs Attention orange; Needs Manual Action red; Unable to Fix dark red.
- A one-time sample can be sent by the primary admin using `POST /api/admin/reporter/sample`, or by manually dispatching the `LeadMASTER Incident Trigger` workflow with `send_sample=true`.

## Incident triggers

The `LeadMASTER Incident Trigger` workflow is triggered by:
- A completed failed `LeadMASTER CI` workflow run. It extracts bounded stack-trace lines from failed logs.
- A newly opened or newly labelled GitHub issue carrying a `bug`, `incident`, or `production` label.
- A manual workflow dispatch for the sample report.

The workflow obtains a short-lived GitHub Actions OIDC token for audience `leadmaster-auto-heal` and sends it to `POST /api/auto-heal/trigger`. The Worker verifies the token signature against GitHub's published JWKS and checks issuer, audience, repository and exact allowed workflow file. No static webhook secret is required. A repository-scoped short-lived GitHub Actions token is passed in the request body for the duration of that incident only; it is never logged or stored.

Every incident is checked and reported to the same configured primary admin using the existing SES coordinator. An error hash is recorded in the `AUTO_HEAL_KV` namespace for deduplication. Rejected hashes are retained for 90 days; investigated hashes are retained for 30 days.

## Strict containment flow

1. **Stack trace only:** parse a source file and line from the supplied trace. Only `src/**/*.mjs|js|ts|tsx|jsx` paths are eligible.
2. **Line window:** retrieve the exact file from GitHub and send only the failing line ±40 lines (up to 81 lines) to Workers AI. The full repository is not sent to the model.
3. **Deterministic prompt:** the Worker uses the surgical bug-fix contract. The model must return JSON with `can_fix_strictly`, `confidence`, `target_file`, `search_code`, `replace_code`, `scope_justification`, and `reason`.
4. **Exact replacement only:** the search block must be verbatim in the scoped excerpt and occur exactly once in the file. No full-file LLM output is accepted. Imports/dependencies are rejected.
5. **Hard limits before branch creation:** exactly one whitelisted source file; at most 15 total changed lines; absolute replacement-vs-search line delta at most 15. The Worker performs these checks before creating a branch.
6. **Protected paths:** deny package manifests/lockfiles, build files, Gradle files, `.github/`, auth/config/secrets, migrations, tests/specs, test Kotlin files, `worker.js`, and Wrangler configuration.
7. **Pre-PR comparison:** after the one-file patch is committed to a dedicated `fix/auto-heal-<full-error-hash>` branch, GitHub compare is checked again. Any extra file, protected path or diff over 20 insertions+deletions aborts PR creation.
8. **Draft PR only:** an eligible patch creates a draft PR. The Worker cannot merge, deploy, change DNS, modify secrets, migrate databases or rewrite tests.

## Auto-Heal Guard workflow

`.github/workflows/auto-heal-guard.yml` is scoped to `fix/auto-heal-*` branches and their PRs to main. It verifies:
- Exactly one source file and no more than two files (the Worker requires exactly one).
- No test, spec, configuration, auth, dependency or workflow files.
- No more than 20 total insertions + deletions.
- Existing `npm test` and `npm run check:dashboard` both pass.

If the guard or test suite fails, the workflow labels the PR `auto-heal-rejected`, closes it without merging, and calls the Worker with the full error hash. The Worker records that hash in KV so the same failure is not retried.

## Safety and operational limitations

- An issue without a precise stack trace, a protected path, ambiguous search block, low confidence, missing AI/GitHub access, or a patch that exceeds the hard cap is escalated for manual action.
- The model's output is untrusted. The Worker validates every field and never accepts a full-file rewrite.
- The system creates draft PRs only; human review and existing branch protections remain mandatory.
- GitHub Actions workflow files must be on the repository default branch for GitHub to trigger them.
- GitHub Actions OIDC is restricted to this repository and these two workflow files.
- The existing Workers AI binding and the new `AUTO_HEAL_KV` binding are used; no paid external AI provider or new SMTP account is introduced.
- The incident report describes the repair attempt and its PR/issue link. It does not claim a fix is complete until CI passes and a human-approved merge/deployment is independently verified.
