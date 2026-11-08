# PDF reader

Owns one worker-backed PDF document and its Canvas, continuous, article and proof views. Canvas is authoritative. Local analysis and search remain independent, bounded and source-aware. Per-page failure handling and cleanup stay within this adapter. Konsta buttons style view choices without moving their state to App. Main reader controls stay visible because PDF content does not opt into automatic chrome hiding.
