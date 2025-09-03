// scripts/move.js
const fs = require("fs-extra");

async function main() {
    try {
        // 기존 dist/renderer 삭제 (rimraf 대체)
        await fs.remove("./dist/renderer");

        // out → dist/renderer 이동
        await fs.move("./out", "./dist/renderer");
        console.log("✅ ./out → ./dist/renderer 이동 완료");
    } catch (err) {
        console.error("❌ 이동 실패:", err);
        process.exit(1);
    }
}

main();
