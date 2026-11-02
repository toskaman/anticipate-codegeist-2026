# Browser interaction and repeated-route observations

Run npm run test:browser -- --grep "records browser interaction" from static/hello-world. Actual machine-readable results: evidence/experience/v2-reliability/browser-observations-LOCAL.json.

The test uses Chromium locally with fictional data. It measures five Playwright fill-to-visible search samples on 120 synthetic dependencies; timings include test-driver and assertion overhead. It then warms Graph/Mission Control and performs 30 round trips, collecting garbage before memory snapshots at baseline and cycles 5/15/30. It records DOM nodes, event listeners and heap, instruments the app's hashchange listener balance, and fails on net DOM/listener growth or page errors in this bounded sample.

The isolated sample recorded ~16 ms median search and ~39 ms maximum. DOM stayed at 281 nodes and 173 listeners; one active hashchange listener remained across all 30 cycles. JavaScript heap after collection rose from ~20.23 MB to ~20.89 MB, with checkpoint growth slowing after warmup. This does NOT prove absence of retained objects or long-run leaks. Latest reruns may differ under parallel test load; the JSON is authoritative for that run.

A provisional local interaction target after this baseline is median fill-to-visible below 250 ms on this dataset/machine class. This is an engineering target, not an advertised SLA or hard CI gate. More samples, longer soak tests, production datasets, actual browser zoom/assistive technology and Forge-hosted network/authentication behavior remain open. No customer productivity or incident-prevention claim follows from these timings.
