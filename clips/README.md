Four clips re-rendered on Vertex AI (Veo 3.1) on 2026-11-03 from prompt
pack v3, after Brian rejected the v2 winners. Two takes per shot; the best
passing take per shot was selected after a frame check. Each clip is
8 seconds, 1920x1080, with AAC audio.

## Shots

- clip-0.mp4: hero cabinet, golden hour solar node in open grassland (take 1)
- clip-1.mp4: lab workstation, developer in a small independent AI studio (take 2)
- clip-2.mp4: yard unit, camera pole node overlooking a logistics yard (take 1)
- clip-3.mp4: data center, aerial solar field then a server hall with one engineer (v6 take 3, replaced 2026-11-04; see Provenance v6 below, superseding v5)

## Provenance (v3)

Prompt pack v3, rendered as ingredients from the approved hardware renders
(hw-cabinet, hw-workstation, hw-yard, hw-family), same Vertex Veo 3.1
predictLongRunning pattern as v2. The v3 re-render was ordered because the
v2 winners carried a ghost mark fault. Frame check for v3:

- Ghost mark check: exactly one etched C mark per piece of equipment in
  every winner. No second, duplicate, faint, ghost, or watermark mark.
- Rejected in v3: clip 0 take 2 (a second small green diamond detached
  from the mark on the cabinet door, visible at full resolution); clip 1
  take 1 (the developer's face visible in side profile, against the
  behind/over-shoulder-only rule).
- Clip 1 take 2 was selected because the developer is filmed only from
  behind, with no face visible at any sampled frame.
- Clip 3 take 1 was selected over take 2: the engineer walking the server
  aisle reads as a woman in both, but take 1 has the cleaner aerial (no
  light-grey ancillary building).
- Clip 2 take 1 was selected over take 2 (both pass; take 1 holds the unit
  larger in the opening frames). Distant dock-door numbers and truck
  trailers in the yard background are not on the equipment and are not
  mark violations; the no-text rule governs the equipment itself.

## Mark-only rules (these govern the v3 clips)

- Enclosures are very dark forest-green anodised aluminium, matte bead-blasted
  finish, softly chamfered edges, graphite accents, dark recessed vents.
- The only branding is a small C-shaped mark laser-etched into the metal in
  the same dark green, slightly satin against the matte surface, with a tiny
  diamond beside it that glows soft leaf green as a status light.
- No plates, no labels, no stickers, no tiles, no white or cream enclosures,
  no text of any kind on the equipment.
- Frame check: any take showing text, letters, a logo plate/tile/sticker, a
  white/cream enclosure, or a second/ghost mark on the equipment was
  rejected.
- Brian's standing rule for the edit: it carries no such label text anywhere.


## Provenance (v5, clip 3 only, 2026-11-04)

Brian rejected the v3 clip 3: the logo was off. The v4 re-render (four takes)
was judged against a wrong geometry spec and produced no passing take.
Brian then supplied the actual logo file, and the true geometry was measured
from it: the diamond is vertically centred on the C, its left tip tucked just
inside the C's opening without touching the ring, about one third the height
of the C, muted leaf green. Clip 3 was re-rendered with that geometry in
words plus two reference images: the logo file itself and a panel reference
built from it (true mark etched tone on tone on dark green metal).

Frame check for v5 (full-resolution frames, seconds 5 to 7.5):
- Take 1 PASSES: exactly one mark on the rack end panel; the C is etched
  tone on tone in the panel's own dark green, matte and flush; the diamond
  is vertically centred on the C with its left tip just inside its opening,
  not touching the ring, about one third the C's height, muted leaf green;
  the engineer is a woman with a ponytail in a hi-vis vest.
- Take 4 rejected (black/dark-grey C). Take 3 failed to submit. No takes 5/6
  were needed. The other three clips are unchanged from v3.


## Provenance (v6, clip 3 only, 2026-11-04)

Brian rejected the v5 clip 3: it was perfect except the woman walks in
reverse, back to the camera but moving toward it, growing in frame. Clip 3
was re-rendered (v6, four takes) with the walking direction spelled out in
words and in the negative prompt (forward away from the camera, figure
growing smaller as she recedes; walking backwards, moonwalking, gliding
and approaching the camera all excluded).

Frame check for v6 (full-resolution frames, seconds 5 to 7.5 for the mark;
motion sampled every ~0.6s across the server-hall section, woman's height
in frame measured per frame):
- Take 3 PASSES BOTH and is the winner: exactly one mark on the rack end
  panel at 5.4, 6.0, 6.6 and 7.2s; the C is etched tone on tone in the
  panel's own dark green, matte and flush; the diamond is vertically
  centred on the C with its left tip just inside its opening, not touching
  the ring, about one third the C's height, muted leaf green; no text or
  plates. Motion: her height falls monotonically, about 655 at 4.8s to
  522 at 6.0s to 427 at 7.2s (0-1000 frame scale), clearly striding
  forward away from the camera, never growing, gliding or moonwalking.
- Take 1 rejected (black C, against the tone-on-tone rule) despite
  passing motion. Take 2 rejected (light-grey C, not tone on tone in the
  panel's dark green) despite passing motion. Take 4 passes both checks
  but take 3 was chosen: its end-panel mark framing is cleaner and its
  diamond more muted, and the woman reads more clearly in the end-panel
  background. No takes 5/6 were needed. The other three clips are
  unchanged from v3, and the v5 note above is superseded for clip 3.

## Audio fix (2026-11-04, clip 3)

The v6 picture is unchanged. The original Veo audio carried hallucinated
gibberish speech over the opening aerial (about the first 2.7 seconds),
despite the prompt's no-voice line; the hall section was clean wind and hum.
The speech segment was removed in post and the whole clip now carries a
clean ambience bed matched to the original levels: wind over the aerial,
crossfading at the picture cut (2.7s) to airflow and a low server hum in
the hall. Verified by spectrogram: no speech content anywhere in the clip.
