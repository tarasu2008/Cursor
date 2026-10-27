# PoliteType

PoliteType is an offline English keyboard for Android. It is a normal system keyboard, so it works in any app. Spelling, grammar, polite wording, and professional wording all run on the phone. The app does not use a server, an account, or a database, and it does not request internet access.

The keys follow the usual phone layout: QWERTY, a gray shift and delete, and `?123` for symbols. Hold a top-row letter for its number. There is no Polite or Pro switch. When a message is typed or pasted, improved versions of that text appear in the bar above the keys. Tap one to replace what you wrote. Space still corrects one obvious mistake, and the next backspace can undo that correction.

## Install

The installable file is `PoliteType.apk` (universal, all CPU types). Android 10 and newer can install it. Android 9 and older cannot.

If the app closes, open it again. The reason is shown on the setup screen and saved in `Android/data/com.politetype.ime/files/crash-log.txt`.

1. Copy the APK to the phone and open it. Allow installs from your file manager if Android asks.
2. Open the PoliteType app.
3. Tap **Enable PoliteType** and turn PoliteType on in Language and input settings.
4. Tap **Choose keyboard** and select PoliteType.
5. Type in the box on the setup screen, or in any other app.

The APK is signed with a debug key so it can be installed directly. It is not a Play Store signing key.

## Keys

- Suggestions sit above the keys. Hold Q through P for 1 through 0.
- `Aa` shifts the next letter. Tap it twice for caps lock, or hold it. Tap again to leave caps lock.
- `?123` opens symbols. **More** opens the second symbol page.
- `☺` opens emoji. These are characters in the keyboard, not an online GIF search.
- **Clip** shows the last few pieces of text copied on this phone. Hold **Next** to open PoliteType settings. **Next** switches to another keyboard.
- On phone and number fields the keyboard opens as a number pad. **ABC** returns to letters.
- Hold a letter for accents. Hold `.` for other punctuation.

## What the suggestions do

- Spelling fixes and word completions come from a word list shipped inside the app.
- Grammar fixes are narrow rules: articles, a few homophones, subject-verb agreement, repeated words, and missing apostrophes.
- **Polite** softens requests (`Send the file` can become `Could you please send the file?`).
- **Pro** expands contractions and some slang, and can add a period on a longer sentence.
- Password fields get no suggestions and no autocorrect. Email fields offer common domains.

This is not a cloud writing assistant. It will not rewrite a long, ambiguous paragraph the way Grammarly does. If a suggestion is wrong, keep typing or press backspace.

## Build

Use JDK 21 (bytecode target 17), Android SDK 35, and Gradle 8.9.

```bash
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew :engine:test :app:assembleRelease
```

The release APK is signed with the debug keystore and is written to `app/build/outputs/apk/release/`. `local.properties` and the APK are not part of the git history.
