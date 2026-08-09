import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. 指定你需要离线化的顶层主依赖列表
const targetPackageNames = [
  'bpmn-auto-layout',
  'bpmn-js',
  'bpmn-js-i18n-zh',
  'diagram-js-accordion-palette',
  'diagram-js-grid'
];

const lockFilePath = path.join(__dirname, 'package-lock.json');
const outputDir = path.join(__dirname, 'pkgs');

if (!fs.existsSync(lockFilePath)) {
  console.error('❌ 未找到 package-lock.json，请先在联网环境运行 npm install');
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
const packages = lockData.packages || {};

// 2. 存储所有分析出来的依赖包（存入 Set 避免重复）
const allCollectedPackages = new Set();

// 3. 递归查找依赖的核心逻辑（BFS 队列遍历）
function collectDependencies(initialTargets) {
  const queue = [...initialTargets];
  const visited = new Set();

  while (queue.length > 0) {
    const currentPkgName = queue.shift();

    if (visited.has(currentPkgName)) continue;
    visited.add(currentPkgName);
    allCollectedPackages.add(currentPkgName);

    // 在 package-lock.json 的 packages 字典中寻找该包对应的配置项
    Object.entries(packages).forEach(([pkgPath, pkgNode]) => {
      if (!pkgPath) return; // 跳过根节点 ""

      // 提取物理节点对应的真实包名
      const parts = pkgPath.split('node_modules/').filter(Boolean);
      const realPkgName = parts[parts.length - 1];

      // 如果当前物理节点匹配正在处理的包名
      if (realPkgName === currentPkgName) {
        // 读取其声明的所有直接子依赖
        const subDeps = {
          ...pkgNode.dependencies,
          ...pkgNode.requires
        };

        // 将所有子依赖的包名加入待处理队列，实现无限层级追溯
        Object.keys(subDeps).forEach(subDepName => {
          if (!visited.has(subDepName)) {
            queue.push(subDepName);
          }
        });
      }
    });
  }
}

console.log('🔍 开始从 package-lock.json 递归分析依赖树...');
collectDependencies(targetPackageNames);

console.log(`\n✅ 依赖分析完毕！共检索出 ${allCollectedPackages.size} 个相关依赖包：`);
console.log(Array.from(allCollectedPackages).map(p => `   - ${p}`).join('\n'));

// 4. 执行 npm pack 打包下载
console.log('\n🚀 开始下载并打包所有依赖至 ./pkgs 目录...\n');
let successCount = 0;

allCollectedPackages.forEach(pkgName => {
  try {
    console.log(`  📦 打包: ${pkgName}`);
    execSync(`npm pack ${pkgName}`, { cwd: outputDir, stdio: 'ignore' });
    successCount++;
  } catch (err) {
    console.error(`  ⚠️ 打包失败: ${pkgName}`);
  }
});

console.log(`\n🎉 处理完成！成功导出 ${successCount} 个独立的 .tgz 离线文件。`);