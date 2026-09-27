/**
 * 写入官方内置 Skill 种子。
 * 幂等：按 slug upsert（已存在则更新内容、不重复插入）。
 * 运行：pnpm tsx scripts/seed-skills.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { SEED_SKILLS, seedTemplates } from "../src/server/skills/seedSkills";

const prisma = new PrismaClient();

async function main() {
  const templates = seedTemplates();
  let created = 0;
  let updated = 0;

  for (const s of SEED_SKILLS) {
    const now = new Date();
    // 旧 client 无 Skill 类型，用原生 SQL 幂等 upsert
    const existing = await prisma.$queryRawUnsafe<
      { id: string }[]
    >("SELECT id FROM Skill WHERE slug = ?", s.slug);

    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE Skill SET name=?, category=?, outputKind=?, summary=?, scenes=?,
           howTo=?, outputs=?, template=?, official=1, updatedAt=? WHERE slug=?`,
        s.name, s.category, s.outputKind, s.summary, s.scenes,
        s.howTo, s.outputs, templates[s.slug], now.toISOString(), s.slug,
      );
      updated += 1;
    } else {
      // 用随机 id（cuid 口径手动给前缀）
      const id = `skillseed_${s.slug}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO Skill
           (id, slug, name, category, outputKind, coverUrl, summary, description,
            scenes, howTo, outputs, template, authorId, official, usageCount,
            createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, s.slug, s.name, s.category, s.outputKind, null, s.summary, null,
        s.scenes, s.howTo, s.outputs, templates[s.slug], null,
        1, 0, now.toISOString(), now.toISOString(),
      );
      created += 1;
    }
  }

  console.log(`Skill 种子完成：新建 ${created} / 更新 ${updated}（共 ${SEED_SKILLS.length}）`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
