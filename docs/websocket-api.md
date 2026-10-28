# Dyno Music WebSocket API

Dyno Music can be followed and controlled by other programs on your computer through a local WebSocket: a Stream Deck plugin, an OBS overlay, a Discord or Twitch bot, a macro pad, a second-screen widget.

A connected program **receives** what's playing (song, artwork, play/pause, progress, volume, like, queue) the moment it changes, and **sends** commands (play, pause, next, volume, like, seek, queue…). There is no polling and nothing on a timer: you get everything when you connect, then a message only when something changes.

- [Turning it on](#turning-it-on)
- [Quick start](#quick-start)
- [Connecting](#connecting)
- [Messages from Dyno Music](#messages-from-dyno-music)
- [Messages to Dyno Music](#messages-to-dyno-music)
- [Commands](#commands)
- [Working out the progress](#working-out-the-progress)
- [Security](#security)
- [Errors and troubleshooting](#errors-and-troubleshooting)

## Turning it on

1. Open **Settings → Developers** in Dyno Music.
2. Turn on **Allow other apps to control Dyno Music**.
3. Copy the **address** (it already contains the token), or the token alone.

The status line shows whether it's running and how many apps are connected. The port is `26538` unless you change it there. **Regenerate token** makes a new one and disconnects every app using the old one.

The API is off by default; while it's off, nothing listens.

## Quick start

Paste the address from Settings, run this with Node.js 22 or later (or in a page opened from a local file), then skip a song in Dyno Music:

```js
const ws = new WebSocket("ws://127.0.0.1:26538/ws?token=PASTE_YOUR_TOKEN");

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === "state" && message.state.track) {
    const { title, artists } = message.state.track;
    console.log(`${message.state.status}: ${title} — ${artists.map((a) => a.name).join(", ")}`);
  }
};

// Skip to the next song three seconds after connecting.
ws.onopen = () => setTimeout(() => ws.send(JSON.stringify({ type: "command", command: { type: "next" } })), 3000);
```

## Connecting

```
ws://127.0.0.1:26538/ws?token=<token>
```

Only connections from this computer are accepted (`127.0.0.1`). A missing or wrong token is refused with HTTP `401`.

As soon as you connect, Dyno Music sends, in this order:

1. [`hello`](#hello)
2. [`state`](#state): what's playing right now
3. [`queue`](#queue)
4. [`artwork`](#artwork): straight away if it's ready, otherwise as soon as it is

So a client can draw itself without asking anything.

## Messages from Dyno Music

Every message is a JSON object with a `type`.

### `hello`

Sent once, first.

```json
{ "type": "hello", "app": "Dyno Music", "version": "0.4.3", "protocol": 1 }
```

`protocol` goes up only when a message changes in a way existing clients can't follow. New fields can appear in any message without it changing, so ignore fields you don't know.

### `state`

Sent when you connect, then **every time something changes**: the song, play/pause/buffering, a seek, volume, mute, like, repeat, shuffle, an ad starting or ending. The position moving on by itself is **not** a change (see [Working out the progress](#working-out-the-progress)).

```json
{
  "type": "state",
  "state": {
    "status": "playing",
    "isAd": false,
    "track": {
      "videoId": "Mx92cVYZ3bQ",
      "title": "X ESO BB",
      "artists": [{ "name": "Jere Klein & NICKI NICOLE" }],
      "album": "X ESO BB",
      "thumbnail": "https://lh3.googleusercontent.com/…=w544-h544-l90-rj",
      "durationSec": 194
    },
    "positionSec": 12.3,
    "positionAt": 1793160000123,
    "volume": 40,
    "muted": false,
    "likeStatus": "LIKE",
    "repeat": "NONE",
    "shuffle": false
  }
}
```

| Field | Meaning |
|---|---|
| `status` | `"playing"`, `"paused"`, `"buffering"`, `"ended"` or `"idle"` (nothing loaded) |
| `isAd` | An ad is playing; `track` then describes the song that comes after it |
| `track` | The song, or `null` when nothing is loaded. `album` may be missing. `thumbnail` is the full-size artwork URL |
| `positionSec` | Position in the song, in seconds, at the moment `positionAt` |
| `positionAt` | When `positionSec` was measured, in Unix milliseconds |
| `volume` | 0–100 |
| `muted` | Whether the sound is muted (the volume is kept) |
| `likeStatus` | `"LIKE"`, `"DISLIKE"` or `"INDIFFERENT"` |
| `repeat` | `"NONE"`, `"ALL"` or `"ONE"` |
| `shuffle` | Whether shuffle is on |

### `queue`

Sent when you connect and every time the queue changes.

```json
{
  "type": "queue",
  "queue": [
    {
      "index": 0,
      "videoId": "Mx92cVYZ3bQ",
      "title": "X ESO BB",
      "artists": "Jere Klein & NICKI NICOLE",
      "thumbnail": "https://…",
      "duration": "3:14",
      "selected": true
    }
  ]
}
```

`selected` marks the song playing now. `index` is what the queue commands take.

### `artwork`

The current song's artwork, already downloaded and small (about 144 × 144 px), as a data URL. Sent when you connect (if it's ready) and once per song after that.

```json
{ "type": "artwork", "videoId": "Mx92cVYZ3bQ", "image": "data:image/jpeg;base64,/9j/4AAQ…" }
```

It can go straight into an `<img src>`, or into a Stream Deck key with `setImage`. Check `videoId` against `state.track.videoId`: when songs change quickly, an artwork can arrive just after the next state.

### `result`

The answer to each message you send. `id` is the one you sent (or `null`).

```json
{ "type": "result", "id": 2, "ok": true }
{ "type": "result", "id": 3, "ok": false, "error": "not a valid command: unknown variant `foo`" }
```

`ok: true` means Dyno Music passed the command to the player. The effect shows up as a `state` (or `queue`) message.

## Messages to Dyno Music

Send JSON text messages. `id` is optional: any number or string, echoed in the `result`.

### `get`

Asks for everything again: `state`, `queue` and `artwork` (if ready), then a `result`. Handy when your client redraws, for instance when a Stream Deck page comes back into view.

```json
{ "id": 1, "type": "get" }
```

### `command`

```json
{ "id": 2, "type": "command", "command": { "type": "toggle" } }
```

The [commands](#commands) are below.

## Commands

| Command | Fields | What it does |
|---|---|---|
| `play` | | Plays |
| `pause` | | Pauses |
| `toggle` | | Plays or pauses |
| `next` | | Next song |
| `previous` | | Previous song (or back to the start, like YouTube Music's button) |
| `seek` | `positionSec` (number) | Goes to that second of the song |
| `volume` | `value` (0–100) | Sets the volume (and unmutes) |
| `mute` | `muted` (boolean) | Mutes or unmutes |
| `like` | `status`: `"LIKE"`, `"DISLIKE"` or `"INDIFFERENT"` | Rates the current song; `"INDIFFERENT"` removes the rating. Needs a signed-in account |
| `repeat` | | Cycles repeat: none → all → one |
| `shuffle` | | Shuffles the queue |
| `queuePlay` | `index` | Plays that song of the queue |
| `queueMove` | `from`, `to` | Moves a song within the queue |
| `queueRemove` | `index` | Removes a song from the queue |
| `queueAdd` | `videoId` or `playlistId`, `next` (boolean) | Adds a song, album or playlist after the current song (`next: true`) or at the end |
| `watch` | `videoId` and/or `playlistId` | Plays a song, a song within a list, or a whole album or playlist |

Examples:

```json
{ "type": "command", "command": { "type": "seek", "positionSec": 60 } }
{ "type": "command", "command": { "type": "volume", "value": 25 } }
{ "type": "command", "command": { "type": "like", "status": "LIKE" } }
{ "type": "command", "command": { "type": "queueAdd", "videoId": "Mx92cVYZ3bQ", "next": true } }
{ "type": "command", "command": { "type": "watch", "playlistId": "OLAK5uy_…" } }
```

IDs are YouTube Music's: a song's `videoId` is the `v=` of `music.youtube.com/watch?v=…`, a playlist's or album's `playlistId` the `list=`.

## Working out the progress

To save messages, the position isn't sent as it moves on. Each `state` carries the position and the moment it was measured, and your client counts on from there:

```js
function currentPosition(state) {
  const elapsed = state.status === "playing" ? (Date.now() - state.positionAt) / 1000 : 0;
  return Math.min(state.positionSec + elapsed, state.track?.durationSec ?? Infinity);
}

// Redraw a progress bar once a second.
setInterval(() => drawProgress(currentPosition(latestState)), 1000);
```

A pause, a seek or a new song sends a new `state`, which corrects the count. Dyno Music's own interface works the same way.

## Security

- **Off by default**, and only listening on `127.0.0.1`: nothing outside this computer can connect.
- **Token**: every connection needs it. It's 128 random bits; keep it to yourself like a password. **Regenerate token** in Settings disconnects every app using the old one.
- **Websites can't connect.** A connection from a website (one with an `Origin` header) is refused with `403`. Programs that aren't browsers (Node.js, Python, a Stream Deck plugin) send no `Origin` and are accepted, as are local pages: one opened from a file (an OBS browser source pointing at a local HTML file) or served from `localhost`.

## Errors and troubleshooting

| What happens | Why |
|---|---|
| The connection is refused | The API is off, or the port is wrong. Check **Settings → Developers** |
| HTTP `401` | Missing or wrong token. Copy the address again from Settings |
| HTTP `403` | The connection came from a website. Run your code outside the browser, or from a local file or `localhost` |
| You get disconnected | The token was regenerated, the port changed, the API was turned off, or Dyno Music closed. Reconnect with the new address |
| The status line in Settings shows an error | Another program uses that port. Pick another one there |
| `ok: false` on a command | The message says why: an unknown command, a missing field, or the player isn't ready yet |
