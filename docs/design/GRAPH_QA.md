# Graph QA and local baseline

Status: VERIFIED_LOCAL / MOCK datasets. The graph receives explicit root, nodes and relationships through the provisional client schema. It no longer fabricates one direct root edge for every service.

## Evidence semantics

Relationships carry stable ID, source/target, CALLS/ROUTES/TESTS/DEPENDS_ON, CONFIRMED/INFERRED/UNKNOWN, source reference, optional HTTPS URL, observed time, FRESH/STALE/UNKNOWN, DIRECT/TRANSITIVE and supplied provenance. Missing source URLs are shown as references, never invented links. Freshness is explicit metadata, not an AI-derived upgrade. Runtime validation rejects duplicate IDs, dangling endpoints, unsafe URLs and provenance steps not present in supplied relationships. These schemas still need CORE review.

The authored pipeline fixture is INFERRED, STALE and TRANSITIVE: pipeline → gateway → auth. Selecting it highlights the actual two supplied relationships. Unknown evidence remains unknown. Iterative BFS uses a visited set and terminates on cycles; a disconnected cycle returns no verified path instead of a fake root connection.

## Rendering bounds

The accessible list pages through 20 dependencies. The visual window contains those services, at most 20 additional path steps and at most 80 relationships. Only edges with displayed endpoints are drawn. Omitted relationships are disclosed. Choosing a context node reveals its page and clears incompatible filters rather than ignoring the click. Search/filter resets pagination; search covers the loaded dataset, not only the current page.

Fixture payload validation permits at most 10,000 nodes and 30,000 relationships; this is a defensive client payload bound, not a scalability guarantee. CORE-side pagination and actual graph schemas remain to agree. Four-column layout is bounded to the current window; source/target handle orientation follows supplied relative positions.

## Verification

41 unit tests and 20 browser tests pass in the full application suite. Specific graph checks cover a 120-node cycle fixture, pagination bounds, search outside the first page, stale/transitive filters, context-node selection, provenance and unsafe URLs. Model tests also cover 1,000 nodes and disconnected cycles. Automated axe/overflow checks still cover the seven product screens in both themes at 1440/1024/390. Dark desktop graph and the rendered source panel were visually inspected; connect-orientation issues were corrected. Not every large-data/theme/viewport screenshot has had individual visual inspection.

## Reproducible model baseline

Run npm run benchmark:graph from static/hello-world. The result is evidence/experience/v2-graph/model-performance-LOCAL.json. Measured on Node 26.7.0, 10 warmups then 100 samples, excluding dataset generation and schema validation:

| Synthetic dependencies | Relationships | Median filter/page + BFS | p95 |
|---|---:|---:|---:|
| 120 | 122 | 0.028 ms | 0.047 ms |
| 1,000 | 1,002 | 0.151 ms | 0.299 ms |

These are internal model timings, not customer outcomes, UI latency, network latency or Forge performance. A provisional engineering target after this baseline is model p95 below 5 ms on the same class of local runtime/dataset. It is not a hard CI gate or advertised SLA. Browser interaction latency, repeated-route leak checks and Forge-hosted performance remain unmeasured.
