# hydro

This is an experiment that tries to implement a minimal [hydra](https://github.com/hydra-synth/hydra-synth) in a single self-contained HTML file. The GLSL compiler is implemented with a stripped down version of [@kabelsalat/core](https://github.com/felixroos/kabelsalat/tree/main/packages/core).

live at [felixroos.github.io/hydro](https://felixroos.github.io/hydro/)

## Why?

I did this mainly to learn more about how WebGL works, as a continuation of [schattenspiel](https://github.com/felixroos/schattenspiel).
The hydra DSL seemed to be a good fit to implement with my graph compiler [@kabelsalat/core](https://github.com/felixroos/kabelsalat/tree/main/packages/core).
Also, it seemed like a nice challenge to try to do this in a single HTML file, which is very sharable and readable / editable.

## Examples

- To load a random example, open the browser console and enter `shuffle()`
- To load a specific example, open the browser console and enter `example(index)`

You can also load some of my own examples:

- [dragon tails](https://felixroos.github.io/hydro/#c2hhcGUoMiwgKCkgPT4gTWF0aC5zaW4odGltZSkvNCsuMjUsIC41KQoucmVwZWF0KDEsNSkKLmNvbG9yKC42LDAsLjgpCi5tb2R1bGF0ZShub2lzZSgyLC4zKSwuMDUpCi8vLm1vZHVsYXRlUm90YXRlKG5vaXNlKDEwLC4zKSwuMikKLnJvdGF0ZSgxLjUsMC4xKQouY29sb3JhbWEoKQouZGlmZihvMCkKLmNvbG9yYW1hKCkKLmJyaWdodG5lc3MoLjQpCi5odWUoKCkgPT4gTWF0aC5zaW4odGltZS84KSkKLmJsZW5kKG8wLC40KQoucG9zdGVyaXplKDQpCi5tb2R1bGF0ZShvc2MoKSwuMDAwNSkKLm91dChvMCk=)
- [moving mandala](https://felixroos.github.io/hydro/#bGV0JTIwc2luJTIwJTNEJTIwKGYlM0QxKSUyMCUzRCUzRSUyMChNYXRoLnNpbih0aW1lKjIqTWF0aC5QSSpmKSUyQjEpJTJGMiUzQiUwQWxldCUyMGxlcnAlMjAlM0QlMjAodW5pJTJDJTIwbWluJTJDJTIwbWF4KSUyMCUzRCUzRSUyMHVuaSoobWF4LW1pbiklMkJtaW4lM0IlMEFvc2MoNDAlMkMuMDElMkMuNSklMEEuaHVlKCgpJTIwJTNEJTNFJTIwc2luKDElMkYxNikpJTBBLnBvc3Rlcml6ZSgzKSUwQS5tb2R1bGF0ZShub2lzZSg0KSklMEEua2FsZWlkKDQpJTBBLmNvbG9yYW1hKC4wMSklMEElMkYlMkYubW9kdWxhdGUob3NjKDMlMkMuNCklMkMuMiklMEEuc2F0dXJhdGUoLjUpJTBBJTJGJTJGLnNjYWxlKCgpJTIwJTNEJTNFJTIwbGVycChzaW4oLjEpJTJDLjUlMkM4KSklMEEuc2Nyb2xsKCgpJTIwJTNEJTNFJTIwc2luKDElMkYzMiklMkMlMjAoKSUyMCUzRCUzRSUyMHNpbigxJTJGMzIpKSUwQS5yb3RhdGUoMCUyQy4wMSklMEEub3V0KCk=)
- [nyan worm](https://felixroos.github.io/hydro/#c2hhcGUoNDAsLjEsLjIpCi5yZXBlYXQoNCwgNCkKLm1vZHVsYXRlKG5vaXNlKDIsLjUpLC4wOCkKLnJvdGF0ZSgwLC4xKQouZGlmZihzcmMobzApLC45OSkKLmNvbG9yYW1hKCkKLmJsZW5kKHNyYyhvMCksLjQpCi5waXhlbGF0ZSgyNTYsMjU2KQoub3V0KG8wKTs=)
- [jelly fountain](https://felixroos.github.io/hydro/#c3JjKG8wKS5ibGVuZChzcmMobzApKQoubW9kdWxhdGUobm9pc2UoOCksMC4wMDUpCi5ibGVuZChzaGFwZSgzLC4zLC4zKSwwLjAxKQoucm90YXRlKDAuMDEpCi5jb2xvcmFtYSgpCi5vdXQobzAp)
- [comic eye soup](https://felixroos.github.io/hydro/#b3NjKDIwLC4xLDIpCi5tb2R1bGF0ZShub2lzZSgzKSwwLjI1KQoudGhyZXNoKC40KQoubW9kdWxhdGUob3NjKDEwKS5yb3RhdGUoTWF0aC5QSS8yKSwuNykKLm1vZHVsYXRlS2FsZWlkKG5vaXNlKDQpKQoub3V0KCk=)
- [floaty shards](https://felixroos.github.io/hydro/#CnNyYyhvMCkKLmJsZW5kKHNoYXBlKDMpLnNjYWxlKDIpLmNvbG9yKDAsLjksLjUpKQoubW9kdWxhdGUodm9yb25vaSgzKSwuNSkKLm1vZHVsYXRlU2NhbGUob3NjKDEwKSwuMSkKLm1vZHVsYXRlUm90YXRlKG9zYygxMCksLjEpCi8vLmNvbG9yYW1hKCkKLm91dChvMCk=)

## Completeness

All [documented](https://hydra.ojack.xyz/api/) hydra functions / features work, except the external sources and some synth settings.
The initial goal was to see if [@kabelsalat/core](https://github.com/felixroos/kabelsalat/tree/main/packages/core) could be used to compile an existing DSL that also targets another language (GLSL) + another domain (visual). It seems to work out nicely for the moment. I might implement the remaining features in the future, just for completeness sake.

Be aware that this project is very new and likely to contain bugs.

Here's a list of implementated features:

### Language Features

- [x] Method-Chaining DSL
- [x] Array Arguments
- [x] Function Arguments
- [x] Multiple Outputs with Feedback

### Source

- [x] o0...o3
- [ ] s0...s3
- [x] noise
- [x] voronoi
- [x] osc
- [x] shape
- [x] gradient
- [x] src
- [x] solid
- [ ] prev

### Geometry

- [x] rotate
- [x] scale
- [x] pixelate
- [x] repeat
- [x] repeatX
- [x] repeatY
- [x] kaleid
- [x] scroll
- [x] scrollX
- [x] scrollY

### Color

- [x] posterize
- [x] shift
- [x] invert
- [x] contrast
- [x] brightness
- [x] luma
- [x] thresh
- [x] color
- [x] saturate
- [x] hue
- [x] colorama
- [ ] sum
- [x] r
- [x] g
- [x] b
- [x] a

### Blend

- [x] add
- [x] sub
- [x] layer
- [x] blend
- [x] mult
- [x] diff
- [x] mask

### Modulate

- [x] modulateRepeat
- [x] modulateRepeatX
- [x] modulateRepeatY
- [x] modulateKaleid
- [x] modulateScrollX
- [x] modulateScrollY
- [x] modulate
- [x] modulateScale
- [x] modulatePixelate
- [x] modulateRotate
- [x] modulateHue

### Array

- [x] fast
- [x] smooth
- [x] ease
- [x] offset
- [x] fit

### Synth Settings

- [x] render
- [ ] update
- [ ] setResolution
- [ ] hush
- [ ] setFunction
- [ ] speed
- [ ] bpm
- [x] width
- [x] height
- [x] time
- [x] mouse

### External Sources

- [ ] initCam
- [ ] initImage
- [ ] initVideo
- [ ] init
- [ ] initStream
- [ ] initScreen

## Git History

More git history can be found in the [schattenspiel repo](https://github.com/felixroos/schattenspiel).
