import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { DailyChallengeCta } from "@/components/DailyChallengeCta"
import { GameBoard } from "@/components/GameBoard"
import { JsonLd } from "@/components/JsonLd"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { buildHomeStructuredData } from "@/lib/seo"
import { buildCanonicalUrl } from "@/lib/site"

const seoTitle = "Name 100 Women | Daily Women Name Challenge Game"
const seoDescription =
  "Play Name 100 Women, a free browser challenge where you name 100 women, verify answers with Wikidata and Wikipedia, and try a new daily theme."

export const metadata: Metadata = {
  title: {
    absolute: seoTitle,
  },
  description: seoDescription,
  keywords: [
    "name 100 women",
    "100 women names",
    "women name challenge",
    "name women game",
    "daily women trivia",
  ],
  alternates: {
    canonical: buildCanonicalUrl("/"),
  },
  openGraph: {
    title: seoTitle,
    description: seoDescription,
    type: "website",
    url: buildCanonicalUrl("/"),
  },
  twitter: {
    card: "summary_large_image",
    title: seoTitle,
    description: seoDescription,
  },
}

export default function Page() {
  return (
    <main className="min-h-svh bg-[#fffdf8] text-foreground dark:bg-[#241c15]">
      <JsonLd data={buildHomeStructuredData()} id="home-structured-data" />

      <header className="border-b-2 border-[#241c15] bg-[#ffe01b] text-[#241c15] dark:border-[#fffaf1]">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-12 md:grid-cols-[1fr_auto] lg:px-8">
          <div className="max-w-3xl space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-2 border-[#241c15] bg-white text-[#241c15]">
                Free browser game
              </Badge>
              <Badge className="border-2 border-[#241c15] bg-[#fbefe3] text-[#241c15]">
                Wikidata verified
              </Badge>
            </div>
            <h1 className="doodle-underline text-4xl font-black sm:text-5xl lg:text-6xl">
              Name 100 Women
            </h1>
            <p className="max-w-2xl text-lg font-medium leading-8 sm:text-xl">
              How many remarkable women can you name? Build a list of 100 women, verify
              every answer against public knowledge, and discover where your memory takes
              you next.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a className={buttonVariants({ className: "rounded-full" })} href="#play-name-100-women">
                Start naming women
              </a>
              <DailyChallengeCta />
            </div>
          </div>

          <div className="flex justify-start md:justify-end" aria-hidden="true">
            <Image
              alt=""
              className="h-auto w-36 -rotate-2 sm:w-44 lg:w-52"
              height={208}
              priority
              src="/logo.png"
              width={208}
            />
          </div>
        </div>
      </header>

      <section
        aria-labelledby="play-name-100-women-heading"
        className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
        id="play-name-100-women"
      >
        <div className="mb-6 grid gap-3 border-b-2 border-[#241c15] pb-5 dark:border-[#fffaf1] md:grid-cols-[1fr_0.7fr] md:items-end">
          <h2 className="text-3xl font-black sm:text-4xl" id="play-name-100-women-heading">
            Play the Name 100 Women open challenge
          </h2>
          <p className="text-base leading-7 text-muted-foreground md:text-right">
            Enter full names one at a time. Correct answers stay on your board; duplicates
            and unsupported entries do not increase the score.
          </p>
        </div>
        <GameBoard />
      </section>

      <section className="border-y-2 border-[#241c15] bg-[#ffe01b] text-[#241c15] dark:border-[#fffaf1]">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1fr_1.2fr] md:items-center lg:px-8">
          <div>
            <h2 className="text-3xl font-black sm:text-4xl">A new women name challenge every day</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#4a3c31]">
              Open mode rewards broad recall. The daily challenge gives every player the
              same date, theme, target, and validation rules, making results easier to
              compare with friends and the leaderboard.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <h3 className="text-lg font-black">Fresh rule</h3>
              <p className="mt-2 text-sm leading-6 text-[#4a3c31]">
                Move beyond familiar picks with actor, singer, director, character, and
                curated themes.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-black">Saved progress</h3>
              <p className="mt-2 text-sm leading-6 text-[#4a3c31]">
                Follow completed dates, streaks, best times, and recent results across
                repeat visits.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-black">Share the result</h3>
              <p className="mt-2 text-sm leading-6 text-[#4a3c31]">
                Download a result image or share a public result link after finishing the
                board.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:col-span-2">
            <DailyChallengeCta />
            <Link
              className={buttonVariants({ className: "rounded-full", variant: "outline" })}
              href="/how-to-play"
            >
              Read the rules
            </Link>
            <Link
              className={buttonVariants({ className: "rounded-full", variant: "outline" })}
              href="/leaderboard"
            >
              View leaderboard
            </Link>
          </div>
        </div>
      </section>

      <article className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <section className="grid gap-8 border-b-2 border-[#241c15] pb-12 dark:border-[#fffaf1] md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-black sm:text-4xl">What is the Name 100 Women game?</h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-muted-foreground">
            <p>
              Name 100 Women is a browser knowledge game built around a direct question:
              can you recall 100 real women without repeating an answer? The open challenge
              begins with an empty board and accepts one full name at a time. A familiar
              name is only the starting point. The game also checks whether the answer maps
              to the right public entity and satisfies the active rule.
            </p>
            <p>
              That verification layer separates the game from a static list of women names.
              You are not matching text against a hidden spreadsheet. Each accepted entry
              represents a specific person in Wikidata and must have the public knowledge
              signals required by the board. The result is a memory challenge that rewards
              accuracy, curiosity, and range rather than fast typing alone.
            </p>
            <p>
              The broad open mode makes a useful starting point for new players. You can
              begin with scientists, writers, musicians, athletes, political leaders,
              artists, actors, or any other women you remember. There is no single correct
              route to 100. One player may move through cinema and music, while another
              builds a board from history, literature, technology, and sport.
            </p>
          </div>
        </section>

        <section className="grid gap-8 border-b-2 border-[#241c15] py-12 dark:border-[#fffaf1] md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5 text-base leading-8 text-muted-foreground md:order-1">
            <p>
              When you submit a name, Name 100 searches for a matching entity, confirms that
              it represents a human classified as female for the open board, and checks for
              a qualifying Wikipedia presence. The stored Wikidata identifier also prevents
              the same person from scoring twice when spelling, punctuation, or display
              names vary.
            </p>
            <p>
              Rejected answers are not all the same. A guess may be too vague, resolve to
              the wrong entity, lack the required public data, fail the current theme, or
              duplicate someone already on the board. Clear feedback helps you understand
              whether to correct the name, choose another person, or widen the category you
              are searching in your memory.
            </p>
            <p>
              Wikidata and Wikipedia are living public resources, so the game is designed
              around verifiable records rather than claiming to contain every woman who has
              ever lived. This makes the rule transparent: an answer counts when the public
              entity satisfies the board, not simply because a string looks like a name.
            </p>
          </div>
          <div className="md:order-2">
            <h2 className="text-3xl font-black sm:text-4xl">How women names are verified</h2>
            <div className="mt-6 space-y-4 border-l-2 border-[#241c15] pl-5 dark:border-[#fffaf1]">
              <div>
                <h3 className="font-black">One identifiable person</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Full names give the entity search enough context to find the intended person.
                </p>
              </div>
              <div>
                <h3 className="font-black">The board rule matches</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Open mode uses the broad women rule; daily boards can add a specific theme.
                </p>
              </div>
              <div>
                <h3 className="font-black">No duplicate identity</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Entity identifiers stop spelling variations from counting as new answers.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b-2 border-[#241c15] py-12 dark:border-[#fffaf1]">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black sm:text-4xl">Open mode and the daily challenge</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Both modes use the same core idea, but they create different kinds of play.
              Choose open mode when you want a long, flexible recall session. Choose the
              daily challenge when you want a shared puzzle with a narrower subject.
            </p>
          </div>
          <div className="mt-8 grid border-2 border-[#241c15] bg-white dark:border-[#fffaf1] dark:bg-[#30261e] md:grid-cols-2">
            <div className="p-6 sm:p-8 md:border-r-2 md:border-[#241c15] md:dark:border-[#fffaf1]">
              <h3 className="text-2xl font-black">Name 100 Women open mode</h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                The homepage board asks for 100 verified women from any field. It is useful
                for learning the input rhythm, testing the breadth of your recall, and
                returning to a longer run without waiting for a particular theme. The open
                board is less about comparing identical puzzles and more about seeing how
                far your personal knowledge can stretch.
              </p>
            </div>
            <div className="border-t-2 border-[#241c15] bg-[#fbefe3] p-6 dark:border-[#fffaf1] dark:bg-[#4a3c31] sm:p-8 md:border-t-0">
              <h3 className="text-2xl font-black">Daily women name challenge</h3>
              <p className="mt-4 text-base leading-8 text-muted-foreground">
                Each date has a stable route and a shared category. A daily board may ask
                for women actors, singers, directors, public figures from a curated source,
                or fictional female characters. Because the date and rule are identical for
                every player, completion time, guess count, streaks, and leaderboard results
                have clearer context.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-10 border-b-2 border-[#241c15] py-12 dark:border-[#fffaf1] lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <h2 className="text-3xl font-black sm:text-4xl">How to build a list of 100 women</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              A complete board is easier when you treat memory as a map instead of waiting
              for names to appear in random order.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="text-xl font-black">Start with confident anchors</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                Enter complete names you know well. Early accepted answers create momentum
                and reveal which parts of your memory are immediately available. Avoid
                spending the first minutes on an uncertain spelling when another category
                can keep the board moving.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black">Move across fields and eras</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                Rotate through science, literature, civil rights, politics, art, film,
                music, exploration, and sport. Then revisit each field by era or region.
                Switching categories reduces the feeling of being stuck and produces a more
                varied list of women.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black">Use feedback as a clue</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                A duplicate warning means your memory is circling familiar ground. A failed
                verification may mean the entity is ambiguous or lacks the required public
                record. In both cases, move sideways to a related person instead of repeating
                the same guess.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black">Let discovery follow the run</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                The final board can become a reading list. Names from unfamiliar fields,
                overlooked periods, or distant regions provide natural starting points for
                learning after the score is complete. The game tests recall, but its larger
                value is encouraging broader knowledge of women and their work.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-10 border-b-2 border-[#241c15] py-12 dark:border-[#fffaf1] md:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-black sm:text-4xl">
              Why naming 100 women is harder than it sounds
            </h2>
          </div>
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-black">Recognition is easier than recall</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                Most people recognize far more public women than they can produce from
                memory without a prompt. A photograph, film title, book cover, or historical
                event can make a name feel obvious, but an empty input asks the brain to
                retrieve that same information independently. The gap between recognition
                and recall is what gives the board its difficulty, especially after the
                first group of familiar answers has been used.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black">Familiar categories crowd out others</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                Early guesses often cluster around current entertainment, national politics,
                or subjects a player follows closely. That can make the available pool feel
                smaller than it really is. Moving deliberately into mathematics, medicine,
                visual art, aviation, activism, architecture, philosophy, and older periods
                reveals how many names were simply outside the first search path through
                memory.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-black">A verified board creates useful friction</h3>
              <p className="mt-3 text-base leading-8 text-muted-foreground">
                Without verification, a name game can become an argument about spelling,
                identity, duplicates, or whether a person fits the rule. Name 100 Women uses
                public entity data to keep that friction productive. A rejected answer asks
                you to clarify the person or choose another path, while an accepted answer
                gives the growing list a consistent foundation. The board remains a game,
                but its rules also encourage more precise knowledge.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-8 pt-12 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-black sm:text-4xl">Ready to name 100 women?</h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              Start an open run now, or open today&apos;s shared challenge when you want a
              focused category and a result you can compare. No mandatory account is needed
              to begin playing.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a className={buttonVariants({ className: "rounded-full" })} href="#play-name-100-women">
              Play open mode
            </a>
            <DailyChallengeCta />
          </div>
        </section>
      </article>
    </main>
  )
}
