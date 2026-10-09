# Transkrypcja głosówek WhatsApp – rozszerzenie do Brave

> TESTOWY CZAT: "Szymon Perlicki Praca"
> (jedyne miejsce do uzupełnienia; niżej nazywany "testowym czatem")

\---

## PRZED STARTEM – rzeczy dla Michała (agent: sprawdź, czy są zrobione; jeśli nie, wpisz brakujące do TODO-MICHAL.md i pracuj dalej nad resztą)

1. Ten plik leży w folderze projektu jako `CLAUDE.md`, a nazwa testowego czatu jest wpisana na górze.
2. W folderze `test-audio` są 3 głosówki z testowego czatu: `krotka.ogg` (ok. 30 s–1 min), `srednia.ogg`, `dluga.ogg` (ok. 16 min).

   * Skąd je wziąć: telefon → testowy czat → ⋮ → Więcej → Eksportuj czat → Dołącz multimedia. Głosówki są w środku jako pliki `.opus`; końcówka `.opus` też jest OK.
3. `test-audio/krotka.ref.txt` – ręcznie przepisana, słowo w słowo, treść krótkiej głosówki.
4. (Opcjonalnie) klucz Groq z console.groq.com – do trybu awaryjnego. Agent poprosi o niego przez TODO-MICHAL.md, jeśli będzie potrzebny.

\---

## CEL

Zbuduj rozszerzenie do przeglądarki Brave (Chromium, Manifest V3), które na web.whatsapp.com dodaje do każdej wiadomości głosowej przycisk "Transkrybuj" i wyświetla pod nią tekst.

* Głosówki są po polsku z wtrąceniami angielskich terminów programistycznych, długość do 16+ minut.
* Domyślnie rozszerzenie działa LOKALNIE i ZA DARMO (Whisper w przeglądarce). Groq API to opcja awaryjna.

Pracuj autonomicznie, aż spełnisz całą DEFINICJĘ UKOŃCZENIA. Nie pytaj o zgodę na rzeczy, które możesz zrobić sam. Ten plik jest ładowany w każdej sesji – jeśli kontekst się skończy albo sesja się zrestartuje, wracasz do PLAN.md i kontynuujesz od pierwszego nieodhaczonego punktu.

## ŚRODOWISKO

* Windows, PowerShell. Folder projektu: bieżący katalog.
* Przeglądarka docelowa: Brave, zwykle `C:\\\\Program Files\\\\BraveSoftware\\\\Brave-Browser\\\\Application\\\\brave.exe`.
* Pliki testowe w `test-audio/`: `krotka.ogg` (+ `krotka.ref.txt` jako wzorzec), `srednia.ogg`, `dluga.ogg`. Mogą mieć końcówkę `.opus`. To te same głosówki co w testowym czacie.
* Jeśli brakuje Node.js, ffmpeg lub innego narzędzia: zainstaluj (np. winget, npm). Jeśli się nie da, wpisz do TODO-MICHAL.md.

## ARCHITEKTURA

* **Język i build**: czysty JavaScript (ES modules). Bundler tylko jeśli Transformers.js tego wymaga – wtedy esbuild, a gotowe rozszerzenie ląduje w `dist/` do załadowania przez "Załaduj rozpakowane".
* **Content script** na web.whatsapp.com:

  * MutationObserver wykrywa dymki głosówek i dodaje przycisk.
  * Wszystkie selektory są w jednym pliku `selectors.js`, oparte na aria-label i data-icon, NIE na klasach CSS.
* **Skrypt w świecie MAIN**:

  * Hook na `URL.createObjectURL` przechwytuje bloby `audio/\\\*` przy odtwarzaniu.
  * Po kliknięciu "Transkrybuj" rozszerzenie samo uruchamia odtwarzanie, przechwytuje blob i pauzuje.
  * Musi poprawnie przypisać blob do właściwego dymka.
* **Offscreen document** – tu działa model (Transformers.js, `@huggingface/transformers`):

  * pipeline `automatic-speech-recognition`, Whisper large-v3-turbo w ONNX pod WebGPU;
  * device `webgpu` z fallbackiem na `wasm`;
  * model cache'owany (Cache API), pobierany raz;
  * `language='pl'`, `chunk\\\_length\\\_s=30` ze stride, żeby długie nagrania szły w całości;
  * dekodowanie ogg/opus do 16 kHz mono przez OfflineAudioContext.
* **Background service worker**: koordynuje kolejkę, cache i opcjonalny tryb Groq.
* **manifest.json**: `content\\\_security\\\_policy` z `'wasm-unsafe-eval'`, minimalne uprawnienia.
* **Tryb Groq** (opcja w ustawieniach):

  * endpoint `/openai/v1/audio/transcriptions`, model `whisper-large-v3` (nie turbo);
  * `language=pl`, `prompt` = słowniczek terminów.
* **Korekta i TL;DR** (opcjonalnie, domyślnie wyłączone) przez Claude Haiku (Anthropic API). Korekta poprawia tylko pisownię terminów, nie zmienia treści.
* **Strona ustawień**:

  * tryb (lokalny / Groq);
  * klucze API;
  * słowniczek terminów. Domyślnie: commit, pull request, merge, branch, deploy, Docker, Zabbix, Jira, endpoint, API, JSON, frontend, backend, bug, feature, review, repo, GitHub, Claude Code;
  * przełączniki korekty i TL;DR.
* **UI pod dymkiem**:

  * postęp (pobieranie modelu / transkrypcja X%);
  * tekst podzielony na akapity;
  * przycisk "Kopiuj";
  * przy TL;DR zwijana sekcja.
* **Cache transkrypcji** w `chrome.storage.local` (lub IndexedDB) po ID wiadomości.
* **Fallback**: w popupie można ręcznie wrzucić plik `.ogg`/`.opus`/`.mp3`/`.m4a`.

## ZASADY

* Tylko odczyt. Rozszerzenie NIGDY nic nie wysyła w WhatsAppie ani nie klika niczego poza play/pauza.
* Klucze API nigdy w kodzie ani w repo.
* `.gitignore`: `test-audio/`, `.wa-profile/`, `node\\\_modules/`, pliki z kluczami.
* Każdy błąd jest widoczny dla użytkownika po polsku: brak WebGPU, brak klucza, limit API, nie udało się przechwycić audio, model się nie pobrał.
* `git init` na starcie i commit po każdej działającej fazie.

## TEST NA PRAWDZIWYM WHATSAPPIE

* **Uruchomienie**: Playwright, `launchPersistentContext` z Brave (executablePath jak wyżej), profil w `./.wa-profile`, z załadowanym rozszerzeniem, tryb headed.
* **Logowanie**: przy pierwszym uruchomieniu otwórz web.whatsapp.com i ZATRZYMAJ SIĘ.

  * Wpisz do TODO-MICHAL.md i napisz w czacie: "Zeskanuj kod QR w otwartym oknie Brave (telefon: WhatsApp → Połączone urządzenia → Połącz urządzenie)".
  * Czekaj na potwierdzenie, potem kontynuuj.
  * Jeśli później sesja wygaśnie, postępuj tak samo.
* **Zakres**: otwieraj WYŁĄCZNIE testowy czat.

  * Nie otwieraj innych czatów i nie przewijaj listy czatów dłużej niż trzeba.
  * Nie czytaj ani nie zapisuj treści innych wiadomości niż głosówki.
* **ZAKAZ**: pisania w polu wiadomości, wysyłania, reakcji, usuwania, przekazywania.
* **Dozwolone kliknięcia**: wybór testowego czatu, play/pauza głosówki, przycisk "Transkrybuj" i UI rozszerzenia.
* **Fixture**: zapisz prawdziwy HTML dymka głosówki do `tests/fixtures/wa-bubble.html` i zbuduj na nim `tests/mock-wa.html`, żeby testy automatyczne działały też bez logowania.

## SUBAGENCI

Używaj narzędzia Agent (typ general-purpose), przekazując poniższe instrukcje roli w prompcie. Każdy subagent zwraca krótki raport z konkretami, nie zrzuty plików.

### 1\. research (model: sonnet)

* **Kiedy**: na początku, równolegle z pisaniem szkieletu.
* **Zadanie**:

  * ustal, jak WhatsApp Web pobiera, odszyfrowuje i odtwarza wiadomości głosowe (blob URL, element audio czy `new Audio()`, jaki MIME);
  * ustal, jakie są stabilne atrybuty dymka głosówki (aria-label, data-icon, data-id wiadomości);
  * sprawdź, jak robią to istniejące projekty open source (rozszerzenia do transkrypcji WA, wa-js);
  * sprawdź aktualny sposób uruchamiania Transformers.js + Whisper w offscreen document MV3 i znane problemy (CSP, WASM, rozmiar modelu, WebGPU w Brave).
* **Wynik**: `docs/RESEARCH.md` + rekomendacja strategii przechwytywania audio z planem B.

### 2\. bench (model: sonnet)

* **Kiedy**: gdy pipeline transkrypcji działa, i po każdej zmianie ustawień.
* **Zadanie**:

  * transkrybuj pliki z `test-audio/` w trybie lokalnym – Playwright, Brave w trybie headed z załadowanym rozszerzeniem, żeby mierzyć prawdziwe WebGPU;
  * jeśli jest klucz, zrób to samo w trybie Groq;
  * licz WER i CER względem `krotka.ref.txt` (`scripts/wer.js`, normalizacja: małe litery, bez interpunkcji);
  * mierz czas transkrypcji każdego pliku;
  * testuj warianty: ze słowniczkiem i bez, z korektą LLM i bez, dtype q4 vs fp16 enkodera;
  * sprawdź, czy końcówka `dluga.ogg` jest w tekście.
* **Wynik**: tabela dopisana do `RESULTS.md` (data, wariant, WER, CER, czas) + rekomendacja ustawień domyślnych.

### 3\. reviewer (model: opus)

* **Kiedy**: na końcu, w świeżym kontekście.
* **Zadanie**:

  * bez zaufania do wcześniejszych deklaracji sprawdź każdy punkt DEFINICJI UKOŃCZENIA;
  * uruchom testy samodzielnie;
  * przeczytaj kod pod kątem bezpieczeństwa (klucze, uprawnienia, czy nic nie wysyła wiadomości) i odporności selektorów.
* **Wynik**: `REVIEW.md` z listą OK / NIE OK + dowód (output komendy). Jeśli coś jest NIE OK, główny agent poprawia i uruchamia reviewera ponownie.

## FAZY

0. `PLAN.md`: plan + checklista DEFINICJI UKOŃCZENIA. Sprawdź sekcję PRZED STARTEM. Uruchom subagenta research.
1. Szkielet rozszerzenia i manifest. Rozszerzenie ładuje się w Brave przez Playwright bez błędów.
2. Pipeline transkrypcji lokalnej na pliku z dysku (popup + offscreen). Pierwsza wersja działa na `krotka.ogg`.
3. Logowanie do WhatsAppa (QR od Michała) i zapis fixture z prawdziwego dymka.
4. Na tej podstawie: `mock-wa.html`, content script, przechwytywanie bloba. Test Playwright end-to-end na atrapie.
5. Test na testowym czacie: krótka, średnia, długa głosówka.
6. Długie nagrania, postęp, cache, obsługa błędów.
7. Tryb Groq, korekta/TL;DR, strona ustawień.
8. Subagent bench → dobierz ustawienia domyślne na podstawie liczb.
9. `README.md` po polsku + `TODO-MICHAL.md`.
10. Subagent reviewer → poprawki aż do pełnego OK.

## DEFINICJA UKOŃCZENIA (każdy punkt z dowodem)

1. Rozszerzenie ładuje się w Brave bez błędów w konsoli.
2. Test Playwright na `mock-wa.html` przechodzi ORAZ test na testowym czacie przechodzi:

   * przycisk pojawia się przy każdej głosówce;
   * transkrypcja krótkiej, średniej i długiej działa;
   * tekst jest przypisany do właściwego dymka;
   * zrzuty ekranu są w `docs/screenshots/`.
3. Dokładność na `krotka.ogg`:

   * tryb lokalny: WER < 18%;
   * tryb Groq (jeśli jest klucz): WER < 12%;
   * jeśli cel nie jest osiągnięty, `RESULTS.md` opisuje, co próbowano i dlaczego się nie da.
4. `dluga.ogg` (16 min) przechodzi w całości w trybie lokalnym, ostatnie zdania są w tekście, a czas jest zapisany w `RESULTS.md`.
5. Cache: druga transkrypcja tej samej wiadomości nie uruchamia modelu ani API.
6. Fallback z ręcznym wrzuceniem pliku działa.
7. `README.md` po polsku zawiera:

   * instalację w Brave krok po kroku;
   * pierwsze pobranie modelu;
   * tryb Groq;
   * co robić, gdy WhatsApp zmieni wygląd (gdzie jest `selectors.js`).
8. `REVIEW.md` od reviewera: wszystko OK.

## TRYB PRACY

* Nie kończ po pierwszej działającej wersji. Po każdej fazie wróć do checklisty w `PLAN.md` i odhacz punkty dowodami.
* Rzeczy wymagające człowieka (QR, nagrania, klucze) wpisuj do `TODO-MICHAL.md` z dokładną instrukcją: gdzie (Brave / PowerShell / telefon) i co kliknąć lub wpisać. Potem pracuj dalej nad resztą.
* Dbaj o kontekst: duże wyniki (logi, HTML) zapisuj do plików i czytaj fragmenty, a cięższe zadania zlecaj subagentom.
* Na koniec podsumowanie w 2 sekcjach: "Zrobione" i "Do zrobienia przez Michała".

