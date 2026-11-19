# Speaking Practice (EDUC 152N AI module)

A free practice app for a learner who wants to speak with a strong voice. ChatGPT helps them write a script. The app helps them say it.
It never shows a transcript and never interrupts them.

This is the lo-fi build for testing. Branding and visual design come later.

## Run it on your laptop

```bash
npm install
npm run dev
```

Open <http://localhost:5173> in **Chrome**. The microphone works on `localhost` and on `https://` addresses only.

Other commands:

```bash
npm test          # unit tests (Q&A paste parsing, Done messages, audio math, WAV file)
npm run build     # type-check and build into dist/
npm run preview   # serve the built app from dist/
```

## Why there is no backend

Everything runs in the browser:

| Part | Where it runs |
|---|---|
| Volume measurement | Web Audio API on the laptop |
| Recording of the last try | MediaRecorder; saved in IndexedDB in the browser |
| Scripts, settings, take log | localStorage in the browser |
| Writing scripts | A link to ChatGPT with the prompt filled in (`?q=`) |
| AI feedback (optional) | A link to Gemini; the app saves the try as a WAV file and copies the prompt |

A static host is enough, so GitHub Pages works. There are no accounts, no API keys and no cost.

**The trade-off:** the data lives in one browser on one laptop.

- The data belongs to the address. Data on `localhost` is not the same as data on the GitHub Pages address.
- If someone clears the browser data, the scripts and the take log are gone. Use **Export CSV** in the coach settings after each test session.
- There is no sync between devices.

## Put it on GitHub Pages

GitHub Pages serves static files from a repository over HTTPS. A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the app and publishes it each time you push to `main`.

1. Create a new GitHub repository (for example `practice-app`) and push this folder to it.
2. In the repository, open **Settings → Pages**. Under **Build and deployment → Source**, pick **GitHub Actions**.
3. Push to `main`. The **Actions** tab shows the build. When it finishes, the app is at `https://<your-username>.github.io/<repo-name>/`.

`vite.config.ts` uses `base: "./"`, so the build works with any repository name. The app uses `#/` routes, so GitHub Pages needs no extra server setup.

**Note:** a public repository makes the code public. The code has no personal data. The learner's name, scripts and recordings are saved only in their browser, never in the repository.

## Set up the learner's laptop (once)

1. Open the app in Chrome. Tap the gear icon (top-right on Home) to open the coach settings.
2. Type the learner's name for the Home greeting.
3. **Set the target:**
   - Put the laptop where the learner usually practices.
   - In macOS **System Settings → Sound → Input**, set the input volume to one level and do not change it later.
   - Stand at the back of a room while the learner speaks from the front. When you hear them clearly, tap **Set target** and let them speak for 5 seconds.
   - Chrome asks for the microphone the first time. Allow it.
   - Use **Easier** or **Harder** to adjust the target in steps of 2 dB.
4. In ChatGPT, turn off **Settings → Data controls → Improve the model for everyone** on the learner's account.

## Coach settings for testing

| Setting | Options |
|---|---|
| Live volume | Meter / Calm (default) / Off |
| Feeling check | Off / After each try (default) / Before and after the session |
| AI feedback | Off (default) / Gemini link |

Each try saves its settings in the take log, so you can compare them later. Change the order of the settings across sessions, because the learner learns the script as they practice.

## How the volume works

- The app reads the microphone about 20 times a second and calculates the loudness (RMS, in dBFS).
- Chrome's auto gain control is off. When it is on, it makes quiet speech louder and loud speech quieter, so the volume would look flat.
- A frame more than 22 dB below the target counts as a pause. Pauses are ignored, so they never count against the learner.
- The live display is empty at 20 dB below the target and full at the target.
- The take log saves each try's average level and its difference from the target.
- A laptop microphone does not measure true loudness. Its reading depends on the microphone, the input level and the distance. So set the target on each laptop.

## Where to change things

| What | File |
|---|---|
| ChatGPT and Gemini prompts (write them with the learner) | `src/lib/prompts.ts` |
| Done messages | `src/lib/progress.ts` |
| Pause gate and display range | `src/lib/audio.ts` (`GATE_DB`, `RANGE_DB`) |
| Q&A paste formats | `src/lib/qa.ts` |
| Lo-fi styles | `src/styles.css` |

## Known limits

- The ChatGPT `?q=` link and the Gemini `?prompt=` link are unofficial and can stop working. If the Gemini link does not fill in the prompt, the learner pastes it, because the app has already copied it.
- **Paste from ChatGPT** reads the clipboard. Chrome asks for permission the first time. If the learner says no, they can click in the box and press Cmd+V.
- The app is built for Chrome on a laptop. Safari records in a different format; the app handles it, but it is not tested there.
