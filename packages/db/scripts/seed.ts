/**
 * Seeds a small demo library so a fresh install is not empty.
 *
 * Run with:  npm run db:seed
 */
import { eq } from "drizzle-orm";

import { db, chapterBlocks, chapters, parts, profiles, stories } from "@lekh/db";
import type { BlockNode, EditorDoc, InlineNode } from "@lekh/db";

const DEMO_AUTHOR = {
  id: "00000000-0000-4000-8000-000000000001",
  username: "mira",
  displayName: "Mira Solano",
  bio: "Writes small, strange places. Currently between drafts.",
};

function id(): string {
  return crypto.randomUUID();
}

function para(text: string, marks?: InlineNode["marks"]): BlockNode {
  return {
    type: "paragraph",
    attrs: { id: id() },
    content: marks ? [{ type: "text", text, marks }] : [{ type: "text", text }],
  };
}

function heading(text: string, level: 1 | 2 | 3 = 2): BlockNode {
  return { type: "heading", attrs: { id: id(), level }, content: [{ type: "text", text }] };
}

function quote(text: string): BlockNode {
  return { type: "blockquote", attrs: { id: id() }, content: [{ type: "text", text }] };
}

function buildDoc(blocks: BlockNode[]): EditorDoc {
  return { type: "doc", content: blocks };
}

function plain(blocks: BlockNode[]): string {
  return blocks.map((b) => (b.content ?? []).map((c) => c.text).join("")).join("\n\n");
}

function words(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

type SeedChapter = { title: string; blocks: BlockNode[] };

type SeedStory = {
  title: string;
  slug: string;
  description: string;
  language: string;
  tags: string[];
  coverColor: string;
  parts: { title: string; chapters: SeedChapter[] }[];
};

const STORIES: SeedStory[] = [
  {
    title: "The Cartographer of Lost Roads",
    slug: "the-cartographer-of-lost-roads",
    description:
      "Every map she draws erases one street from the city. Mara has three days to draw a city that still has a way home.",
    language: "en",
    tags: ["fantasy", "quiet", "magic-realism"],
    coverColor: "linear-gradient(145deg, #2f4858, #33658a)",
    parts: [
      {
        title: "Part One — The Waning City",
        chapters: [
          {
            title: "One street at a time",
            blocks: [
              para(
                "Mara kept her instruments in a cigar box: a compass with a cracked lens, three pencils sharpened to needles, and a spoon that had once belonged to her grandmother.",
              ),
              heading("The first disappearance"),
              para(
                "It happened on a Tuesday. She drew the corner of Alder and Vine from memory — a bakery, a bicycle leaned against a wall, a cat on a windowsill — and when she inked the last line, the alley behind the bakery stopped existing.",
              ),
              para(
                "Not closed. Not demolished. Simply *not there*, as if the city had never thought of it.",
                [{ type: "bold" }],
              ),
              quote("A map is a promise you make to a place."),
              para(
                "She walked to the corner to check. The bakery was there. The bicycle was there. The cat was there, and it looked at her with the flat patience of a thing that had never been anywhere else. Between the bakery and the tailor's shop: a strip of wet brick, and nothing that could ever have been an alley.",
              ),
              para(
                "Mara stood in the gap for a long time. The pencil in her hand had already started, without her permission, to draw a new street where the old one had been.",
              ),
            ],
          },
          {
            title: "What the mayor wanted",
            blocks: [
              para(
                "The mayor's office sent a woman named Senn with a leather satchel and no smile. *We do not pay for maps*, Senn said. *We pay for the streets.*",
              ),
              para(
                "Mara tried to explain that the two had become the same thing. Senn listened the way people listen to weather reports: politely, and without intention.",
              ),
              heading("The contract"),
              para(
                "Three days. Three thousand citizens. One map at a scale nobody had attempted since the river moved. If Mara failed, the city would keep its missing streets — and the Mayor would keep the missing street's *deaths*.",
              ),
              para(
                "There were nine names in the ledger Senn left behind. Nine people who had walked into erased roads and never come out. Mara read them twice, and then she sharpened her pencils.",
              ),
            ],
          },
        ],
      },
      {
        title: "Part Two — The Way Home",
        chapters: [
          {
            title: "Nine names",
            blocks: [
              para(
                "She started with the easiest name, because there was no such thing, but starting felt like progress. Ilse Brenner, sixty-one, retired ferryman. She had vanished between the fish market and the ferry steps, which is to say she had vanished in the place where the city was most itself.",
              ),
              para(
                "Mara drew the fish market from memory. The ferry steps. The eleven metres of wet stone between them. She left a gap — a narrow lane, sunlit, lined with washing lines — and the ink behaved itself.",
              ),
              para(
                "When she finished, she felt the gap *close*. Not visibly. But the smell of the harbour shifted, and somewhere behind her a man said a word she didn't catch.",
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    title: "La casa de los espejos",
    slug: "la-casa-de-los-espejos",
    description:
      "En una casa donde todos los espejos están cubiertos, una niña descubre que el olvido también se puede reflejar.",
    language: "es",
    tags: ["fantasía", "misterio", "casa"],
    coverColor: "linear-gradient(145deg, #5f2c82, #49a09d)",
    parts: [
      {
        title: "Primera parte — Los paños",
        chapters: [
          {
            title: "El espejo cubierto",
            blocks: [
              para(
                "La casa de los espejos olía a tela vieja y a una lluvia que todavía no había caído dentro.",
              ),
              para("Sofía contaba once. Once paños blancos, uno por espejo, y ninguno se movía."),
              para(
                "Su abuela decía que cubrir un espejo era esconder a alguien. Sofía no lo entendía hasta el día en que levantó el paño del pasillo y su propio reflejo no levantó la mano.",
              ),
              quote("El olvido también se refleja, si le das la espalda."),
              para(
                "En el cristal había una cocina que no era la suya, una mesa con dos tazas y una ventana por la que entraba nieve en agosto. Y una mujer que se parecía a su madre, pero tenía los ojos apagados.",
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    title: "ليل أول",
    slug: "layl-awwal",
    description: "في المدينة التي لا تنام فيها النجوم، يتعلم صبيٌّ أن يقرأ Light.",
    language: "ar",
    tags: ["خيال", "مغامرة"],
    coverColor: "linear-gradient(145deg, #1f4037, #99f2c8)",
    parts: [
      {
        title: "الجزء الأول",
        chapters: [
          {
            title: "ليلة الضوء الأولى",
            blocks: [
              para(
                "في المدينة التي لا تنام فيها النجوم، كان زبير يتسلّل إلى سطح البيت كل ليلة ليعدّ ما بقي من الضوء.",
              ),
              para("كل ليلة كان العدد أقل، حتى لم يبقَ سوى light واحدة."),
              quote("الضوء هو أول ما نتعلّمه، وآخر ما نتذكّره."),
              para(
                "في الليلة الأولى وجد البوابة الزرقاء، ومن خلفها صوت أمه وهي تناديه باسم لم يكن له.",
              ),
            ],
          },
        ],
      },
    ],
  },
];

async function main() {
  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, DEMO_AUTHOR.username))
    .limit(1);

  if (existing.length) {
    console.log("Demo author already exists — nothing to do.");
    return;
  }

  await db.insert(profiles).values(DEMO_AUTHOR);

  for (const seed of STORIES) {
    const inserted = await db
      .insert(stories)
      .values({
        authorId: DEMO_AUTHOR.id,
        title: seed.title,
        slug: seed.slug,
        description: seed.description,
        language: seed.language,
        visibility: "public",
        status: "published",
        tags: seed.tags,
        coverColor: seed.coverColor,
        fontPreset: "literary",
        publishedAt: new Date(),
      })
      .returning();

    const story = inserted[0];
    let position = 0;
    let totalWords = 0;
    let chapterCount = 0;

    for (const [partIndex, seedPart] of seed.parts.entries()) {
      const partRows = await db
        .insert(parts)
        .values({ storyId: story.id, title: seedPart.title, position: partIndex })
        .returning();
      const part = partRows[0];

      for (const seedChapter of seedPart.chapters) {
        const text = plain(seedChapter.blocks);
        const chapterRows = await db
          .insert(chapters)
          .values({
            storyId: story.id,
            partId: part.id,
            title: seedChapter.title,
            position,
            content: buildDoc(seedChapter.blocks),
            plainText: text,
            wordCount: words(text),
          })
          .returning();
        const chapter = chapterRows[0];

        await db.insert(chapterBlocks).values(
          seedChapter.blocks.map((block, index) => ({
            id: (block.attrs?.id as string) as string,
            chapterId: chapter.id,
            position: index,
            kind: block.type,
            content: block.content ?? [],
            plainText: (block.content ?? []).map((c) => c.text).join(""),
            authorId: DEMO_AUTHOR.id,
          })),
        );

        totalWords += words(text);
        chapterCount += 1;
        position += 1;
      }
    }

    await db
      .update(stories)
      .set({ wordCount: totalWords, chapterCount })
      .where(eq(stories.id, story.id));

    console.log(`seeded: ${seed.title} (${chapterCount} chapters)`);
  }

  console.log("done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
