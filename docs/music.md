# Music credits

Music: SRG774, Cleyton Kauffman, vitalezzz (CC0, OpenGameArt)

Proxima's music is public domain under the CC0 1.0 Universal dedication. The authors waived their copyright in the tracks, so the game can ship them. Credit is not required by the license. The pause menu and the start-menu Audio panel name them anyway.

| Track | Role | File | Author | Source |
| --- | --- | --- | --- | --- |
| Title | Start menu, looping | `public/music/title.ogg` | SRG774 | [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) |
| Sector | Exploration playlist | `public/music/sector.ogg` | SRG774 | [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) |
| Airy | Exploration playlist | `public/music/airy.ogg` | SRG774 | [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) |
| Urgent | Short tension sting after combat or a war declaration | `public/music/urgent.ogg` | SRG774 | [Dark Sci-Fi Audio Pack](https://opengameart.org/content/dark-sci-fi-audio-pack) |
| Exploration Theme | Exploration playlist | `public/music/exploration.ogg` | Cleyton Kauffman | [Exploration Theme](https://opengameart.org/content/exploration-theme) |
| Outworld | Intro, played once | `public/music/outworld.ogg` | vitalezzz | [Outworld](https://opengameart.org/content/outworld) |

Each OpenGameArt page lists the license as **CC0**. Files were downloaded from those pages on 1 October 2026. The pack's own page also offers `ogg.zip`, which contains Title, Sector, Airy, and Urgent. Exploration Theme's readme says: "Creative Commons Zero (CC0)". Outworld's page lists the license as CC0.

## License

Creative Commons Zero (CC0 1.0 Universal)

https://creativecommons.org/publicdomain/zero/1.0/

The person who associated a work with this deed has dedicated the work to the public domain by waiving all of their rights to the work worldwide under copyright law, including all related and neighboring rights, to the extent allowed by law.

You can copy, modify, distribute, and perform the work, even for commercial purposes, all without asking permission.

The full legal code is at https://creativecommons.org/publicdomain/zero/1.0/legalcode

## Encoded sizes

Vite copies `public/music` into `dist/music`. The Electron package includes that folder because `electron-builder` ships `dist/**/*`. The same license text is packed as `dist/music/LICENSE.txt`.

| File | Bytes | Bitrate |
| --- | ---: | ---: |
| title.ogg | 7930448 | 149 kbps (author's Ogg) |
| outworld.ogg | 3490256 | 151 kbps (re-encoded from the page MP3) |
| exploration.ogg | 2123503 | 126 kbps (re-encoded from the page Ogg) |
| airy.ogg | 1117106 | 140 kbps (author's Ogg) |
| urgent.ogg | 828217 | 116 kbps (author's Ogg) |
| sector.ogg | 817770 | 115 kbps (author's Ogg) |
| **Total** | **16307300** | **about 15.6 MiB** |

Sector, Airy, Urgent, and Title were already in the 115–149 kbps range, so those Oggs were kept as published. Exploration Theme (about 324 kbps) and Outworld (320 kbps MP3) were re-encoded with Vorbis so the installer stays modest.
