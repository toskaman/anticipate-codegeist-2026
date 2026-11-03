# Bridge HMAC activation and rotation (ORP-25)

Status: procedure prepared from the owner's [S4 scheme](https://github.com/toskaman/anticipate-codegeist-2026/issues/107#issuecomment-6615803734), 3 Nov 2026. **Not executed against the owner machine.** The bridge source is not in this repository. Muse/owner must complete the acceptance record below before claiming activation. This document changes no bridge behaviour, Forge configuration or Jira data.

Local verification (3 Nov 2026): all three PowerShell blocks parse; the signing helper matches RFC 4231 test case 2 and publishes the staged bytes in an isolated temporary inbox. This verifies the helper, not the live bridge, key lookup, ACL setup or rotation.

## Contract supplied by the owner

- For `inbox/<id>.json`, publish `inbox/<id>.json.sig`: exactly 64 lowercase hexadecimal characters containing HMAC-SHA256 of the exact JSON file bytes. Do not reserialize, trim or change encoding after signing. Write the signature without a BOM or newline; tolerance in the reader is unnecessary for this procedure.
- The HMAC key is the **UTF-8 bytes of the configured string**, including when that string looks like base64; do not base64-decode it before signing.
- Key lookup on each payload: `ANTICIPATE_BRIDGE_KEY`, then the first non-empty UTF-8 line of `bridge/.bridge-key`.
- With a key: missing, malformed or incorrect signatures execute nothing, return `exitCode: -1`, log rejection in `bridge.log` and archive the request and signature. With no key: unsigned requests are accepted in legacy mode with a warning.
- The owner reports isolated T1–T10 and end-to-end checks. They are external reports, not local evidence produced by this repository.
- No replay protection is provided. Always use fresh request IDs; archiving is not replay prevention.

## Before activation (Muse/owner)

Use PowerShell on the bridge machine, under the same Windows account as the bridge. Locate the actual emitter and an existing harmless **ping** request accepted by this bridge; its JSON schema was not supplied. Do not invent an action or use a request that changes Jira. Keep private key exchange outside GitHub and the repository.

```powershell
$bridgeRoot = 'E:\Codegeist2026\bridge'
if (-not (Test-Path -LiteralPath (Join-Path $bridgeRoot 'anticipate-bridge.ps1'))) {
    throw 'Bridge source missing at the expected owner-machine path.'
}
$keyPath = Join-Path $bridgeRoot '.bridge-key'
```

Read the actual S4 block and confirm the environment lookup scope. A User environment change does **not** automatically change the Process environment of an existing bridge window. The supplied scheme does not show whether the bridge explicitly reads User scope. Do not promise live environment rotation until the source and a running test confirm it.

This procedure uses the file fallback, which the owner says is reloaded per payload. Confirm that **no environment key takes precedence in the running bridge process**, and that no existing `.bridge-key` will be overwritten. If an environment key is already active, coordinate with its emitter first; retain the working configuration privately for rollback. Stop queued emitters during the initial switch and rotation to avoid rejecting requests signed with the previous key.

## Generate and store a file key

Run only after the checks above. The following uses a cryptographic random generator, prints no key, refuses to overwrite an existing key, and removes inherited access before writing the secret. Keep the resulting file outside the repository.

```powershell
if (Test-Path -LiteralPath $keyPath) { throw 'Existing key: use the rotation procedure.' }
$keyBytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($keyBytes) } finally { $rng.Dispose() }
$bridgeKey = [Convert]::ToBase64String($keyBytes)
$utf8NoBom = New-Object Text.UTF8Encoding($false)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$stream = [IO.File]::Open($keyPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
$stream.Dispose()
& icacls.exe $keyPath /inheritance:r /grant:r "${identity}:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Key ACL failed; empty file only, no secret written.' }
[IO.File]::WriteAllText($keyPath, $bridgeKey, $utf8NoBom)
```

Full control here is for the bridge's own account so it can rotate the key; inherited access is removed. Muse must inspect `icacls.exe $keyPath` and remove any pre-existing explicit grants if provisioning in a directory that adds them. This does not protect against administrators or compromise of that account.

Transfer `$bridgeKey` to the emitter using the existing private channel. Configure the emitter's process key without logging it. Do not paste it into a command saved in shell history, commit it, or attach it as evidence. Clear temporary key variables when setup is complete; the bridge and emitter still need their private configured copies.

## Sign and publish a harmless request

On the emitter, define this helper. The JSON must be staged **outside the watched inbox**. The companion signature is published first, the complete JSON last, so the bridge cannot observe an unsigned JSON during normal publication. Muse must confirm the watcher ignores standalone `.sig` files and that the final move is within the same filesystem. Never modify a published request.

```powershell
function Publish-BridgeSignedJson {
    param(
        [Parameter(Mandatory=$true)][string]$StagedJson,
        [Parameter(Mandatory=$true)][string]$Inbox,
        [Parameter(Mandatory=$true)][string]$RequestId,
        [Parameter(Mandatory=$true)][string]$Key
    )
    if ($RequestId -notmatch '^[A-Za-z0-9_-]+$') { throw 'Unsafe request ID.' }
    $jsonPath = Join-Path $Inbox ($RequestId + '.json')
    $sigPath = $jsonPath + '.sig'
    if ((Test-Path -LiteralPath $jsonPath) -or (Test-Path -LiteralPath $sigPath)) {
        throw 'Request ID already exists; choose a fresh ID.'
    }
    $data = [IO.File]::ReadAllBytes($StagedJson)
    $hmac = New-Object Security.Cryptography.HMACSHA256
    try {
        $hmac.Key = [Text.Encoding]::UTF8.GetBytes($Key)
        $signature = ([BitConverter]::ToString($hmac.ComputeHash($data)) -replace '-', '').ToLowerInvariant()
    } finally { $hmac.Dispose() }
    [IO.File]::WriteAllText($sigPath, $signature, (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $StagedJson -Destination $jsonPath -ErrorAction Stop
}
```

Call it with the emitter's existing valid staged ping, its actual inbox path, a fresh ID and the privately configured key. The helper does not invent the ping schema or transport path. If publication fails after the signature is created, resolve the orphan signature before retrying with a fresh ID. Do not retry a potentially executed request with the same ID.

## Acceptance on the running bridge

Keep the bridge process running and submit only harmless pings, each with a fresh ID. Record timestamps, IDs, exit codes and redacted log excerpts; never record keys or real signatures.

| Probe | Expected result |
| --- | --- |
| Correctly signed ping | Accepted, `exitCode: 0` |
| Same valid ping shape, no `.sig` | Rejected, `exitCode: -1`, REJECT log, no action executed |
| Ping with `.sig` containing `not-a-signature` | Rejected as malformed, `exitCode: -1`, no action executed |
| Ping signed using a different throwaway key | Rejected as invalid, `exitCode: -1`, no action executed |

Check the corresponding outbox records and archive, using paths confirmed from the source. A rejection alone is insufficient: the correctly signed control must succeed. If any unsigned request executes after activation, stop emitters and investigate the effective key lookup before proceeding.

The scheme names `[HMAC=ENFORCED]` and `[HMAC=LEGACY-NO-KEY]`, but also says the banner is computed at startup. **Do not rely on a live banner flip** after activation or rotation. Treat the signed control plus unsigned rejection as enforcement evidence. Muse must document the actual banner behaviour; restarting merely to refresh a banner does not prove restart-free rotation.

## Rotate the file key without restarting

1. Pause emitters and drain the inbox. Preserve the previous key privately for rollback, outside watched directories and version control.
2. Generate a new key with the cryptographic generator above. Store it in a temporary file in `$bridgeRoot`, with the same restricted ACL applied **before writing the secret**. Use a fresh path and `CreateNew`; do not overwrite the active key yet.
3. Stage the new key privately at the emitter. Confirm no environment variable shadows the file in the bridge process.
4. Replace the active file atomically on the same filesystem using `[IO.File]::Replace($newKeyPath, $keyPath, $null)`, where `$newKeyPath` is the fully qualified prepared file path. Check the resulting ACL. Retain the same bridge process/PID.
5. Switch the emitter to the new key. Submit a new-key signed ping (accept), old-key signed ping (reject), and unsigned ping (reject). Record the unchanged bridge PID and results. Resume emitters only after all three pass.

If this fails, keep emitters paused and restore the previous private key through the same staged replacement, then restore the emitter key and repeat the signed/unsigned control. Never infer rotation from the banner.

## Rollback and explicit legacy mode

Prefer restoring the previous working key and emitter together. Removing all keys disables enforcement and permits unsigned requests; use that fallback only as an intentional owner decision.

For an explicit legacy rollback, pause emitters, remove the file key with `Remove-Item -LiteralPath $keyPath`, and clear the effective environment key using the exact scope confirmed in S4. Both sources must be absent. A Process environment key in an existing window cannot be removed by changing User scope in another window; the owner may need to restart the bridge in a clean environment. Test a harmless unsigned ping and check the legacy warning before resuming. Do not describe this state as HMAC protected.

## Owner/Muse acceptance record (still required)

- S4 source revision/hash and actual environment lookup scopes:
- Valid harmless ping schema and emitter publication/watcher checks:
- Bridge machine/account and date (no secrets):
- Signed control, unsigned, malformed and invalid probe IDs/results:
- Rotation: unchanged PID, new-key accepted, old-key and unsigned rejected:
- Actual banner behaviour and redacted log/outbox evidence paths:
- ACL verified; rollback tested or explicitly deferred with reason:
- Final state: ENFORCED / LEGACY / not activated:

Until this record is completed by the machine owner, ORP-25 has a prepared runbook but **no verified live activation**.
