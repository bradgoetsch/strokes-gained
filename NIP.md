# Golf Round Strokes Gained (Kind 32823)

## Overview

Kind `32823` is an **addressable event** representing a golf round with full shot-by-shot strokes gained statistics.

## Event Format

```json
{
  "kind": 32823,
  "content": "",
  "tags": [
    ["d", "<round-uuid>"],
    ["alt", "Golf round: <course name> on <date>"],
    ["title", "<Course Name>"],
    ["date", "<YYYY-MM-DD>"],
    ["par", "<total par>"],
    ["strokes", "<total strokes>"],
    ["sg_total", "<total strokes gained>"],
    ["sg_ott", "<strokes gained off the tee>"],
    ["sg_app", "<strokes gained approach>"],
    ["sg_arg", "<strokes gained around green>"],
    ["sg_putt", "<strokes gained putting>"],
    ["holes", "<JSON-encoded array of hole data>"],
    ["t", "golf"],
    ["t", "strokes-gained"]
  ]
}
```

## Tag Definitions

| Tag | Description |
|-----|-------------|
| `d` | Unique round identifier (UUID) |
| `alt` | Human-readable description (NIP-31) |
| `title` | Course name |
| `date` | Round date in YYYY-MM-DD format |
| `par` | Total par for the round |
| `strokes` | Total strokes taken |
| `sg_total` | Total strokes gained vs. PGA Tour average |
| `sg_ott` | Strokes gained: Off the Tee |
| `sg_app` | Strokes gained: Approach |
| `sg_arg` | Strokes gained: Around the Green |
| `sg_putt` | Strokes gained: Putting |
| `holes` | JSON-encoded array of `HoleData` objects |
| `t` | Category tags: `golf`, `strokes-gained` |

## Hole Data Schema

```typescript
interface HoleData {
  number: number;         // Hole number (1-18)
  par: number;            // Hole par (3, 4, or 5)
  shots: ShotData[];      // Array of shots
}

interface ShotData {
  id: string;                          // Unique shot identifier
  distanceToHole: number;              // Yards (or feet on green)
  surface: ShotSurface;                // "tee" | "fairway" | "rough" | "sand" | "recovery" | "green"
  holed: boolean;                      // Whether shot was holed out
  distanceAfter?: number;              // Distance to hole after shot
  surfaceAfter?: ShotSurface;          // Surface after shot
  strokesGained?: number;              // Calculated SG value
  category?: "ott" | "approach" | "arg" | "putting";  // SG category
}
```

## Strokes Gained Methodology

Strokes Gained is calculated using PGA Tour baseline data (derived from Mark Broadie's research):

```
SG = Baseline(start) - Baseline(end) - 1
```

Where `Baseline(position)` is the average number of strokes a PGA Tour player would take to hole out from that position.

A positive SG value means the player gained strokes relative to the PGA Tour average; negative means they lost strokes.

## Example

```json
{
  "kind": 32823,
  "content": "",
  "tags": [
    ["d", "a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
    ["alt", "Golf round: Pebble Beach on 2026-03-05"],
    ["title", "Pebble Beach"],
    ["date", "2026-03-05"],
    ["par", "72"],
    ["strokes", "78"],
    ["sg_total", "-1.24"],
    ["sg_ott", "+0.45"],
    ["sg_app", "-0.80"],
    ["sg_arg", "+0.11"],
    ["sg_putt", "-1.00"],
    ["holes", "[{...}]"],
    ["t", "golf"],
    ["t", "strokes-gained"]
  ]
}
```
