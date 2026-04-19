// ビルトインのプリセットを DB に投入する。
// 既存レコードは label/tags/order を上書き更新、未登録のものは追加。
// `isBuiltIn=true` が立ったプリセットはユーザー側から削除できない想定（UI 側で制御）。

import "dotenv/config";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import {
  VIEW_ANGLE_PRESETS,
  TIME_PRESETS,
  CLOTHING_PRESETS,
  HAIRSTYLE_PRESETS,
  ACTION_CATEGORIES,
  BODY_PART_TYPES,
} from "../src/lib/presets";

loadEnv({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaLibSql({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding presets...");

  // BodyPartType（key が unique なので upsert できる）
  for (const t of BODY_PART_TYPES) {
    await prisma.bodyPartType.upsert({
      where: { key: t.key },
      update: { label: t.label, isBuiltIn: true },
      create: { key: t.key, label: t.label, isBuiltIn: true },
    });
  }
  console.log(`  BodyPartType: ${BODY_PART_TYPES.length} types`);

  // ViewAnglePreset（label ユニーク扱い）
  for (const p of VIEW_ANGLE_PRESETS) {
    const existing = await prisma.viewAnglePreset.findFirst({ where: { label: p.label } });
    const data = { tags: p.tags, category: p.category, order: p.order, isBuiltIn: true };
    if (existing) {
      await prisma.viewAnglePreset.update({ where: { id: existing.id }, data });
    } else {
      await prisma.viewAnglePreset.create({ data: { label: p.label, ...data } });
    }
  }
  console.log(`  ViewAnglePreset: ${VIEW_ANGLE_PRESETS.length}`);

  // TimePreset
  for (const p of TIME_PRESETS) {
    const existing = await prisma.timePreset.findFirst({ where: { label: p.label } });
    const data = { tags: p.tags, category: p.category, order: p.order, isBuiltIn: true };
    if (existing) {
      await prisma.timePreset.update({ where: { id: existing.id }, data });
    } else {
      await prisma.timePreset.create({ data: { label: p.label, ...data } });
    }
  }
  console.log(`  TimePreset: ${TIME_PRESETS.length}`);

  // ClothingPreset
  for (const p of CLOTHING_PRESETS) {
    const existing = await prisma.clothingPreset.findFirst({ where: { label: p.label } });
    const data = {
      tags: p.tags,
      category: p.category,
      order: p.order,
      isBuiltIn: true,
      isNude: p.isNude ?? false,
    };
    if (existing) {
      await prisma.clothingPreset.update({ where: { id: existing.id }, data });
    } else {
      await prisma.clothingPreset.create({ data: { label: p.label, ...data } });
    }
  }
  console.log(`  ClothingPreset: ${CLOTHING_PRESETS.length}`);

  // HairstylePreset
  for (const p of HAIRSTYLE_PRESETS) {
    const existing = await prisma.hairstylePreset.findFirst({ where: { label: p.label } });
    const data = { tags: p.tags, category: p.category, order: p.order, isBuiltIn: true };
    if (existing) {
      await prisma.hairstylePreset.update({ where: { id: existing.id }, data });
    } else {
      await prisma.hairstylePreset.create({ data: { label: p.label, ...data } });
    }
  }
  console.log(`  HairstylePreset: ${HAIRSTYLE_PRESETS.length}`);

  // ActionCategory + ActionPreset
  for (const cat of ACTION_CATEGORIES) {
    const category = await prisma.actionCategory.upsert({
      where: { key: cat.key },
      update: { label: cat.label, isNSFW: cat.isNSFW, order: cat.order, isBuiltIn: true },
      create: {
        key: cat.key,
        label: cat.label,
        isNSFW: cat.isNSFW,
        order: cat.order,
        isBuiltIn: true,
      },
    });

    for (let i = 0; i < cat.actions.length; i += 1) {
      const a = cat.actions[i];
      const existing = await prisma.actionPreset.findFirst({
        where: { label: a.label, categoryId: category.id },
      });
      const data = {
        tags: a.tags,
        isNSFW: cat.isNSFW,
        defaultCondom: a.defaultCondom ?? null,
        order: i * 10,
        isBuiltIn: true,
      };
      if (existing) {
        await prisma.actionPreset.update({ where: { id: existing.id }, data });
      } else {
        await prisma.actionPreset.create({
          data: { label: a.label, categoryId: category.id, ...data },
        });
      }
    }
    console.log(`  ActionCategory "${cat.label}": ${cat.actions.length} actions`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
