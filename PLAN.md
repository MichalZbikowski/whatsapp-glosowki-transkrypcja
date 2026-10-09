# PLAN (wznawiaj od pierwszego nieodhaczonego punktu)

Źródło prawdy: CLAUDE.md. Testowy czat: "Szymon Perlicki Praca".

## Fazy
- [x] 0. PLAN.md, sprawdzenie PRZED STARTEM (→ TODO-MICHAL.md), subagent research (→ docs/RESEARCH.md)
- [x] 1. Szkielet + manifest; ładuje się w Brave przez Playwright bez błędów
- [x] 2. Pipeline lokalny na pliku (popup + offscreen), działa na krotka.ogg
- [ ] 3. Logowanie WA (QR od Michała) + fixture dymka
- [ ] 4. mock-wa.html, content script, przechwytywanie bloba, test E2E na atrapie
- [ ] 5. Test na testowym czacie: krótka/średnia/długa
- [ ] 6. Długie nagrania, postęp, cache, błędy
- [ ] 7. Groq, korekta/TL;DR, strona ustawień
- [ ] 8. Subagent bench → ustawienia domyślne
- [ ] 9. README.md PL + TODO-MICHAL.md
- [ ] 10. Subagent reviewer → poprawki do pełnego OK

## DEFINICJA UKOŃCZENIA (każdy punkt z dowodem)
- [x] 1. Ładuje się w Brave bez błędów w konsoli
- [x] 2. Playwright: mock-wa.html + testowy czat (przycisk przy każdej głosówce; krótka/średnia/długa; właściwy dymek; zrzuty w docs/screenshots/)
- [ ] 3. WER krotka.ogg: lokalnie <18%, Groq <12% (jeśli klucz)
- [ ] 4. dluga.ogg w całości lokalnie, ostatnie zdania w tekście, czas w RESULTS.md
- [ ] 5. Cache: druga transkrypcja bez modelu/API
- [ ] 6. Fallback: ręczny upload pliku w popupie
- [ ] 7. README.md PL (instalacja, model, Groq, selectors.js)
- [ ] 8. REVIEW.md: wszystko OK

## Dziennik
- Folder był pusty; brak plików w test-audio/ (wpisano do TODO-MICHAL.md).
- Faza 1: tests/smoke.mjs -> 'OK: brak błędów w konsoli' (Brave, id akffegahbfmdogdgcdafbjpkfmnmgkgn). WebGPU adapter w stronie rozszerzenia = false (do zbadania).
- Faza 2: tests/pipeline.mjs na test-audio/synt-krotka.ogg (syntetyczne, głos Paulina): WER=10.5% CER=4.1%, WebGPU Iris Xe, 27 s przy cache modelu (pierwsze pobranie ~5 min). Czeka na prawdziwe krotka.ogg.
