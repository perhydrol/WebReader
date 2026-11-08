# Acceptance contract

Near-limit synthetic TXT measures bounded mounts and script/DOM readiness timings in production Chrome. Core mode timing starts at the real pointerdown event on the settings control and ends at view readiness; separate modeFlowMs/backFlowMs include opening and closing settings. These metrics do not measure presented frames, touch latency p95 or iPhone performance. Budgets for core operations remain unchanged.
