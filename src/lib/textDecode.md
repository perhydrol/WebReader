# TXT byte decoding

`textDecode.ts` converts an imported blob to a string without transmitting it.

- Strict UTF-8 is attempted first. Invalid byte sequences fall back to GB18030.
- The final platform `TextDecoder` is a last-resort lenient path. It is retained from the previous reader behavior.
- The UTF-8 decoder removes a leading BOM by default. `buildTextSourceModel` also removes one leading BOM if a fallback decoder leaves it, so all locators use offsets after the BOM.
- Decoding reads the whole 8 MB-limited TXT blob once. There is deliberately no worker or streaming layer in this version.
