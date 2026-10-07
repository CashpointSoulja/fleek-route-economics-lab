# Metrics

All targets are hypotheses (TO TEST). Denominators are stated for every metric.

## Decision quality (north star)
| Metric | Definition | Denominator |
|---|---|---|
| Scaled-route margin hold rate | routes whose actual contribution margin after 2 scale cycles is within 3 pts of the scale-gate estimate | routes that passed the scale gate |
| Blocked-then-cleared rate | routes blocked on evidence that later passed every gate | routes ever blocked |
| Time to gate | days from route created to PROCEED or KILL | routes reaching a terminal call |

## Guardrails
| Metric | Definition | Denominator |
|---|---|---|
| Unknown-gate scale calls | scale-gate calls logged while any blocking gate failed (must be 0; the app makes it impossible) | all scale-gate calls |
| Stale decisions acted on | decisions whose fingerprint no longer matches current inputs at the time of the next action | decisions |
| Peak cash vs limit | actual peak cash per pilot ÷ pilot capital limit | pilots |

## Model accuracy (per pilot lot)
Assumed vs actual for grading yield, sell-through, returns, freight per kg, transit days. Report the absolute error and the margin impact of each, so the biggest-impact input gets better evidence first.

## Event taxonomy (if instrumented)
| Event | Payload |
|---|---|
| `case_loaded` | case id |
| `input_edited` | route, key, old, new, has_source, source_date |
| `gate_failed` | route, gate id, decision code |
| `decision_recorded` | route, decision code, call, fingerprint |
| `scenario_exported` / `scenario_imported` | format, ok, error count |
The concept app does not send any events; this is the proposed schema.
