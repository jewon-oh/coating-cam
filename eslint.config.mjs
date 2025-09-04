import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
    // ✨ 여기에 무시할 폴더 목록을 추가합니다.
    {
        ignores: [
            "dist/",
            ".next/",
            "node_modules/",
            "common/**/*.js"
        ],
    },

    // 기존에 사용하시던 Next.js 설정을 그대로 유지합니다.
    ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;