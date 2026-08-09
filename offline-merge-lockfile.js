import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgsDir = path.join(__dirname, "pkgs");
const sourceLockPath = path.join(__dirname, "package-lock-source.json"); // 原项目的 lock 文件
const targetLockPath = path.join(__dirname, "package-lock.json"); // 老项目的 lock 文件

// 1. 基础文件检查
if (!fs.existsSync(pkgsDir)) {
  console.error("❌ 未找到 ./pkgs 目录，请先复制离线包文件夹！");
  process.exit(1);
}

if (!fs.existsSync(sourceLockPath)) {
  console.error(
    "❌ 未找到 package-lock-source.json！请将原项目的 package-lock.json 重命名为 package-lock-source.json 并放到当前目录",
  );
  process.exit(1);
}

if (!fs.existsSync(targetLockPath)) {
  console.error("❌ 未找到当前老项目的 package-lock.json！");
  process.exit(1);
}

// 2. 读取两个 lock 文件
const sourceLock = JSON.parse(fs.readFileSync(sourceLockPath, "utf8"));
const targetLock = JSON.parse(fs.readFileSync(targetLockPath, "utf8"));

const sourcePackages = sourceLock.packages || {};
const targetPackages = targetLock.packages || {};

console.log("🔄 开始从原项目 Lock 文件提取并合并 BPMN 依赖树到老项目...\n");

let mergedCount = 0;

// 3. 遍历原项目 lock 文件中的所有节点，将指向 file:./pkgs 或 file:pkgs 的节点全量植入老项目
Object.entries(sourcePackages).forEach(([pkgPath, pkgNode]) => {
  if (!pkgPath) return; // 跳过根节点

  const resolved = pkgNode.resolved || "";
  // 匹配所有指向本地离线包的节点
  if (resolved.includes("file:./pkgs/") || resolved.includes("file:pkgs/")) {
    targetPackages[pkgPath] = pkgNode;
    console.log(`  ➕ 植入节点: ${pkgPath} -> ${resolved}`);
    mergedCount++;
  }
});

// 4. 同步更新老项目根节点的 dependencies 声明
const targetRootDeps = targetLock.packages[""].dependencies || {};
const sourceRootDeps = sourceLock.packages[""]?.dependencies || {};

Object.entries(sourceRootDeps).forEach(([depName, depVersion]) => {
  if (
    depVersion.includes("file:./pkgs/") ||
    depVersion.includes("file:pkgs/")
  ) {
    targetRootDeps[depName] = depVersion;
  }
});

targetLock.packages[""].dependencies = targetRootDeps;

// 5. 写回老项目的 package-lock.json
fs.writeFileSync(
  targetLockPath,
  JSON.stringify(targetLock, null, 2) + "\n",
  "utf8",
);

console.log(
  `\n✅ 合并完成！成功向老项目的 package-lock.json 中植入了 ${mergedCount} 个离线包依赖节点。`,
);
