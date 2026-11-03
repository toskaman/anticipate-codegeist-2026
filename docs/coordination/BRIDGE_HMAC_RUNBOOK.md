# Bridge HMAC activation runbook (owner machine)

**Scope.** This runbook turns on request signing for the local bridge (`E:\Codegeist2026\bridge\anticipate-bridge.ps1`), which runs allowlisted actions dropped into `inbox\`. It changes no bridge code.

**Source.** The scheme was posted by muse on #107 from the live script (S4 block, test harness T1–T10 and an isolated end-to-end run). The script itself is not in this repository. Every command below follows that description. Two places where a detail could not be confirmed from here are marked **Check**.

**Never** put the key in the repository, an issue, a PR, a log line or a chat.

## How signing works

- For every `inbox\<id>.json`, the emitter also writes `inbox\<id>.json.sig`.
- The `.sig` contains the **lowercase hex HMAC-SHA256** of the **exact raw bytes** of the `.json` file: **64 hex characters**, nothing else. A trailing newline or a UTF-8 BOM in the `.sig` is tolerated on read. Anything else is rejected as malformed.
- The HMAC key is the UTF-8 bytes of the key string, exactly as the emitter snippet below does it.
- **Where the bridge looks for the key**, re-read for every payload:
  1. environment variable `ANTICIPATE_BRIDGE_KEY` (preferred, never on disk);
  2. otherwise the file `bridge\.bridge-key`, using its first non-empty line, read as UTF-8.

| Bridge state | Banner | Unsigned or invalid request |
| --- | --- | --- |
| No key (legacy, the current live state) | `[HMAC=LEGACY-NO-KEY]` | Accepted, with a `WARN` line for each acceptance |
| Key configured | `[HMAC=ENFORCED]` | **Rejected**, nothing runs: a `REJECT` line in `bridge\bridge.log` and on the console, outbox result `exitCode -1`, and the `.json` and `.sig` moved to the archive |

## 1. Generate a key

In PowerShell on the bridge machine:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)
```

This uses the cryptographic random generator and works in Windows PowerShell 5.1 and in PowerShell 7. The one-liner in #107 uses `Get-Random`, which is **not** a cryptographic generator, so please prefer the version above. The bridge accepts either, because it only reads the key string.

## 2. Store the key (choose one)

**A. User environment variable (preferred)**

```powershell
[Environment]::SetEnvironmentVariable('ANTICIPATE_BRIDGE_KEY', $key, 'User')
```

**Check:** a bridge window that is already running only sees this new variable if the script reads the **User** scope on each payload, as in `[Environment]::GetEnvironmentVariable(..., 'User')`. If it reads `$env:ANTICIPATE_BRIDGE_KEY`, it only sees the value from when it started. Step 4 tells you which case applies: if the banner stays `LEGACY-NO-KEY` and unsigned requests are still accepted, either close and reopen the bridge window once, or use option B, which is re-read on every payload.

**B. Key file**

```powershell
Set-Location E:\Codegeist2026
[IO.File]::WriteAllText("$PWD\bridge\.bridge-key", $key, (New-Object Text.UTF8Encoding($false)))
icacls bridge\.bridge-key /inheritance:r /grant:r "${env:USERNAME}:(R)"
```

Use the braces `${env:USERNAME}`. Without them, PowerShell can read `$env:USERNAME:` as part of the variable name. After this command, only your account can read the file and nobody can write it. Make sure `.bridge-key` is git-ignored and never committed.

## 3. Give the key to the emitter

Send the key to the external emitter (the agent that drops files into `inbox\`) over your existing **private** channel. The emitter signs each request **after** the `.json` is fully written, then writes the `.sig`:

```powershell
$key  = [Text.Encoding]::UTF8.GetBytes($env:ANTICIPATE_BRIDGE_KEY)
$data = [IO.File]::ReadAllBytes('inbox\<id>.json')
$hmac = New-Object Security.Cryptography.HMACSHA256; $hmac.Key = $key
$hex  = (([BitConverter]::ToString($hmac.ComputeHash($data)) -replace '-','').ToLowerInvariant())
[IO.File]::WriteAllText('inbox\<id>.json.sig', $hex, (New-Object Text.UTF8Encoding($false)))
```

Any language works if it computes HMAC-SHA256 over the raw file bytes and writes 64 lowercase hex characters.

## 4. Verify enforcement

1. Look at the bridge window. The banner should read `[HMAC=ENFORCED]`.
   - The banner is computed at startup, so after a live key change it can still show the old state.
   - What counts is the behaviour in the next two checks. Restart the window if you want the banner to be accurate.
2. **Signed request.** Drop a read-only request your emitter already uses (for example its usual ping) as `inbox\<id>.json`, and sign it with step 3. **Expected:** it runs, and the outbox result has `exitCode 0`.
3. **Unsigned request.** Drop the same request under a new id, **without** a `.sig`. **Expected:** it does not run, the outbox result has `exitCode -1`, and `bridge\bridge.log` has a `REJECT` line.
4. **Optional, wrong signature.** Write a `.sig` of 64 zeros. **Expected:** rejected like the unsigned request.

If check 3 is accepted (with a `WARN` instead of a `REJECT`), the bridge does not see the key. Go back to the **Check** note in step 2.

## 5. Rotate the key (no restart)

1. Generate a new key (step 1).
2. Replace it in the store you use:
   - **Environment variable:** run the `SetEnvironmentVariable` line again with the new value.
   - **File:** grant yourself write access temporarily, rewrite the file, then remove write access again:

     ```powershell
     icacls bridge\.bridge-key /grant:r "${env:USERNAME}:(M)"
     [IO.File]::WriteAllText("$PWD\bridge\.bridge-key", $key, (New-Object Text.UTF8Encoding($false)))
     icacls bridge\.bridge-key /grant:r "${env:USERNAME}:(R)"
     ```
3. Give the new key to the emitter. Requests signed with the old key are rejected from the next payload on, so switch the emitter at the same time.
4. Run the checks in step 4 again.

## 6. Roll back to legacy mode

```powershell
[Environment]::SetEnvironmentVariable('ANTICIPATE_BRIDGE_KEY', $null, 'User')
Remove-Item E:\Codegeist2026\bridge\.bridge-key -ErrorAction SilentlyContinue
```

You may need to grant yourself write access first (see step 5) before `Remove-Item` can delete the file.

Unsigned requests are then accepted again, each with a `WARN` line, and the flow keeps working. The same **Check** about running windows applies: restart the bridge window if it still enforces.

## Known limits

- **No replay protection.** A captured signed `.json` and `.sig` pair would be accepted again. Processed files move to `archive\`. Keep request ids unique, and keep `inbox\` writable only by the emitter's account.
- **The banner is computed at startup.** It can show a stale state after a rotation or rollback until the window restarts. The actual behaviour follows the key on every payload.
- **`.sig` tolerance.** A trailing newline or UTF-8 BOM is accepted. Anything that is not exactly 64 hex characters is rejected as malformed.
