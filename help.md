# Music Looper Set List — Help

Music Looper Set List helps you build and play a YouTube-based set list from your saved songs.

## Quick Start

1. Paste a YouTube URL or video ID in the input field.
2. The player loads a paused preview.
3. Click **Add to Saved Songs**.
4. In **Saved Songs**, click **+** on songs you want in your set.
5. In **Set List**, click **Play Set List** to start sequential playback.

## Supported YouTube Input Formats

- `youtube.com/watch?v=VIDEOID`
- `youtu.be/VIDEOID`
- `youtube.com/shorts/VIDEOID`
- plain 11-character `VIDEOID`

If the input is invalid, you’ll see an inline validation message.

## Main Sections

### URL + Player Area

- **Add to Saved Songs**: saves the currently valid preview song.
- **Clear (×)** inside URL input: clears the field quickly.

### Song Search

- **Search YouTube** runs in-app and returns inline results.
- **Enter** or **Search** triggers a query.
- Press **Enter** again to add the first result (when results are present).
- Click anywhere on a result row to add that song to your set list.
- If a song is already saved, the row shows **Add again**.
- If a song is already in the set list, the row shows **Already in set list**.

### Saved Songs

- Shows your saved songs with thumbnail + title.
- Row actions:
  - **Click row**: load paused preview in player.
  - **+**: add song to Set List.
  - **×**: remove from Saved Songs.
- **Sort: A→Z / Z→A** toggle in header.

### Set List

- Ordered draft list used for playback.
- Row actions:
  - **Drag handle (≡)**: reorder (disabled while playback is active).
  - **Click row**:
    - idle: loads paused preview
    - active playback: jumps playback to that row
  - **×**: remove from set list
- Header shows:
  - item count
  - currently loaded set name (or `Draft (unsaved)`)

### Saved Set Lists (Modal)

- Open via **Saved Set Lists (N)** button.
- Load a saved set into the draft.
- Delete saved sets.
- **Sort: A→Z / Z→A** toggle in modal header.

## Playback Controls

### Play Set List / Stop Set List

- **Play Set List** starts sequential playback.
- Button toggles to **Stop Set List** while active.
- Clicking Stop ends playback and returns to idle.

### Pause (sec)

- Controls between-song countdown.
- Allowed values: `1` to `9`.
- Persisted locally.

### Auto-advance

- On song end, app waits `Pause (sec)` then starts next playable song.
- Missing/unplayable songs are skipped.

### Tap to continue

- If browser autoplay policy blocks transition, overlay appears.
- Click **Tap to continue** to resume.

## Save and Load Set Lists

### Save Set List

- Saves current draft with a name.
- If name already exists (case-insensitive), app asks before overwrite.

### Load Set List

- Replaces current draft with selected saved set.
- Clears current row selection.
- Does not auto-start playback.

## Data & Privacy

All data is local to your browser (LocalStorage):

- Saved songs
- Draft set list
- Saved set lists
- Pause seconds preference

No account is required.

## Troubleshooting

### Player says “Tap to continue”

- Expected when autoplay is blocked by browser policy.
- Click the overlay once to continue.

### Can’t drag set list rows

- Drag is disabled while set list playback is active.
- Click **Stop Set List** first.

### Video won’t embed

- Some YouTube videos block embedding.
- App will show: `This video cannot be embedded.`

### Corrupted local data warning

- If stored data is malformed, app resets that section safely and shows a warning message.

## Tips

- Keep song titles clean by using valid watch URLs.
- Use saved set lists to snapshot different performance sequences.
- Use sorting in Saved Songs and Saved Set Lists for faster selection.
