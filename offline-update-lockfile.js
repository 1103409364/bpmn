import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkgsDir = path.join(__dirname, "pkgs");
const lockFilePath = path.join(__dirname, "package-lock.json");

// 1. 检查目录与 lock 文件是否存在
if (!fs.existsSync(pkgsDir)) {
  console.error("❌ 未找到 pkgs 目录，请先确保已在 ./pkgs 中放入离线包文件");
  process.exit(1);
}

if (!fs.existsSync(lockFilePath)) {
  console.error("❌ 未找到 package-lock.json 文件！");
  process.exit(1);
}

// 2. 动态扫描 ./pkgs 目录下的所有 .tgz 离线文件
const tgzFiles = fs.readdirSync(pkgsDir).filter((f) => f.endsWith(".tgz"));

if (tgzFiles.length === 0) {
  console.error("⚠️ ./pkgs 目录下未找到任何 .tgz 文件");
  process.exit(1);
}

console.log(`📁 成功扫描到 ${tgzFiles.length} 个离线包文件\n`);

// 工具函数：根据包名模糊/精准匹配对应的 tgz 文件名
function findMatchedTgz(pkgName) {
  // 处理作用域包名（如 @bpmn-io/diagram-js-ui -> bpmn-io-diagram-js-ui）
  const sanitizedName = pkgName.replace(/^@/, "").replace(/\//g, "-");
  return tgzFiles.find((file) => file.startsWith(`${sanitizedName}-`));
}

// 3. 读取并更新 package-lock.json
const lockData = JSON.parse(fs.readFileSync(lockFilePath, "utf8"));
const packages = lockData.packages || {};

console.log("🔄 开始更新 package-lock.json 配置...\n");

let updatedCount = 0;

Object.keys(packages).forEach((pkgPath) => {
  if (!pkgPath) {
    // 3.1 处理根应用节点 ("")
    // 使用 file:./pkgs/ 保持与 package.json 一致，防止 npm install 时根依赖对比不匹配
    const rootDeps = packages[""].dependencies || {};
    Object.keys(rootDeps).forEach((depName) => {
      const matchedTgz = findMatchedTgz(depName);
      if (matchedTgz) {
        rootDeps[depName] = `file:./pkgs/${matchedTgz}`;
      }
    });

    const rootDevDeps = packages[""].devDependencies || {};
    Object.keys(rootDevDeps).forEach((depName) => {
      const matchedTgz = findMatchedTgz(depName);
      if (matchedTgz) {
        rootDevDeps[depName] = `file:./pkgs/${matchedTgz}`;
      }
    });
    return;
  }

  // 3.2 处理底层依赖节点 (node_modules/...)
  // 提取真实包名（处理嵌套 node_modules/xxx/node_modules/yyy 结构）
  const parts = pkgPath.split("node_modules/").filter(Boolean);
  const realPkgName = parts[parts.length - 1];

  const matchedTgz = findMatchedTgz(realPkgName);

  if (matchedTgz) {
    // 使用 npm 推荐的标准规范 file:pkgs/，这样 npm install 后就不会触发重新格式化
    const localUrl = `file:pkgs/${matchedTgz}`;
    console.log(`  📦 替换 [${pkgPath}] -> ${localUrl}`);

    packages[pkgPath].resolved = localUrl;
    // 移除远程下载校验和，适应本地包解压
    delete packages[pkgPath].integrity;
    updatedCount++;
  }
});

fs.writeFileSync(
  lockFilePath,
  JSON.stringify(lockData, null, 2) + "\n",
  "utf8",
);

console.log(
  `\n✅ package-lock.json 更新完成！共更新 ${updatedCount} 个依赖节点的资源指向。`,
);
