# Record schemas

## Raw signal

`signal_id`, `collected_at`, `source_type`, `source_name`, `source_url`, `title`, `excerpt`, `engagement`, `author_role`, `workflow_hint`, `evidence_note`.

## Pain cluster

`cluster_id`, `label`, `signal_ids`, `recurring_workflow`, `affected_role`, `payment_or_workaround_signal`, `contrary_evidence`, `verification_status`.

## Wild Concept

`concept_id`, `cluster_id`, `concept_title`, `transformation_operator`, `concept_hypothesis`, `default_assumption_broken`, `why_it_might_work`, `disproof_condition`, `evidence_boundary`.

Every concept must state that it is speculative. It may reference evidence but must not alter the source signal or cluster verification status.

## Workbook

- `Summary`: run metadata, source counts, collection failures, cluster and concept totals.
- `Pain Signals`: one row per raw signal with source URL and evidence boundary.
- `Pain Clusters`: provisional groupings and verification gaps.
- `Wild Concepts`: speculative transformations linked to clusters.
- `Sources`: source status, access method, timestamp, and errors.
