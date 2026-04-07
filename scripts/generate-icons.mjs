// SVGアイコンをPNGとして生成するスクリプト
// node scripts/generate-icons.mjs
import { writeFileSync } from "fs";

function createSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#6366f1"/>
  <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle"
    font-family="sans-serif" font-weight="bold" font-size="${size * 0.35}" fill="white">占スピ</text>
  <text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle"
    font-family="sans-serif" font-size="${size * 0.15}" fill="rgba(255,255,255,0.8)">YT</text>
</svg>`;
}

writeFileSync("public/icon-192.svg", createSVG(192));
writeFileSync("public/icon-512.svg", createSVG(512));
console.log("SVG icons created. Convert to PNG if needed.");
