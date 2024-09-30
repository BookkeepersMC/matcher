# matcher

## prerequisites

In order to match, you must have [deno](https://deno.com/manual/getting_started/installation), [git](https://git-scm.com/downloads) and [java](https://adoptium.net/temurin/releases/) installed.

In this tutorial we'll be matching from `1.20` to `1.21` as examples. Note that if you're not a team member and don't have push access to the mappings repo, you'll need to fork it and clone your fork instead.

## setup
1. **ONLY DO THE FIRST TIME YOU RUN THIS SCRIPT!** run `git config --global user.name <GithubUsername>` and `git config --global user.email <GithubEmail>` 
#### unix
Run `./update.sh`, and follow the prompts. After it has completed, the commits should already be on GitHub.
#### Windows
Run `./update` in powershell or `update` in cmd, and follow the prompts. After it has completed, the commits should already be on GitHub.

## manual matching

Run `deno task setup [your old version] [your new version]`. For us, this means we'll run `deno task setup 1.20 1.21`.

You can also set up manually, see [manual setup](#manual-setup).

1. In both the old and new clones, run `./gradlew mapPerVersionMappingsJar`.
2. In the new clone, run `./gradlew dropInvalidMappings`.
3. Run `git add .` and `git commit -m "[your new version name]"` to commit. For us, this is `git commit -m "1.20"`.
4. Run `deno task match [your old version] [your new version]`. For us, this is `deno task match 1.20 1.21`.
5. In the new clone, run `./gradlew dropInvalidMappings` again. 
6. Run `./gradlew generatePackageInfoMappings` to generate new package info files. 
7. Run `./gradlew build javadocJar` to test your build. 
8. Run `git add .` and `git commit -m "match [your new version name] to [your old version name]"` to commit. For us, this is `git commit -m "match 1.21 to 1.20"`. 
9. Run `git push`, and you're done!

## manual setup

If the deno task fails, please report it and follow these steps to manually set up. You can also use this if you just don't trust the machines. We don't judge.

1. Clone this repo. We'll be calling the folder you cloned it into our `root` folder.
2. Enter your root folder.
3. Clone the mappings with `git clone https://github.com/bookkeepersmc/book [your old version name]`. For us, this means we'll have a clone in a directory named `1.20`.
4. Repeat, this time naming the clone after your new version.
5. Go into your new version clone and update the `MINECRAFT_VERSION` constant in `buildSrc/src/main/java/book/internal/Constants.java` to match your current version.
6. Still in the new version clone, run `git checkout -b [your new version name]` to create a new branch for the new version. (`git checkout -b 1.21` for us)
7. Return to your root folder. You're ready to start matching!
