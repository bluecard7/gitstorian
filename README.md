# ripthebuild

## Why did I make it?
There are a lot of cool projects that do cool stuff.
Cool stuff that I want to know how to do.
And it's all open! Free for our viewing pleasure.
However, the problem with a lot of these cool projects (`docker-ce`, `deno`, and `rxjs`) is that they're huge.
It's cool, it's open source, but how do I even begin parsing through these behemoths?
And the approach that came to mind was start from the first commit and see how the project was built over time.
That would probably allow me to absorb the project in smaller chunks and would also have the benefit of
me seeing design changes, giving me the why's of a project's evolution.

## How does it work?
<!--Demo vid?-->
You run `dev.sh` or `prod.sh` with the path to repository you want to navigate.
This will start up a UI that should load the diff stat of the first commit
(If you've already navigated the repository and bookmarked a commit, it should load the diff stat with that commit).

Using arrow keys or the arrow buttons, you can load each commit in sequence forwards and backwards.
There's a menu on the left-hand side, where you can 
- load file specific diffs by clicking on the name
- copy that version of the file
- bookmark the current commit

You can keep track of the commit order with the numbers in between the arrow buttons.

## How was it used?
I tried using `ripthebuild` on `rxjs`. I started from the first commit, read the diff, loaded files, copied, tweaked and ran to my heart's content.

## Does solve my issue?
Nope. It works, but honestly scrolling though commits and copy-paste-run code isn't the most fun or useful way to learn.

As I was scrolling, I stumbled on a commit which added a new dependency of another rxjs package.
The current `rxjs` repository was a full rewrite.
So I realized this approach didn't take care of dependencies or project migrations (the first commit could be huge).

It was jarring to see the code that was written in the beginning of `rxjs`.
Only now do I realize it was mixture of ES5 and ES6, which would explain why `this` was getting saved everywhere.
Arrow functions were not used at all.

I decided to just look at the current version of the library and realized just how different it was.
There might be some value in seeing the progression of a project, but to me, it removed all value in this
"historical" approach of learning. I only cared about how it worked now - the reason why it changed over time 
and why `rxjs` is the way it is now didn't really matter to me.

Also 5K commits is a lot. Even more so `nomad`'s 20k. `docker-ce` is at 55K.
