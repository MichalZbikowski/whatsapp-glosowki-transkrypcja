# RESEARCH: transkrypcja głosówek WhatsApp Web (Brave, MV3, Whisper lokalnie)

Legenda: [W] = zweryfikowane w źródle (link), [Z] = wiedza z pamięci / nieweryfikowane, wymaga sprawdzenia na żywym WA Web (WA często zmienia DOM).

## 1. Jak WA Web pobiera/odszyfrowuje/odtwarza głosówki

- Głosówka to `audioMessage` z `ptt=true`, kontener ogg/Opus (MIME `audio/ogg; codecs=opus`) [W: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/audio-messages].
- Media leżą zaszyfrowane na CDN (mmg.whatsapp.net), WA Web pobiera je, odszyfrowuje w JS (AES-CBC + HMAC, klucz `mediaKey` z wiadomości) i tworzy `Blob` -> `URL.createObjectURL` -> `blob:https://web.whatsapp.com/<uuid>` ustawiany jako `src` elementu `<audio>` w dymku [Z].
- Moment powstania bloba [Z]: zwykle dopiero po kliknięciu play (lub autopobraniu, zależnie od ustawień/ostatniej aktywności); dla niepobranych jest ikona `audio-download`/`media-download`. Dlatego "Transkrybuj" musi albo wywołać pobranie (symulowany klik play, potem pause), albo użyć wewnętrznego API (plan B).
- Element: `<audio>` w drzewie DOM dymka (nie zawsze `new Audio()`); MIME bloba w typie `audio/ogg; codecs=opus` [Z] - weryfikować `blob.type` w hooku.
- Blob URL jest same-origin, więc `fetch(audio.src)` z kontekstu strony/content scriptu zwraca bajty [Z, standard Web].

## 2. Stabilne atrybuty dymka głosówki (do potwierdzenia na żywo)

Brak publicznej dokumentacji selektorów; wa-js/wppconnect NIE używa DOM, tylko wywołuje wewnętrzne moduły WA (`WPP.*`) [W: https://github.com/wppconnect-team/wa-js]. Z doświadczenia [Z]:
- Wiersz wiadomości: `div[data-id]` (format `true_<jid>_<ID>` wychodzące / `false_...` przychodzące; w grupach dodatkowo `_<participant>`), często `role="row"`/`listitem`.
- Przycisk play: `button[aria-label]` lokalizowane ("Play voice message" / "Odtwórz wiadomość głosową") - NIE polegać na tekście; stabilniej `span[data-icon="audio-play"]` (po starcie `audio-pause`), `data-icon="ptt-status"` (mikrofon, nieodsłuchana), `data-icon="audio-download"`.
- Suwak: `input[type=range]` / `role="slider"`; element `audio` jako potomek wiersza.
- Strategia: wykrywać głosówkę przez obecność `[data-icon^="audio-"]` lub `ptt-status` w `[data-id]`, bez zależności od języka UI; MutationObserver na `#main` / `[data-id]`.

## 3. Istniejące rozszerzenia (głównie closed-source)

- WA Voice to Text (Whisper WASM lokalnie, przycisk "Transcribe" pod dymkiem): https://www.chromeboard.com/extension/wa-voice-to-text-for-what-hpinlmbnomnjbibikfijlhkpidooikjj
- WhatsApp Parakeet Transcr (Parakeet v3, WebGPU lokalnie): https://www.chromeboard.com/extension/whatsapp-parakeet-transcr-jclpnlbgonmnhfocgmhjbaoeglooegjj
- Audio to Text AI (Groq/OpenAI/Deepgram), WhatsApp Audio Transcriber (OpenAI Whisper API, wykrywa nowe audio i pobiera content): https://chromeboard.com/extension/audio-to-text-ai-peglnebbahdbohfgallmhfcllmmmpdnc , https://extensionauditor.com/scan/whatsapp-audio-transcriber-knjcfhlcbbkgjfocddahfmhjongelpgk
- Nie znaleziono otwartego kodu źródłowego z opisem techniki; wszystkie "obsługują blob audio". Userscript blokujący dzwonki WA hookuje `HTMLMediaElement.prototype.play`: https://pparaxan.codeberg.page/projects/001-block_whatsapp_vn_chime/ - potwierdza wykonalność hooków na prototypach w stronie.
- Wniosek: typowa technika = hook w MAIN world (`URL.createObjectURL`/`play`) lub `fetch(blob:)` z `audio.src`.

## 4. Transformers.js + Whisper large-v3-turbo w offscreen MV3

- Aktualna paczka `@huggingface/transformers` jest już w serii 4.x (npm: 4.2-4.3) [W: https://app.unpkg.com/@huggingface/transformers@4.2.0/files/src/backends/onnx.js]; API v3 (pipeline, dtype per moduł) zachowane. Zalecenie: przypiąć dokładną wersję i zweryfikować nazwy plików wasm z `dist`.
- Model: `onnx-community/whisper-large-v3-turbo` [W: https://huggingface.co/onnx-community/whisper-large-v3-turbo/tree/main/onnx]. Rozmiary: encoder fp16 1.27 GB, q4 425 MB, q4f16 370 MB; decoder_model_merged/decoder fp16 344 MB, q4 334 MB, q4f16 193 MB; decoder_with_past fp16 318 MB, q4 326 MB, q4f16 186 MB; encoder fp32 2.55 GB.
- Dtype per moduł (blog v3: Whisper bardzo wrażliwy na kwantyzację enkodera) [W: https://www.huggingface.co/blog/transformersjs-v3]. Typowo WebGPU: `dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' }`  (~1.6 GB; q4f16 enkoder ~370 MB = mniejszy, lecz słabsza jakość/ryzyko - testować na polskim). WASM fallback: `encoder_model: 'q4'` lub `'int8'`/`'q8'`, `decoder_model_merged: 'q4'` (WASM wolny dla large; rozważyć fallback na mniejszy model, np. whisper-small/base, jako opcję).
- `device: 'webgpu'` w pipeline; przy braku `navigator.gpu`/adaptera -> `device: 'wasm'`. WebGPU niedostępne w service workerze, a ort w SW nie ustawia domyślnych wasmPaths [W: kod onnx.js powyżej] -> inferencja w offscreen document (`chrome.offscreen.createDocument`, reasons np. `AUDIO_PLAYBACK`/`WORKERS`; ma `AudioContext`, `navigator.gpu`, Workery).
- Brave: WebGPU na Windows włączone domyślnie (Chromium >=113, D3D12) [Z]; Brave bywa z `brave://flags/#enable-unsafe-webgpu` i Shields nie blokuje; sprawdzić `brave://gpu`. Zweryfikować na maszynie.
- CSP (manifest): `"content_security_policy": {"extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"}`. MV3 zabrania zdalnego kodu -> NIE CDN; skopiować z `node_modules/onnxruntime-web/dist` pliki `ort-wasm-simd-threaded.asyncify.mjs` + `.wasm` (Safari: `ort-wasm-simd-threaded.mjs/.wasm`; dla jsep/webgpu zgodnie z wersją) do rozszerzenia i ustawić:
  `env.allowRemoteModels=false; env.allowLocalModels=true; env.localModelPath=chrome.runtime.getURL('models/'); env.backends.onnx.wasm.wasmPaths=chrome.runtime.getURL('ort/'); env.backends.onnx.wasm.numThreads=1` (wątki wymagają COOP/COEP/SharedArrayBuffer - w offscreen niedostępne bez nagłówków; 1 wątek z WebGPU wystarczy; `proxy=false`).
  Model w rozszerzeniu: struktura `models/onnx-community/whisper-large-v3-turbo/{config.json,generation_config.json,preprocessor_config.json,tokenizer.json,tokenizer_config.json,onnx/...}`; pliki z `chrome.runtime.getURL` muszą być w `web_accessible_resources` tylko jeśli ładuje je strona; offscreen to extension page - nie trzeba. Alternatywa gdy zbyt duże paczki (>1.6 GB): pobrać raz z HF do Cache API/OPFS (`env.useBrowserCache=true`), co jest dozwolone (to dane, nie kod), ale wymaga `host_permissions` huggingface.co/cdn-lfs.
- Parametry ASR: `pipe(audio, { language: 'polish', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: false })` (jako 'polish'; w v3 działa też `'pl'`, sprawdzić). Głosówki zwykle <30 s -> jeden chunk; dla dłuższych chunk 30/stride 5 (`return_timestamps: true` potrzebne przy chunkach dla spójnego sklejania w niektórych wersjach; test). Audio: Float32Array mono 16 kHz.
- Znane problemy: duży enkoder fp32 nie mieści się (limit 2 GB protobuf) -> używać fp16/q4; WebGPU + q4 na niektórych GPU dawało śmieci (stąd fp16 enkoder); pierwsze ładowanie długie -> pokazywać postęp (`progress_callback`); pamięć GPU ~2 GB; offscreen document może zostać zamknięty - trzymać model w pamięci i ponawiać `createDocument`.
- Transfer audio: najlepiej wysyłać NIEdekodowany mały blob (ogg/opus ~kilkadziesiąt-100 KB) i dekodować w offscreen (`new AudioContext({sampleRate:16000}).decodeAudioData` lub `OfflineAudioContext`; Chrome dekoduje ogg/opus). `chrome.runtime.sendMessage` domyślnie serializuje JSON (ArrayBuffer/Float32Array nie przechodzi poprawnie; limit wiadomości ~64 MB) - albo `base64`/tablica liczb dla małych danych, albo Chrome 148+ `"message_serialization": "structured_clone"` w manifeście [W: https://developer.chrome.com/blog/structured-clone-messaging]. Alternatywy: `URL.createObjectURL` zrobiony w kontekście rozszerzenia (blob URL strony nie jest czytelny z offscreen, bo inny origin - trzeba przekazać bajty), `chrome.runtime.connect` port, `MessageChannel`, IndexedDB/Cache wspólny dla origin rozszerzenia (content script ma origin strony, więc tylko przez background). Praktycznie: content script -> `runtime.sendMessage` z base64 (do kilku MB) -> background -> offscreen.

## 5. Playwright + Brave

- Wzorzec: `chromium.launchPersistentContext(userDataDir, { executablePath: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe', headless: false, args: ['--disable-extensions-except=<abs>', '--load-extension=<abs>'] })`; MV3 service worker: `context.waitForEvent('serviceworker')`, ID z URL SW [W: https://playwright.dev/docs/chrome-extensions]. Wymagany headed (lub `--headless=new` w Chromium).
- Chrome 137+ branded usunął `--load-extension`; NIE dotyczy Chromium/Chrome for Testing [W: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ]. Playwright docs: Chrome/Edge usunęły flagi, używać bundled Chromium. Brave nie jest "Chrome-branded", więc flaga powinna działać [Z, wnioskowanie - zweryfikować]. Awaryjnie dodać `--disable-features=DisableLoadExtensionCommandLineSwitch` (flaga istnieje w Chromium; w Chrome 137+ pozwala cofnąć usunięcie) oraz fallback: bundled Chromium (`channel: 'chromium'`) lub ręczny "Load unpacked" w `brave://extensions`.
- Uwaga: Brave wymaga własnego `--user-data-dir` (persistentny kontekst to zapewnia), Shields/ad-block może zmieniać zachowanie WA; do testów WA wymagane zalogowanie QR (profil trwały).

## Rekomendacja strategii przechwytywania audio

**Plan A (preferowany): hook w MAIN world + korelacja z dymkiem.**
1. Content script `"world": "MAIN"`, `run_at: document_start`: owinąć `URL.createObjectURL` (zapisz `Map<blobUrl, Blob>` dla `blob.type` zaczynającego się od `audio/`) i `HTMLMediaElement.prototype.play/ src setter` (żeby powiązać `audio.src` z najbliższym `[data-id]`).
2. Drugi (ISOLATED) content script wstrzykuje przycisk "Transkrybuj" do każdej głosówki (wykrycie przez `[data-icon^="audio-"]`/`ptt-status`, MutationObserver). Klik: jeśli blob dla `data-id` istnieje -> weź; jeśli nie -> programowo kliknij play (muted, następnie pause/restore), poczekaj na blob (timeout), pobierz bajty (`blob.arrayBuffer()` lub `fetch(audio.src)`).
3. Wyślij mały ogg/opus przez `runtime.sendMessage` do background -> offscreen; dekodowanie do 16 kHz mono i Whisper w offscreen; wynik wstaw pod dymek, cache po `data-id` w `chrome.storage.local`.

**Plan B (fallback): wewnętrzne API WA przez wa-js.** Wstrzyknąć `wppconnect-wa.js` (spakowany lokalnie w rozszerzeniu, MAIN world) i po `WPP.isReady` pobrać `WPP.chat.getMessageById(data-id)` -> `WPP.whatsapp.downloadManager.downloadAndMaybeDecrypt` / `msg.downloadMedia()` (nazwy zweryfikować w typedoc https://wppconnect.io/wa-js/) -> blob bez klikania play. Zalety: bez odtwarzania, odporne na lazy-download; wady: zależność od wewnętrznych modułów WA, większy rozmiar, ryzyko łamania przy aktualizacji WA.

**Plan C (ostateczny):** `audio.captureStream()` / `MediaRecorder` przy odtwarzaniu wyciszonym z `playbackRate` (do 16x) - działa bez dostępu do bloba, kosztem czasu i jakości.
