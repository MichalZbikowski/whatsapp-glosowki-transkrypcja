# Transkrypcja głosówek WhatsApp (Brave)

Rozszerzenie dodaje do każdej głosówki na web.whatsapp.com przycisk **Transkrybuj** i pokazuje tekst pod dymkiem.
Domyślnie działa lokalnie i za darmo (Whisper large-v3-turbo w przeglądarce, WebGPU). Tylko odczyt: nic nie wysyła w WhatsAppie.

## Instalacja w Brave (krok po kroku)
1. W folderze projektu: `npm install`, potem `npm run build` (powstaje folder `dist/`).
2. W Brave otwórz `brave://extensions`, włącz **Tryb dewelopera** (prawy górny róg).
3. Kliknij **Załaduj rozpakowane** i wskaż folder `dist` z projektu.
4. Nie przenoś i nie zmieniaj nazwy folderu `dist`. Od jego ścieżki zależy ID rozszerzenia, a z nim pobrany model.
5. Odśwież web.whatsapp.com.

## Pierwsze użycie i model
- Pierwsze „Transkrybuj” pobiera model (ok. 1,5 GB, kilka minut). Pobiera się raz i zostaje w profilu Brave.
- Przy każdym starcie przeglądarki model wczytuje się do GPU (ok. 25–30 s). Rozszerzenie robi to już po pojawieniu się pierwszej głosówki na stronie.
- Transkrypcje są zapamiętane po ID wiadomości (kolejne kliknięcie jest natychmiastowe).
- Jeśli WebGPU jest niedostępne, działa wolniejszy tryb CPU (WASM).

## Tryb Groq (awaryjny)
Ikona rozszerzenia → Ustawienia → tryb **Groq**, wklej klucz z console.groq.com. Model: `whisper-large-v3`, język `pl`, słowniczek terminów jako prompt.
Opcjonalnie klucz Anthropic włącza korektę terminów i TL;DR (Claude Haiku). Klucze są tylko w `chrome.storage.local`, nie w kodzie.

## Plik z dysku
Popup rozszerzenia (ikona) pozwala wrzucić plik .ogg/.opus/.mp3/.m4a i dostać transkrypcję.

## Gdy WhatsApp zmieni wygląd
Wszystkie selektory są w jednym pliku: `src/selectors.js` (głosówka = ikona `ptt-status`, przycisk play rozpoznawany po tytule ikony SVG). Po zmianie: `npm run build` i odśwież rozszerzenie w `brave://extensions`.
Wzorzec dymka: `tests/fixtures/wa-bubble.html`; odświeżysz go skryptem `node scripts/wa-fixture.mjs`.

## Testy
`npm run smoke` (ładowanie w Brave), `node tests/pipeline.mjs plik.ogg` (WER), `node tests/wa-e2e.mjs all` (prawdziwy testowy czat, wymaga zalogowanego profilu `.wa-profile`).
